import type { CollectedNote } from '../domain/CollectedNote.js';
import type { ContentSanitizer } from '../domain/ContentSanitizer.js';
import type { FolderConfig } from '../domain/FolderConfig.js';
import type { PublishableNote } from '../domain/PublishableNote.js';
import type { PublishPluginSettings } from '../domain/PublishPluginSettings.js';
import { DefaultContentSanitizer } from '../domain/services/default-content-sanitizer.js';
import type { UploaderPort } from '../domain/uploader-port.js';
import type { GuidGeneratorPort } from '../ports/guid-generator-port.js';
import type { LoggerPort } from '../ports/logger-port.js';
import type { ProgressPort } from '../ports/progress-port.js';
import type { VaultPort } from '../ports/vault-port.js';
import { ComputeRoutingUseCase } from './compute-routing.usecase.js';
import { DetectAssetsUseCase } from './detect-assets.usecase.js';
import { DetectWikilinksUseCase } from './detect-wikilinks.usecase.js';
import { EvaluateIgnoreRulesUseCase } from './evaluate-ignore-rules.usecase.js';
import { NormalizeFrontmatterUseCase } from './normalize-frontmatter.usecase.js';
import { RenderInlineDataviewUseCase } from './render-inline-dataview.usecase.js';

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
  private readonly _logger: LoggerPort;

  private readonly normalizeFrontmatter: NormalizeFrontmatterUseCase;
  private readonly evaluateIgnoreRules: EvaluateIgnoreRulesUseCase;
  private readonly renderInlineDataview: RenderInlineDataviewUseCase;
  private readonly detectAssets: DetectAssetsUseCase;
  private readonly detectWikilinks: DetectWikilinksUseCase;
  private readonly computeRouting: ComputeRoutingUseCase;

  constructor(
    private readonly vaultPort: VaultPort<CollectedNote[]>,
    private readonly uploaderPort: UploaderPort,
    private readonly guidGenerator: GuidGeneratorPort,
    logger: LoggerPort,
    private readonly contentSanitizer: ContentSanitizer = new DefaultContentSanitizer()
  ) {
    this._logger = logger.child({ useCase: PublishToSiteUseCase.name });
    this._logger.debug('PublishToSiteUseCase initialized');

    this.normalizeFrontmatter = new NormalizeFrontmatterUseCase(this._logger);
    this.evaluateIgnoreRules = new EvaluateIgnoreRulesUseCase(this._logger);
    this.renderInlineDataview = new RenderInlineDataviewUseCase(this._logger);
    this.detectAssets = new DetectAssetsUseCase(this._logger);
    this.detectWikilinks = new DetectWikilinksUseCase(this._logger);
    this.computeRouting = new ComputeRoutingUseCase(this._logger);
  }

  async execute(
    settings: PublishPluginSettings,
    progress?: ProgressPort
  ): Promise<PublicationResult> {
    this._logger.info('Starting publish-to-site execution');

    if (!settings?.vpsConfigs?.length || !settings?.folders?.length) {
      this._logger.warn('No VPS configs or folders found in settings');
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
        this._logger.warn('Missing VPS config for folder', {
          folderId: folder.id,
          vpsId: folder.vpsId,
        });
        missingVps.push(folder.id);
        continue;
      }

      this._logger.debug('Collecting notes from folder', {
        folderId: folder.id,
      });
      const notes = await this.vaultPort.collectFromFolder(folder);
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
      this._logger.error('Some folders are missing VPS configs', {
        missingVps,
      });
      return { type: 'missingVpsConfig', foldersWithoutVps: missingVps };
    }

    if (collected.length === 0) {
      this._logger.info('No notes collected for publishing');
      progress?.start(0);
      progress?.finish();
      return { type: 'success', publishedCount: 0, notes: [] };
    }

    progress?.start(collected.length);
    this._logger.info('Collected notes', { count: collected.length });

    const publishable: PublishableNote[] = [];

    // 2) Pipeline par note
    for (const raw of collected) {
      const notePipelineLogger = this._logger.child({ step: 'notePipeline' });

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
        notePipelineLogger.debug('Note ignored by rules', {
          vaultPath: raw.vaultPath,
        });
        progress?.advance(1);
        continue;
      }

      // 2.c) construire le noyau de note
      let note: PublishableNote = {
        noteId: this.guidGenerator.generateGuid(),
        title: this.extractFileNameWithoutExt(raw.vaultPath),
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

      notePipelineLogger.debug('Note ready for publishing', {
        noteId: note.noteId,
        vaultPath: note.vaultPath,
      });
      publishable.push(note);
      progress?.advance(1);
    }

    if (publishable.length === 0) {
      this._logger.info('No publishable notes after filtering');
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
        this._logger.info('Uploading notes to VPS', {
          vpsId,
          noteCount: notes.length,
        });
        const success = await this.uploaderPort.upload(notes);

        if (!success) {
          this._logger.error('Failed to upload notes to VPS', { vpsId });
          throw new Error(`Upload failed for VPS ID ${vpsId}`);
        }

        publishedCount += notes.length;
      }

      this._logger.info('Publishing completed successfully', {
        publishedCount,
      });
      progress?.finish();
      return { type: 'success', publishedCount, notes: publishable };
    } catch (error) {
      this._logger.error('Error during publishing', error);
      progress?.finish();
      return { type: 'error', error };
    }
  }

  private extractFileNameWithoutExt(path: string): string {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex === -1) {
      return fileName;
    }

    return fileName.substring(0, dotIndex);
  }
}
