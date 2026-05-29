import { log, spinner } from "@clack/prompts";
import type { ProgressTracker, ProgressTrackerOptions, TaskContext } from "@kogoro/core";

export function createProgressTracker(options?: ProgressTrackerOptions): ProgressTracker {
  const abortSignal = options?.abortSignal;

  if (options?.quiet) {
    return {
      ctx: { progress() {}, log() {}, error() {}, abortSignal } as TaskContext,
      start() {},
      stop() {},
    };
  }

  if (options?.verbose) {
    return {
      ctx: {
        progress() {},
        log(msg) {
          log.info(msg);
        },
        error(msg) {
          log.error(msg);
        },
        abortSignal,
      } as TaskContext,
      start() {},
      stop() {},
    };
  }

  // Normal mode — spinner with counter in title
  const s = spinner();
  return {
    ctx: {
      progress(p) {
        s.message(`${p.file} (${p.completed}/${p.total})...`);
      },
      log() {},
      error() {},
      abortSignal,
    } as TaskContext,
    start(msg: string) {
      s.start(msg);
    },
    stop(msg?: string) {
      s.stop(msg ?? "Done");
    },
  };
}
