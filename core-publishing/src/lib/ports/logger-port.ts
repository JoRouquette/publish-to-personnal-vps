export enum LogLevel {
  debug = 1 << 1,
  info = 1 << 2,
  warn = 1 << 3,
  error = 1 << 4,
  none = 1 << 5,
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
