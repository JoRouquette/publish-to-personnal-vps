// core-publishing/src/lib/domain/services/content-sanitizer.ts

import type { PublishableNote } from '../PublishableNote';
import type { SanitizationRules } from '../SanitizationRules';

export interface ContentSanitizer {
  sanitize(content: string, rules: SanitizationRules | undefined): string;
  sanitizeNote(
    note: PublishableNote,
    rules: SanitizationRules | undefined
  ): PublishableNote;
}

/**
 * Default implementation of ContentSanitizer.
 * Pure string manipulation, aucun Obsidian / Node / HTTP.
 */
export class DefaultContentSanitizer implements ContentSanitizer {
  sanitize(content: string, rules: SanitizationRules | undefined): string {
    if (!rules) {
      // Pas de règle => contenu inchangé
      return content;
    }

    let result = content;

    if (rules.removeFencedCodeBlocks) {
      const fencedBackticks = /^```[^\n]*\n[\s\S]*?^```[ \t]*\n?/gm;
      const fencedTildes = /^~~~[^\n]*\n[\s\S]*?^~~~[ \t]*\n?/gm;

      result = result.replace(fencedBackticks, '');
      result = result.replace(fencedTildes, '');
    }

    return result;
  }

  sanitizeNote(
    note: PublishableNote,
    rules: SanitizationRules | undefined
  ): PublishableNote {
    const sanitizedContent = this.sanitize(note.content, rules);
    return {
      ...note,
      content: sanitizedContent,
    };
  }
}
