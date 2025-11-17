import { LoggerPort } from 'core-publishing/src/lib/ports/logger-port';

enum LogLevel {
  debug = 1 << 1,
  info = 1 << 2,
  warn = 1 << 3,
  error = 1 << 4,
  none = 1 << 5,
}

export class ConsoleLoggerAdapter implements LoggerPort {
  private _level?: LogLevel;

  constructor(private context: Record<string, unknown>) {
    this._level = LogLevel.none;
  }

  public set level(level: 'debug' | 'info' | 'warn' | 'error') {
    switch (level) {
      case 'debug':
        this._level =
          LogLevel.debug + LogLevel.info + LogLevel.warn + LogLevel.error;
        break;
      case 'info':
        this._level = LogLevel.info + LogLevel.warn + LogLevel.error;
        break;
      case 'warn':
        this._level = LogLevel.warn + LogLevel.error;
        break;
      case 'error':
        this._level = LogLevel.error;
        break;
      default:
        this._level = LogLevel.none;
        break;
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this._level && (this._level & LogLevel.debug) === 0) {
      return;
    }

    console.debug(Date.now(), this.context, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    if (this._level && (this._level & LogLevel.info) === 0) {
      return;
    }

    console.info(Date.now(), this.context, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (this._level && (this._level & LogLevel.warn) === 0) {
      return;
    }

    console.warn(Date.now(), this.context, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    if (this._level && (this._level & LogLevel.error) === 0) {
      return;
    }

    console.error(Date.now(), this.context, message, ...args);
  }

  child: (context: Record<string, unknown>) => ConsoleLoggerAdapter = (
    context: Record<string, unknown>
  ): ConsoleLoggerAdapter => {
    return new ConsoleLoggerAdapter({ ...this.context, ...context });
  };
}
