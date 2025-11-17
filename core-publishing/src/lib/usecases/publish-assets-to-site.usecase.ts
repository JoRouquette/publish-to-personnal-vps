import type { AssetRef } from '../domain/AssetRef.js';
import { NoteWithAssets } from '../domain/NoteWithAssets.js';
import { ResolvedAssetFile } from '../domain/ResolvedAssetFile.js';
import type { UploaderPort } from '../ports/uploader-port.js';
import type { AssetsVaultPort } from '../ports/assets-vault-port.js';
import type { ProgressPort } from '../ports/progress-port.js';
import type { LoggerPort } from '../ports/logger-port.js';

export type AssetPublishFailureReason =
  | 'not-found'
  | 'upload-error'
  | 'resolve-error';

export interface AssetPublishFailure {
  noteId: string;
  asset: AssetRef;
  reason: AssetPublishFailureReason;
  error?: unknown;
}

export type AssetsPublicationResult =
  | {
      type: 'success';
      publishedAssetsCount: number;
      failures: AssetPublishFailure[];
    }
  | { type: 'noAssets' }
  | { type: 'error'; error: unknown };

/**
 * Orchestrates asset resolution and upload for a set of notes.
 */
export class PublishAssetsToSiteUseCase {
  constructor(
    private readonly assetsVaultPort: AssetsVaultPort,
    private readonly assetsUploaderPort: UploaderPort,
    private readonly logger: LoggerPort
  ) {}

  async execute(params: {
    notes: NoteWithAssets[];
    assetsFolder: string;
    enableAssetsVaultFallback: boolean;
    progress?: ProgressPort;
  }): Promise<AssetsPublicationResult> {
    const { notes, assetsFolder, enableAssetsVaultFallback, progress } = params;

    const logger = this.logger.child({ usecase: 'PublishAssetsToSiteUseCase' });

    logger.info(
      'Starting asset publication for %d notes (assetsFolder=%s, enableAssetsVaultFallback=%s)',
      notes.length,
      assetsFolder,
      enableAssetsVaultFallback
    );

    // 1. Collect all assets to publish
    const collected: Array<{
      noteId: string;
      asset: AssetRef;
      resolved: ResolvedAssetFile | null;
    }> = [];

    const failures: AssetPublishFailure[] = [];

    const notesWithAssets = notes.filter(
      (n) => Array.isArray(n.assets) && n.assets.length > 0
    );

    if (notesWithAssets.length === 0) {
      logger.info('No notes with assets found, nothing to publish.');
      return { type: 'noAssets' };
    }

    let totalAssets = 0;
    for (const note of notesWithAssets) {
      for (const asset of note.assets ?? []) {
        try {
          logger.debug(
            'Resolving asset for noteId=%s asset=%o',
            note.noteId,
            asset
          );
          const resolved = await this.assetsVaultPort.resolveAssetForNote(
            note,
            asset,
            assetsFolder,
            enableAssetsVaultFallback
          );
          collected.push({ noteId: note.noteId, asset, resolved });
          totalAssets += 1;
          logger.debug(
            'Resolved asset for noteId=%s asset=%o resolved=%o',
            note.noteId,
            asset,
            !!resolved
          );
        } catch (error) {
          logger.warn(
            'Failed to resolve asset for noteId=%s asset=%o: %o',
            note.noteId,
            asset,
            error
          );
          failures.push({
            noteId: note.noteId,
            asset,
            reason: 'resolve-error',
            error,
          });
        }
      }
    }

    if (collected.length === 0 && failures.length > 0) {
      logger.info(
        'No assets resolved, but failures occurred: %d failures',
        failures.length
      );
      return {
        type: 'success',
        publishedAssetsCount: 0,
        failures,
      };
    }

    progress?.start(totalAssets);
    logger.info('Publishing %d assets...', collected.length);

    let publishedAssetsCount = 0;

    try {
      // 2. Upload all resolved assets
      for (const entry of collected) {
        if (!entry.resolved) {
          logger.warn(
            'Asset not found for noteId=%s asset=%o',
            entry.noteId,
            entry.asset
          );
          failures.push({
            noteId: entry.noteId,
            asset: entry.asset,
            reason: 'not-found',
          });
          progress?.advance(1);
          continue;
        }
        try {
          logger.debug(
            'Uploading asset for noteId=%s asset=%o',
            entry.noteId,
            entry.asset
          );
          await this.assetsUploaderPort.upload([entry.resolved]);
          publishedAssetsCount += 1;
          logger.info(
            'Successfully uploaded asset for noteId=%s asset=%o',
            entry.noteId,
            entry.asset
          );
        } catch (error) {
          logger.error(
            'Failed to upload asset for noteId=%s asset=%o: %o',
            entry.noteId,
            entry.asset,
            error
          );
          failures.push({
            noteId: entry.noteId,
            asset: entry.asset,
            reason: 'upload-error',
            error,
          });
        }
        progress?.advance(1);
      }

      progress?.finish();
      logger.info(
        'Asset publication finished: %d assets published, %d failures',
        publishedAssetsCount,
        failures.length
      );
      return {
        type: 'success',
        publishedAssetsCount,
        failures,
      };
    } catch (error) {
      progress?.finish();
      logger.error('Unexpected error during asset publication: %o', error);
      return { type: 'error', error };
    }
  }
}
