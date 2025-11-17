export enum LogLevel {
  none = 0,
  debug = 1,
  info = 2,
  warn = 4,
  error = 8,
}

export interface LoggerPort {
  set level(level: LogLevel);
  get level(): LogLevel;

  child(context: Record<string, unknown>): LoggerPort;

  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
