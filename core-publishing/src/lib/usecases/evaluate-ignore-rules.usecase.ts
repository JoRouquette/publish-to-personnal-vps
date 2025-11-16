import { IgnoreRule } from '../domain';

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

export class EvaluateIgnoreRulesUseCase {
  execute(
    frontmatter: Record<string, unknown>,
    rules: IgnoreRule[] | null
  ): boolean {
    if (!rules || rules.length === 0) return true;
    for (const rule of rules) {
      const value = getNestedValue(frontmatter, rule.property);

      if (typeof rule.ignoreIf === 'boolean' && value === rule.ignoreIf) {
        return false;
      }
      if (rule.ignoreValues?.length) {
        if (rule.ignoreValues.some((v) => v === value)) return false;
      }
    }
    return true;
  }
}
