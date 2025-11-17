import type { GuidGeneratorPort } from '../ports/guid-generator-port.js';
import type { ProgressPort } from '../ports/progress-port.js';
import type { UploaderPort } from '../ports/uploader-port.js';
import type { VaultPort } from '../ports/vault-port.js';

import type { ContentSanitizer } from '../domain/ContentSanitizer.js';
import type { FolderConfig } from '../domain/FolderConfig.js';
import type { PublishableNote } from '../domain/PublishableNote.js';
import type { PublishPluginSettings } from '../domain/PublishPluginSettings.js';
import { DefaultContentSanitizer } from '../domain/services/default-content-sanitizer.js';

import { ComputeRoutingUseCase } from './compute-routing.usecase.js';
import { DetectAssetsUseCase } from './detect-assets.usecase.js';
import { DetectWikilinksUseCase } from './detect-wikilinks.usecase.js';
import { EvaluateIgnoreRulesUseCase } from './evaluate-ignore-rules.usecase.js';
import { NormalizeFrontmatterUseCase } from './normalize-frontmatter.usecase.js';
import { RenderInlineDataviewUseCase } from './render-inline-dataview.usecase.js';
import type { LoggerPort } from '../ports/logger-port.js';

export type PublicationResult =
  | { type: 'success'; publishedCount: number; notes: PublishableNote[] }
  | { type: 'noConfig' }
  | { type: 'missingVpsConfig'; foldersWithoutVps: string[] }
  | { type: 'error'; error: unknown };

/**
 * Orchestrateur principal de composition de notes et d'envoi.
 *
 * Par note :
 *  1. Normalize frontmatter -> DomainFrontmatter
 *  2. EvaluateIgnoreRules -> isPublishable
 *  3. Construction du NoteCore (PublishableNote "nu")
 *  4. Content pipeline :
 *      - RenderInlineDataviewUseCase
 *      - ContentSanitizer (SanitizeMarkdownUseCase)
 *  5. Note composition :
 *      - DetectAssetsUseCase
 *      - DetectWikilinksUseCase
 *      - ComputeRoutingUseCase
 *  6. Regroupement par VPS + upload
 *
 * La collecte physique des fichiers d'assets et la résolution effective
 * des wikilinks (ResolveWikilinksUseCase / CollectAssetsFileUseCase)
 * se font dans d'autres usecases de workflow sur la liste de notes publishable.
 */
export class PublishToSiteUseCase {
  private readonly normalizeFrontmatter = new NormalizeFrontmatterUseCase();
  private readonly evaluateIgnoreRules = new EvaluateIgnoreRulesUseCase();
  private readonly renderInlineDataview = new RenderInlineDataviewUseCase();
  private readonly detectAssets = new DetectAssetsUseCase();
  private readonly detectWikilinks = new DetectWikilinksUseCase();
  private readonly computeRouting = new ComputeRoutingUseCase();

  constructor(
    private readonly vaultPort: VaultPort,
    private readonly uploaderPort: UploaderPort,
    private readonly guidGenerator: GuidGeneratorPort,
    private readonly logger: LoggerPort,
    private readonly contentSanitizer: ContentSanitizer = new DefaultContentSanitizer()
  ) {}

  async execute(
    settings: PublishPluginSettings,
    progress?: ProgressPort
  ): Promise<PublicationResult> {
    const log = this.logger.child({ usecase: 'PublishToSiteUseCase' });
    log.info('Starting publish-to-site execution');

    if (!settings?.vpsConfigs?.length || !settings?.folders?.length) {
      log.warn('No VPS configs or folders found in settings');
      return { type: 'noConfig' };
    }

    // Index VPS par id
    const vpsById = new Map<string, any>();
    for (const vps of settings.vpsConfigs) {
      if (vps && vps.id) vpsById.set(vps.id, vps);
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

    // 1) Collecte brute
    for (const folder of settings.folders) {
      const vpsConfig = vpsById.get(folder.vpsId);
      if (!vpsConfig) {
        log.warn('Missing VPS config for folder', {
          folderId: folder.id,
          vpsId: folder.vpsId,
        });
        missingVps.push(folder.id);
        continue;
      }

      log.debug('Collecting notes from folder', { folderId: folder.id });
      const { notes } = await this.vaultPort.collectNotesFromFolder(folder);
      for (const n of notes) {
        collected.push({
          vaultPath: n.vaultPath,
          relativePath: n.relativePath, // CHEMIN BRUT, PAS SLUGIFIÉ
          content: n.content,
          frontmatter: n.frontmatter ?? {},
          folder,
          vpsConfig,
        });
      }
    }

    if (missingVps.length > 0) {
      log.error('Some folders are missing VPS configs', { missingVps });
      return { type: 'missingVpsConfig', foldersWithoutVps: missingVps };
    }

    if (collected.length === 0) {
      log.info('No notes collected for publishing');
      progress?.start(0);
      progress?.finish();
      return { type: 'success', publishedCount: 0, notes: [] };
    }

    progress?.start(collected.length);
    log.info('Collected notes', { count: collected.length });

    const publishable: PublishableNote[] = [];

    // 2) Pipeline par note
    for (const raw of collected) {
      // 2.a) normalize frontmatter
      const domainFrontmatter = this.normalizeFrontmatter.execute({
        raw: raw.frontmatter,
      });

      // 2.b) ignore rules
      const eligibility = this.evaluateIgnoreRules.execute({
        frontmatter: domainFrontmatter,
        rules: settings.ignoreRules ?? null,
      });

      if (!eligibility.isPublishable) {
        log.debug('Note ignored by rules', { vaultPath: raw.vaultPath });
        progress?.advance(1);
        continue;
      }

      // 2.c) construire le noyau de note
      let note: PublishableNote = {
        noteId: this.guidGenerator.generateGuid(),
        vaultPath: raw.vaultPath,
        relativePath: raw.relativePath,
        content: raw.content,
        frontmatter: domainFrontmatter,
        folderConfig: raw.folder,
        vpsConfig: raw.vpsConfig,
      };

      // 2.d) pipeline contenu : dataview inline
      note = this.renderInlineDataview.execute(note);

      // 2.e) pipeline contenu : sanitize markdown
      note = this.contentSanitizer.sanitizeNote(note, raw.folder.sanitization);

      // 2.f) pipeline note : assets
      note = this.detectAssets.execute(note);

      // 2.g) pipeline note : wikilinks
      note = this.detectWikilinks.execute(note);

      // 2.h) pipeline note : routing
      note = this.computeRouting.execute(note);

      log.debug('Note ready for publishing', {
        noteId: note.noteId,
        vaultPath: note.vaultPath,
      });
      publishable.push(note);
      progress?.advance(1);
    }

    if (publishable.length === 0) {
      log.info('No publishable notes after filtering');
      progress?.finish();
      return { type: 'success', publishedCount: 0, notes: [] };
    }

    // 3) Regroupement par VPS et upload
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
      for (const [vpsId, notes] of byVps.entries()) {
        log.info('Uploading notes to VPS', { vpsId, noteCount: notes.length });
        await this.uploaderPort.upload(notes);
        publishedCount += notes.length;
      }

      log.info('Publishing completed successfully', { publishedCount });
      progress?.finish();
      return { type: 'success', publishedCount, notes: publishable };
    } catch (error) {
      log.error('Error during publishing', error);
      progress?.finish();
      return { type: 'error', error };
    }
  }
}
