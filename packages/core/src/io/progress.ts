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
