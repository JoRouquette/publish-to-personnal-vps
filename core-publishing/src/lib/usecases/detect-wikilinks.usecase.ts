import { PublishableNote } from '../domain';
import type { WikilinkKind, WikilinkRef } from '../domain/WikilinkRef';

/**
 * Regex pour capturer les wikilinks [[...]].
 * On filtrera les cas précédés par "!" pour exclure les embeds d'assets.
 */
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

function inferKind(path: string): WikilinkKind {
  const lower = path.toLowerCase();

  // Heuristique très simple : si ça ressemble à un fichier, on marque "file".
  if (
    lower.match(
      /\.(png|jpe?g|gif|webp|svg|mp3|wav|flac|ogg|mp4|webm|mkv|mov|pdf|md|markdown)$/
    )
  ) {
    return 'file';
  }

  return 'note';
}

function splitOnce(
  input: string,
  separator: string
): [string, string | undefined] {
  const index = input.indexOf(separator);
  if (index === -1) return [input, undefined];
  return [input.slice(0, index), input.slice(index + separator.length)];
}

export class DetectWikilinksUseCase {
  execute(note: PublishableNote): PublishableNote {
    const markdown = note.content;
    const wikilinks: WikilinkRef[] = [];

    let match: RegExpExecArray | null;

    while ((match = WIKILINK_REGEX.exec(markdown)) !== null) {
      const fullMatch = match[0]; // "[[...]]"
      const inner = match[1].trim();
      if (!inner) continue;

      const startIndex = match.index ?? 0;
      // Exclure les "![[...]]" (assets) en vérifiant le caractère précédent
      if (startIndex > 0 && markdown[startIndex - 1] === '!') {
        continue;
      }

      // 1) Séparer cible et alias : "cible|alias"
      const [targetPart, aliasPart] = splitOnce(inner, '|');
      const targetRaw = targetPart.trim();
      const alias =
        aliasPart && aliasPart.trim().length > 0 ? aliasPart.trim() : undefined;

      if (!targetRaw) continue;

      // 2) Séparer path et subpath : "path#subpath"
      const [pathPart, subpathPart] = splitOnce(targetRaw, '#');
      const path = pathPart.trim();
      const subpath =
        subpathPart && subpathPart.trim().length > 0
          ? subpathPart.trim()
          : undefined;

      if (!path) continue;

      const kind = inferKind(path);

      const wikilink: WikilinkRef = {
        raw: fullMatch,
        target: targetRaw,
        path,
        subpath,
        alias,
        kind,
      };

      wikilinks.push(wikilink);
    }

    if (wikilinks.length === 0) {
      return note;
    }

    return {
      ...note,
      wikilinks,
    };
  }
}
