import { PublishableNote } from './PublishableNote';
import type { ResolvedWikilink } from './ResolvedWikilink';
import type { WikilinkRef } from './WikilinkRef';

/**
 * Capacité : "has wikilinks (et éventuellement résolus)"
 */

export type NoteWithWikilinks = PublishableNote & {
  wikilinks: WikilinkRef[];
  resolvedWikilinks?: ResolvedWikilink[];
};
