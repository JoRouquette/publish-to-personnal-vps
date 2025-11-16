import { PublishableNote } from '../domain';
import { AssetAlignment } from '../domain/AssetAlignment';
import { AssetDisplayOptions } from '../domain/AssetDisplayOptions';
import { AssetKind } from '../domain/AssetKind';
import { AssetRef } from '../domain/AssetRef';

/**
 * Regex pour capturer les embeds Obsidian : ![[...]]
 * - groupe 1 = contenu interne sans les crochets.
 */
const EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;

function classifyAssetKind(target: string): AssetKind {
  const lower = target.toLowerCase();

  if (lower.match(/\.(png|jpe?g|gif|webp|svg)$/)) return 'image';
  if (lower.match(/\.(mp3|wav|flac|ogg)$/)) return 'audio';
  if (lower.match(/\.(mp4|webm|mkv|mov)$/)) return 'video';
  if (lower.match(/\.pdf$/)) return 'pdf';

  return 'other';
}

function parseAlignment(token: string): AssetAlignment | undefined {
  const lower = token.toLowerCase();
  if (lower === 'left') return 'left';
  if (lower === 'right') return 'right';
  if (lower === 'center' || lower === 'centre') return 'center';
  return undefined;
}

function parseModifiers(tokens: string[]): AssetDisplayOptions {
  let alignment: AssetAlignment | undefined;
  let width: number | undefined;
  const classes: string[] = [];
  const rawModifiers: string[] = [];

  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;

    rawModifiers.push(token);

    // Alignement ITS / CSS-like
    if (!alignment) {
      const a = parseAlignment(token);
      if (a) {
        alignment = a;
        continue;
      }
    }

    // Largeur en pixels : "300"
    if (!width && /^[0-9]+$/.test(token)) {
      width = parseInt(token, 10);
      continue;
    }

    // Le reste : on le traite comme classe CSS / ITS
    classes.push(token);
  }

  return {
    alignment,
    width,
    classes,
    rawModifiers,
  };
}

export class DetectAssetsUseCase {
  execute(note: PublishableNote): PublishableNote {
    const markdown = note.content;
    const assets: AssetRef[] = [];

    let match: RegExpExecArray | null;
    while ((match = EMBED_REGEX.exec(markdown)) !== null) {
      const raw = match[0]; // "![[...]]"
      const inner = match[1].trim(); // contenu interne

      if (!inner) continue;

      const segments = inner
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length === 0) continue;

      const target = segments[0]; // ex: "Tenebra1.jpg"
      const modifierTokens = segments.slice(1);

      const kind = classifyAssetKind(target);
      const display = parseModifiers(modifierTokens);

      if (kind === 'other' && !target.includes('.')) {
        continue;
      }

      assets.push({
        raw,
        target,
        kind,
        display,
      });
    }

    if (assets.length === 0) {
      return note;
    }

    return {
      ...note,
      assets: assets,
    };
  }
}
