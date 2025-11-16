import type { PublishableNote } from './PublishableNote';
import type { SanitizationRules } from './SanitizationRules';

export interface ContentSanitizer {
  sanitize(content: string, rules: SanitizationRules | undefined): string;
  sanitizeNote(
    note: PublishableNote,
    rules: SanitizationRules | undefined
  ): PublishableNote;
}
