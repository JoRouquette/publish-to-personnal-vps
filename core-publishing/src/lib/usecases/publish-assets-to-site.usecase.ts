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
  private readonly _logger: LoggerPort;

  constructor(
    private readonly assetsVaultPort: AssetsVaultPort,
    private readonly assetsUploaderPort: UploaderPort,
    logger: LoggerPort
  ) {
    this._logger = logger;
  }

  async execute(params: {
    notes: NoteWithAssets[];
    assetsFolder: string;
    enableAssetsVaultFallback: boolean;
    progress?: ProgressPort;
  }): Promise<AssetsPublicationResult> {
    const { notes, assetsFolder, enableAssetsVaultFallback, progress } = params;

    this._logger.info(
      `Starting asset publication for ${notes.length} notes (assetsFolder=${assetsFolder}, enableAssetsVaultFallback=${enableAssetsVaultFallback})`
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
      this._logger.info('No notes with assets found, nothing to publish.');
      return { type: 'noAssets' };
    }

    let totalAssets = 0;
    for (const note of notesWithAssets) {
      for (const asset of note.assets ?? []) {
        try {
          this._logger.debug(
            `Resolving asset for noteId ${note.noteId}`,
            'asset=',
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
          this._logger.debug(
            `Resolved asset for noteId ${note.noteId}`,
            'asset=',
            asset,
            `resolved= `,
            !!resolved
          );
        } catch (error) {
          this._logger.warn(
            `Failed to resolve asset for noteId ${note.noteId} asset= ${asset}: `,
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
      this._logger.info(
        `No assets resolved, but failures occurred: ${failures.length} failures`
      );
      return {
        type: 'success',
        publishedAssetsCount: 0,
        failures,
      };
    }

    progress?.start(totalAssets);
    this._logger.info(`Publishing ${totalAssets} assets...`);

    let publishedAssetsCount = 0;

    try {
      // 2. Upload all resolved assets
      for (const entry of collected) {
        if (!entry.resolved) {
          this._logger.warn(
            `Asset not found for noteId ${entry.noteId} asset= ${entry.asset}`
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
          this._logger.debug(
            `Uploading asset for noteId ${entry.noteId} asset= ${entry.asset}`
          );
          await this.assetsUploaderPort.upload([entry.resolved]);
          publishedAssetsCount += 1;
          this._logger.info(
            `Successfully uploaded asset for noteId ${entry.noteId} asset= ${entry.asset}`
          );
        } catch (error) {
          this._logger.error(
            `Failed to upload asset for noteId ${entry.noteId} asset= ${entry.asset}: `,
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
      this._logger.info(
        `Asset publication finished: ${publishedAssetsCount} assets published, ${failures.length} failures`
      );
      return {
        type: 'success',
        publishedAssetsCount,
        failures,
      };
    } catch (error) {
      progress?.finish();
      this._logger.error('Unexpected error during asset publication: ', error);
      return { type: 'error', error };
    }
  }
}
