import type { DomainFrontmatter } from '../domain/DomainFrontmatter';
import { IgnorePrimitive } from '../domain/IgnorePrimitive';
import type { IgnoreRule } from '../domain/IgnoreRule';
import type { NoteEligibility } from '../domain/NoteEligibility';

export interface EvaluateIgnoreRulesInput {
  frontmatter: DomainFrontmatter;
  rules: IgnoreRule[] | null | undefined;
}

/**
 * Récupère une valeur dans un objet imbriqué à partir d'un chemin en dot-notation.
 * ex:
 *  path: "relation.parents" -> source.relation.parents
 */
function getNestedValue(
  source: Record<string, unknown>,
  path: string
): unknown {
  if (!path.includes('.')) {
    return source[path];
  }

  const segments = path.split('.');
  let current: any = source;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Compare une valeur quelconque (unknown) à une valeur primitive d'ignore.
 * On reste sur une égalité stricte, sans coercition.
 */
function isEqualPrimitive(value: unknown, target: IgnorePrimitive): boolean {
  return value === target;
}

/**
 * Retourne la valeur de target qui matche, ou undefined si aucun match.
 * - value peut être un primitif ou un tableau de primitifs.
 */
function matchesAnyPrimitive(
  value: unknown,
  targets: IgnorePrimitive[]
): IgnorePrimitive | undefined {
  if (targets.length === 0) return undefined;

  if (Array.isArray(value)) {
    for (const item of value) {
      for (const t of targets) {
        if (isEqualPrimitive(item, t)) {
          return t;
        }
      }
    }
    return undefined;
  }

  for (const t of targets) {
    if (isEqualPrimitive(value, t)) {
      return t;
    }
  }

  return undefined;
}

export class EvaluateIgnoreRulesUseCase {
  execute(input: EvaluateIgnoreRulesInput): NoteEligibility {
    const { frontmatter, rules } = input;

    if (!rules || rules.length === 0) {
      return { isPublishable: true };
    }

    const nested = frontmatter.nested;

    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      const value = getNestedValue(nested, rule.property);

      if (value === undefined) {
        // La propriété n'existe pas : la règle ne s'applique pas.
        continue;
      }

      // 1) Cas ignoreIf (bool uniquement)
      if (rule.ignoreIf !== undefined) {
        if (typeof value === 'boolean' && value === rule.ignoreIf) {
          return {
            isPublishable: false,
            ignoredByRule: {
              property: rule.property,
              reason: 'ignoreIf',
              matchedValue: rule.ignoreIf, // bool
              ruleIndex: index,
            },
          };
        }
        // Si la valeur n'est pas booléenne, on ignore cette partie de la règle.
      }

      // 2) Cas ignoreValues
      if (rule.ignoreValues && rule.ignoreValues.length > 0) {
        const matched = matchesAnyPrimitive(value, rule.ignoreValues);
        if (matched !== undefined) {
          return {
            isPublishable: false,
            ignoredByRule: {
              property: rule.property,
              reason: 'ignoreValues',
              matchedValue: matched,
              ruleIndex: index,
            },
          };
        }
      }
    }

    // Aucune règle n'a matché : la note est publiable.
    return { isPublishable: true };
  }
}
