// core-publishing/src/lib/domain/services/default-content-sanitizer.ts
import type { ContentSanitizer } from '../ContentSanitizer.js';
import type { PublishableNote } from '../PublishableNote.js';
import type { SanitizationRules } from '../SanitizationRules.js';
import { SanitizeMarkdownUseCase } from '../../usecases/sanitize-markdown.usecase.js';

export class DefaultContentSanitizer implements ContentSanitizer {
  private readonly sanitizeMarkdown = new SanitizeMarkdownUseCase();

  sanitizeNote(
    note: PublishableNote,
    rules: SanitizationRules | null | undefined
  ): PublishableNote {
    if (!rules) {
      return note;
    }

    const { markdown } = this.sanitizeMarkdown.execute(note.content, rules);

    return {
      ...note,
      content: markdown,
    };
  }
}
