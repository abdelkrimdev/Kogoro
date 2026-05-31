export interface ProgressEvent {
  completed: number;
  total: number;
  file: string;
  status: string;
}

export interface TaskContext {
  progress: (p: ProgressEvent) => void;
  log: (msg: string) => void;
  error: (msg: string) => void;
  abortSignal?: AbortSignal;
}

export interface ProgressTracker {
  ctx: TaskContext;
  start(msg: string): void;
  stop(msg?: string): void;
}

export interface ProgressTrackerOptions {
  verbose?: boolean;
  quiet?: boolean;
  abortSignal?: AbortSignal;
}
