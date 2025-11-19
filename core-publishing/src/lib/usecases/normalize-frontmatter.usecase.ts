import type { DomainFrontmatter } from '../domain/DomainFrontmatter';
import { LoggerPort } from '../ports/logger-port';

export class NormalizeFrontmatterUseCase {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ useCase: 'NormalizeFrontmatterUseCase' });
    this._logger.debug('NormalizeFrontmatterUseCase initialized');
  }

  execute(input?: Record<string, unknown>): DomainFrontmatter {
    this._logger.debug('Normalizing frontmatter', { input });
    if (!input) {
      this._logger.error(
        'No frontmatter input provided, returning empty result'
      );
      return { flat: {}, nested: {} };
    }

    const flat: Record<string, unknown> = {};
    const nested: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      this._logger.debug('Processing frontmatter entry', { key, value });
      flat[key] = value;
      if (key.includes('.')) {
        this._logger.debug('Setting nested value', { key, value });
        this.setNestedValue(nested, key, value);
      } else {
        // Only assign if not already set by a dotted key or subkeys
        if (
          typeof nested[key] === 'undefined' ||
          (nested[key] &&
            typeof nested[key] === 'object' &&
            Object.keys(nested[key] as object).length === 0)
        ) {
          nested[key] = value;
        }
      }
    }

    this._logger.debug('Frontmatter normalization result', { flat, nested });
    return { flat, nested };
  }

  private setNestedValue(
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
}
