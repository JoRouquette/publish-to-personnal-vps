import {
  LoggerPort,
  LogLevel,
} from 'core-publishing/src/lib/ports/logger-port';

export class ConsoleLoggerAdapter implements LoggerPort {
  private _level: LogLevel = LogLevel.none;
  private _context: Record<string, unknown>;

  constructor(context: Record<string, unknown>, level?: LogLevel) {
    this._context = context;
    this.level = level ?? LogLevel.none;
  }

  public set level(level: LogLevel) {
    switch (level) {
      case LogLevel.debug:
        this._level =
          LogLevel.debug | LogLevel.info | LogLevel.warn | LogLevel.error;
        break;
      case LogLevel.info:
        this._level = LogLevel.info | LogLevel.warn | LogLevel.error;
        break;
      case LogLevel.warn:
        this._level = LogLevel.warn | LogLevel.error;
        break;
      case LogLevel.error:
        this._level = LogLevel.error;
        break;
      default:
        this._level = LogLevel.none;
    }
  }

  public get level(): LogLevel {
    return this._level;
  }

  child(context: Record<string, unknown>): ConsoleLoggerAdapter {
    return new ConsoleLoggerAdapter(
      { ...this._context, ...context },
      this._level
    );
  }

  debug(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.debug) === 0) {
      return;
    }

    console.debug(this.getCurrentDatetime(), this._context, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.info) === 0) {
      return;
    }

    console.info(this.getCurrentDatetime(), this._context, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.warn) === 0) {
      return;
    }

    console.warn(this.getCurrentDatetime(), this._context, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    if ((this._level & LogLevel.error) === 0) {
      return;
    }

    console.error(this.getCurrentDatetime(), this._context, message, ...args);
  }

  private getCurrentDatetime(): string {
    return new Date().toISOString();
  }
}
