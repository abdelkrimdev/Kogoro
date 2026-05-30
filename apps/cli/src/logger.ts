export type LogLevel = "error" | "info" | "debug";

export interface Logger {
  info(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  progress(msg: string): void;
}

export function createLogger(
  level: LogLevel,
  write: (msg: string) => void = (msg: string) => process.stderr.write(`${msg}\n`),
): Logger {
  return {
    info(msg: string) {
      if (level !== "error") write(`[kogoro] ${msg}`);
    },
    error(msg: string) {
      write(`[kogoro] ${msg}`);
    },
    debug(msg: string) {
      if (level === "debug") write(`[kogoro:debug] ${msg}`);
    },
    progress(msg: string) {
      if (level !== "error") write(msg);
    },
  };
}
