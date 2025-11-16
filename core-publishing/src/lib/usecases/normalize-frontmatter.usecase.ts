// core-publishing/src/lib/usecases/normalize-frontmatter.usecase.ts
import type { RawFrontmatter } from '../domain/RawFrontmatter';
import type { DomainFrontmatter } from '../domain/DomainFrontmatter';

function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const segments = path.split('.');
  let current: any = target;

  for (let i = 0; i < segments.length; i++) {
    const key = segments[i];
    const isLast = i === segments.length - 1;

    if (isLast) {
      current[key] = value;
      return;
    }

    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
}

export interface NormalizeFrontmatterInput {
  raw: RawFrontmatter | undefined;
}

export class NormalizeFrontmatterUseCase {
  execute(input: NormalizeFrontmatterInput): DomainFrontmatter {
    const flat: RawFrontmatter = input.raw ? { ...input.raw } : {};
    const nested: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(flat)) {
      if (key.includes('.')) {
        // POO : relation.parents, culte.pratiques, etc.
        setNestedValue(nested, key, value);
      } else {
        nested[key] = value;
      }
    }

    return { flat, nested };
  }
}
