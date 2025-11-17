import type { DomainFrontmatter } from '../domain/DomainFrontmatter.js';
import type { InlineDataviewExpression } from '../domain/InlineDataviewExpression.js';
import type { PublishableNote } from '../domain/PublishableNote.js';

const INLINE_CODE_REGEX = /`([^`]*?)`/g;

function getValueFromFrontmatter(
  frontmatter: DomainFrontmatter,
  propertyPath: string
): unknown {
  const segments = propertyPath.split('.').filter(Boolean);
  let current: any = frontmatter.nested;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value.map((v) => String(v)).join(', ');
  }

  return String(value);
}

export class RenderInlineDataviewUseCase {
  execute(note: PublishableNote): PublishableNote {
    const { content, frontmatter } = note;

    const expressions: InlineDataviewExpression[] = [];

    const renderedMarkdown = content.replace(
      INLINE_CODE_REGEX,
      (fullMatch: string, innerCode: string) => {
        const codeRaw = innerCode;
        const trimmed = codeRaw.trim();

        if (!trimmed.startsWith('=')) {
          return fullMatch;
        }

        const expr = trimmed.slice(1).trim(); // "this.titres"
        const THIS_PREFIX = 'this.';

        if (!expr.startsWith(THIS_PREFIX)) {
          return fullMatch;
        }

        const propertyPath = expr.slice(THIS_PREFIX.length).trim();
        if (!propertyPath) {
          return fullMatch;
        }

        const resolvedValue = getValueFromFrontmatter(
          frontmatter,
          propertyPath
        );
        const renderedText = renderValue(resolvedValue);

        expressions.push({
          raw: fullMatch,
          code: codeRaw,
          expression: expr,
          propertyPath,
          resolvedValue,
          renderedText,
        });

        return renderedText;
      }
    );

    return {
      ...note,
      content: renderedMarkdown,
    };
  }
}
