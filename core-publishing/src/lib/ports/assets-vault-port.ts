// ports/assets-vault-port.ts
import type { PublishableNote } from '../domain/PublishableNote.js';
import type { AssetRef } from '../domain/AssetRef.js';
import { ResolvedAssetFile } from '../domain/ResolvedAssetFile.js';

export interface AssetsVaultPort {
  resolveAssetForNote(
    note: PublishableNote,
    asset: AssetRef,
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile | null>;
}
