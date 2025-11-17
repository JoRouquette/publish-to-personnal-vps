import type { AssetRef } from '../domain/AssetRef.js';
import { NoteWithAssets } from '../domain/NoteWithAssets.js';
import { ResolvedAssetFile } from '../domain/ResolvedAssetFile.js';
import type { UploaderPort } from '../ports/uploader-port.js';
import type { AssetsVaultPort } from '../ports/assets-vault-port.js';
import type { ProgressPort } from '../ports/progress-port.js';

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
    private readonly assetsUploaderPort: UploaderPort
  ) {}

  async execute(params: {
    notes: NoteWithAssets[];
    assetsFolder: string;
    enableAssetsVaultFallback: boolean;
    progress?: ProgressPort;
  }): Promise<AssetsPublicationResult> {
    const { notes, assetsFolder, enableAssetsVaultFallback, progress } = params;

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
      return { type: 'noAssets' };
    }

    let totalAssets = 0;
    for (const note of notesWithAssets) {
      for (const asset of note.assets ?? []) {
        try {
          const resolved = await this.assetsVaultPort.resolveAssetForNote(
            note,
            asset,
            assetsFolder,
            enableAssetsVaultFallback
          );
          collected.push({ noteId: note.noteId, asset, resolved });
          totalAssets += 1;
        } catch (error) {
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
      return {
        type: 'success',
        publishedAssetsCount: 0,
        failures,
      };
    }

    progress?.start(totalAssets);

    let publishedAssetsCount = 0;

    try {
      // 2. Upload all resolved assets
      for (const entry of collected) {
        if (!entry.resolved) {
          failures.push({
            noteId: entry.noteId,
            asset: entry.asset,
            reason: 'not-found',
          });
          progress?.advance(1);
          continue;
        }
        try {
          await this.assetsUploaderPort.upload([entry.resolved]);
          publishedAssetsCount += 1;
        } catch (error) {
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
      return {
        type: 'success',
        publishedAssetsCount,
        failures,
      };
    } catch (error) {
      progress?.finish();
      return { type: 'error', error };
    }
  }
}
