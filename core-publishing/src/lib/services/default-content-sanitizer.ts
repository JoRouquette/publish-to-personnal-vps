import { PublishableNote } from '../domain/PublishableNote';
import { ContentSanitizer } from '../domain/ContentSanitizer';
import { SanitizationRules } from '../domain/SanitizationRules';
import { SanitizeMarkdownUseCase } from '../usecases/sanitize-markdown.usecase';

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
