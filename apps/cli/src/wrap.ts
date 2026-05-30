interface WrapCommandOptions {
  stdout?: (msg: string) => void;
  stderr?: (msg: string) => void;
  exit?: (code: number) => void;
  getExitCode?: (result: unknown) => number;
  redirectStdout?: boolean;
}

export async function wrapCommand(
  handler: () => Promise<unknown>,
  options: WrapCommandOptions = {},
): Promise<void> {
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const exit = options.exit ?? process.exit;
  const getExitCode = options.getExitCode;

  const run = options.redirectStdout ? () => withStdoutRedirected(handler) : handler;

  try {
    const result = await run();
    stdout(JSON.stringify(result));
    if (getExitCode) {
      const code = getExitCode(result);
      if (code !== 0) {
        exit(code);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr(JSON.stringify({ error: message }));
    exit(1);
  }
}

async function withStdoutRedirected<T>(fn: () => Promise<T>): Promise<T> {
  const origWrite = process.stdout.write;
  process.stdout.write = process.stderr.write as typeof process.stdout.write;
  try {
    return await fn();
  } finally {
    process.stdout.write = origWrite;
  }
}
