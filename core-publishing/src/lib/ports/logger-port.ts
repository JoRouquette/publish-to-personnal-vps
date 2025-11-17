export interface LoggerPort {
  set level(level: 'debug' | 'info' | 'warn' | 'error');

  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;

  child: (context: Record<string, unknown>) => LoggerPort;
}
