import {
  LoggerPort,
  LogLevel,
} from 'core-publishing/src/lib/ports/logger-port';

export class ConsoleLoggerAdapter implements LoggerPort {
  private _level: LogLevel = LogLevel.none;
  private _context: Record<string, unknown>;

  constructor(context: Record<string, unknown>, level: LogLevel) {
    this._context = context;
    this._level = this.getComposedLevel(level ?? LogLevel.info);
  }

  public set level(level: LogLevel) {
    this._level = this.getComposedLevel(level);
  }

  public get level(): LogLevel {
    return this._level;
  }

  child(context: Record<string, unknown>): this {
    this._context = { ...this._context, ...context };
    return this;
  }

  debug(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.debug) === 0) {
      return;
    }

    console.debug({
      context: this._context,
      datetime: this.getCurrentDatetime(),
      message: message,
      arguments: { ...args },
    });
  }

  info(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.info) === 0) {
      return;
    }

    console.info({
      context: this._context,
      datetime: this.getCurrentDatetime(),
      message: message,
      arguments: { ...args },
    });
  }

  warn(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.warn) === 0) {
      return;
    }

    console.warn({
      context: this._context,
      datetime: this.getCurrentDatetime(),
      message: message,
      arguments: { ...args },
    });
  }

  error(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.error) === 0) {
      return;
    }

    console.error({
      context: this._context,
      datetime: this.getCurrentDatetime(),
      message: message,
      arguments: { ...args },
    });
  }

  private getCurrentDatetime(): string {
    return new Date().toISOString();
  }

  private getComposedLevel(level: LogLevel): LogLevel {
    switch (level) {
      case LogLevel.debug:
        return LogLevel.debug | LogLevel.info | LogLevel.warn | LogLevel.error;

      case LogLevel.info:
        return LogLevel.info | LogLevel.warn | LogLevel.error;

      case LogLevel.warn:
        return LogLevel.warn | LogLevel.error;

      case LogLevel.error:
        return LogLevel.error;

      default:
        return LogLevel.none;
    }
  }
}
