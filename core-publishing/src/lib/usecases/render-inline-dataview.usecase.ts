import type { DomainFrontmatter } from '../domain/DomainFrontmatter.js';
import type { InlineDataviewExpression } from '../domain/InlineDataviewExpression.js';

export interface RenderInlineDataviewOutput {
  /**
   * Markdown avec les expressions Dataview inline résolues.
   */
  markdown: string;

  /**
   * Détail des expressions traitées (utile pour debug/tests).
   */
  expressions: InlineDataviewExpression[];
}

/**
 * Regex générique pour les inline code en markdown : `...`
 * On filtre derrière ceux qui commencent par "=".
 */
const INLINE_CODE_REGEX = /`([^`]*?)`/g;

/**
 * Récupère une valeur à partir de DomainFrontmatter.nested et d'un chemin de propriété.
 *
 * path: "titres" -> nested["titres"]
 * path: "relation.parents" -> nested["relation"]["parents"]
 */
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

/**
 * Transforme une valeur brute en texte inline pour injection dans le markdown.
 *
 * - Array -> éléments convertis en string puis join(", ")
 * - Primitif -> String(value)
 * - null/undefined -> ""
 * - Objet -> String(value) (comportement générique)
 */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }

  return String(value);
}

export class RenderInlineDataviewUseCase {
  execute(
    markdown: string,
    frontmatter: DomainFrontmatter
  ): RenderInlineDataviewOutput {
    const expressions: InlineDataviewExpression[] = [];

    const renderedMarkdown = markdown.replace(
      INLINE_CODE_REGEX,
      (fullMatch: string, innerCode: string) => {
        const codeRaw = innerCode;
        const trimmed = codeRaw.trim();

        // On ne traite que les inline code qui commencent par "="
        if (!trimmed.startsWith('=')) {
          return fullMatch;
        }

        // On enlève le "=" initial
        const expr = trimmed.slice(1).trim(); // ex: "this.titres"
        const THIS_PREFIX = 'this.';

        if (!expr.startsWith(THIS_PREFIX)) {
          // Pour l'instant, on ne gère que "= this.xxx"
          return fullMatch;
        }

        const propertyPath = expr.slice(THIS_PREFIX.length).trim();
        if (!propertyPath) {
          return fullMatch;
        }

        // Résolution de la valeur dans le frontmatter
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

        // On remplace le inline code complet par le texte rendu
        return renderedText;
      }
    );

    return {
      markdown: renderedMarkdown,
      expressions,
    };
  }
}
