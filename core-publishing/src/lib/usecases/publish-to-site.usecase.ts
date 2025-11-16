import { ContentSanitizer } from '../domain/ContentSanitizer.js';
import { FolderConfig } from '../domain/FolderConfig.js';
import { PublishableNote } from '../domain/PublishableNote.js';
import { PublishPluginSettings } from '../domain/PublishPluginSettings.js';
import { DefaultContentSanitizer } from '../domain/services/default-content-sanitizer.js';

import type { ProgressPort } from '../ports/progress-port.js';
import type { UploaderPort } from '../ports/uploader-port.js';
import type { VaultPort } from '../ports/vault-port.js';

import { DetectAssetsUseCase } from './detect-assets.usecase.js';
import { DetectWikilinksUseCase } from './detect-wikilinks.usecase.js';
import { EvaluateIgnoreRulesUseCase } from './evaluate-ignore-rules.usecase.js';
import { NormalizeFrontmatterUseCase } from './normalize-frontmatter.usecase.js';
import { RenderInlineDataviewUseCase } from './render-inline-dataview.usecase.js';

export type PublicationResult =
  | { type: 'success'; publishedCount: number }
  | { type: 'noConfig' }
  | { type: 'missingVpsConfig'; foldersWithoutVps: string[] }
  | { type: 'error'; error: unknown };

/**
 * Orchestrateur principal :
 *
 * 1. Collecte les notes depuis les folders configurés.
 * 2. Normalise le frontmatter.
 * 3. Applique les IgnoreRules.
 * 4. Sanitize le contenu (ContentSanitizer).
 * 5. Détecte les assets (![[...]]) dans le markdown.
 * 6. Détecte les wikilinks ([[...]]) dans le markdown.
 * 7. Regroupe par VPS et envoie au UploaderPort.
 *
 * La collecte physique des fichiers d’assets et la résolution des wikilinks
 * seront gérées dans une passe ultérieure (CollectAssetsFileUseCase / ResolveWikilinksUseCase),
 * quand les adapters côté Obsidian + backend seront en place.
 */
export class PublishToSiteUseCase {
  private readonly normalizeFrontmatter = new NormalizeFrontmatterUseCase();
  private readonly evaluateIgnoreRules = new EvaluateIgnoreRulesUseCase();
  private readonly detectAssets = new DetectAssetsUseCase();
  private readonly detectWikilinks = new DetectWikilinksUseCase();
  private readonly renderInlineDataview = new RenderInlineDataviewUseCase();

  constructor(
    private readonly vaultPort: VaultPort,
    private readonly uploaderPort: UploaderPort,
    private readonly contentSanitizer: ContentSanitizer = new DefaultContentSanitizer()
  ) {}

  async execute(
    settings: PublishPluginSettings,
    progress?: ProgressPort
  ): Promise<PublicationResult> {
    if (!settings?.vpsConfigs?.length || !settings?.folders?.length) {
      return { type: 'noConfig' };
    }

    // Index rapide des VPS par id
    const vpsById = new Map<string, any>();
    for (const vps of settings.vpsConfigs) {
      if (vps && vps.id) {
        vpsById.set(vps.id, vps);
      }
    }

    const missingVps: string[] = [];
    const collected: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, unknown>;
      folder: FolderConfig;
      vpsConfig: any;
    }> = [];

    // 1) Collecte de toutes les notes depuis les folders
    for (const folder of settings.folders) {
      const vpsConfig = vpsById.get(folder.vpsId);
      if (!vpsConfig) {
        // Folder mal configuré (référence un VPS inexistant)
        missingVps.push(folder.id);
        continue;
      }

      const { notes } = await this.vaultPort.collectNotesFromFolder(folder);
      for (const n of notes) {
        collected.push({
          vaultPath: n.vaultPath,
          relativePath: n.relativePath,
          content: n.content,
          frontmatter: n.frontmatter ?? {},
          folder,
          vpsConfig,
        });
      }
    }

    if (missingVps.length > 0) {
      return { type: 'missingVpsConfig', foldersWithoutVps: missingVps };
    }

    if (collected.length === 0) {
      progress?.start(0);
      progress?.finish();
      return { type: 'success', publishedCount: 0 };
    }

    progress?.start(collected.length);

    const publishable: PublishableNote[] = [];
    const allAssets: any[] = []; // AssetRef[]
    const allWikilinksByNote: Array<{
      noteId: string;
      wikilinks: any[]; // WikilinkRef[]
    }> = [];

    // 2) Traitement par note : frontmatter -> ignore -> sanitize -> assets/wikilinks
    for (const raw of collected) {
      // 2.a) Normaliser le frontmatter (dot-notation -> nested, etc.)
      const domainFrontmatter = this.normalizeFrontmatter.execute({
        raw: raw.frontmatter,
      });

      // 2.b) Appliquer les IgnoreRules globales
      const eligibility = this.evaluateIgnoreRules.execute({
        frontmatter: domainFrontmatter,
        rules: settings.ignoreRules ?? null,
      });

      if (!eligibility.isPublishable) {
        // Note ignorée : on consomme quand même une "unité" de progression
        progress?.advance(1);
        continue;
      }

      // 2.b.1) Rendre les expressions Dataview inline
      const renderedDataview = this.renderInlineDataview.execute(
        raw.content,
        domainFrontmatter
      );

      // 2.c) Construire une note de domaine minimale
      const baseNote: PublishableNote = {
        vaultPath: raw.vaultPath,
        relativePath: this.slugify(raw.relativePath),
        content: renderedDataview.markdown,
        // NOTE : frontmatter est désormais un DomainFrontmatter générique,
        // pas un schéma canonique titre/description/tags.
        frontmatter: domainFrontmatter,
        folderConfig: raw.folder,
        vpsConfig: raw.vpsConfig,
      };

      // 2.d) Sanitize du contenu (fenced code blocks, etc.)
      const sanitized = this.contentSanitizer.sanitizeNote(
        baseNote,
        raw.folder.sanitization
      );

      // 2.e) Détection des assets dans le markdown (sur le contenu final)
      const { assets } = this.detectAssets.execute({
        markdown: sanitized.content,
      });
      if (assets.length > 0) {
        allAssets.push(...assets);
      }

      // 2.f) Détection des wikilinks (hors ![[...]])
      const { wikilinks } = this.detectWikilinks.execute({
        markdown: sanitized.content,
      });
      if (wikilinks.length > 0) {
        allWikilinksByNote.push({
          noteId: sanitized.vaultPath, // pour l'instant : vaultPath sert d'identifiant logique
          wikilinks,
        });
      }

      publishable.push(sanitized);
      progress?.advance(1);
    }

    // À ce stade :
    // - publishable = notes prêtes à être envoyées (contenu + frontmatter normalisé).
    // - allAssets = tous les AssetRef trouvés (non dédupliqués).
    // - allWikilinksByNote = wikilinks bruts, groupés par note.
    //
    // La collecte physique/upload des assets et la résolution des wikilinks
    // seront branchées plus tard via CollectAssetsFileUseCase & ResolveWikilinksUseCase.

    if (publishable.length === 0) {
      progress?.finish();
      return { type: 'success', publishedCount: 0 };
    }

    // 3) Regrouper par VPS et uploader via UploaderPort
    const byVps = new Map<string, PublishableNote[]>();

    for (const note of publishable) {
      const key = note.vpsConfig.id;
      const bucket = byVps.get(key);
      if (!bucket) {
        byVps.set(key, [note]);
      } else {
        bucket.push(note);
      }
    }

    let publishedCount = 0;

    try {
      for (const notes of byVps.values()) {
        await this.uploaderPort.uploadNotes(notes);
        publishedCount += notes.length;
        // On ne touche plus à progress ici : il a déjà été avancé par note.
      }

      progress?.finish();
      return { type: 'success', publishedCount };
    } catch (error) {
      progress?.finish();
      return { type: 'error', error };
    }
  }

  /**
   * Slugifie le chemin relatif d'une note en ne gardant que les dossiers.
   *
   * - On enlève le nom de fichier final.
   * - On slugifie chaque segment.
   * - On garde les "/" pour reconstruire un relativePath propre.
   *
   * TODO : à terme, cette logique doit migrer vers compute-routing.usecase.ts
   * pour gérer aussi le slug du fichier et l'id complet.
   */
  private slugify(value: string): string {
    if (!value) return '';

    // On enlève le dernier segment (nom de fichier)
    const pathOnly = value.trim().split('/').slice(0, -1).join('/');

    if (!pathOnly) return '';

    const segments = pathOnly.split('/').filter(Boolean);

    const sluggedSegments = segments.map((segment) =>
      segment
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // accents
        .replace(/[^a-zA-Z0-9\s]/g, '') // caractères spéciaux
        .replace(/\s{2,}/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s/g, '-')
    );

    return sluggedSegments.join('/');
  }
}
