import type { DomainFrontmatter } from '../domain/DomainFrontmatter';
import { LoggerPort } from '../ports/logger-port';

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

export class NormalizeFrontmatterUseCase {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ useCase: 'NormalizeFrontmatterUseCase' });
  }

  execute(input?: Record<string, unknown>): DomainFrontmatter {
    if (!input) {
      return { flat: {}, nested: {} };
    }

    const flat: Record<string, unknown> = { ...input };
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
