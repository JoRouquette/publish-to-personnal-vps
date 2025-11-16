import type { AssetRef } from './AssetRef';
import { PublishableNote } from './PublishableNote';

/**
 * Capacité : "has assets"
 */

export type NoteWithAssets = PublishableNote & {
  assets: AssetRef[];
};
