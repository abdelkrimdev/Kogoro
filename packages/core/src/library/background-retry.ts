import type { AnimeImporter } from "./anime-importer";
import type { LibraryAnime } from "./anime-repository";

export interface BackgroundRetryOptions {
  animeImporter: AnimeImporter;
  isActive: () => boolean;
  intervalMs?: number;
  onResolved?: (resolved: Array<{ id: number; mergedInto?: number }>) => void;
  onError?: (error: Error) => void;
}

export class BackgroundRetryService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly animeImporter: AnimeImporter;
  private readonly isActive: () => boolean;
  private readonly onResolved?: (resolved: Array<{ id: number; mergedInto?: number }>) => void;
  private readonly onError?: (error: Error) => void;

  constructor(options: BackgroundRetryOptions) {
    this.animeImporter = options.animeImporter;
    this.isActive = options.isActive;
    this.intervalMs = options.intervalMs ?? 5 * 60 * 1000; // 5 minutes default
    this.onResolved = options.onResolved;
    this.onError = options.onError;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runRetry().catch(() => {});
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runNow(): Promise<{
    resolved: Array<{ id: number; mergedInto?: number }>;
    stillPending: LibraryAnime[];
  } | null> {
    return this.runRetry();
  }

  private async runRetry(): Promise<{
    resolved: Array<{ id: number; mergedInto?: number }>;
    stillPending: LibraryAnime[];
  } | null> {
    if (this.running) return null;
    if (this.isActive()) return null;

    this.running = true;
    try {
      const result = await this.animeImporter.retryPendingIdentification();
      if (result.resolved.length > 0 && this.onResolved) {
        this.onResolved(result.resolved);
      }
      return result;
    } catch (error) {
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
      return null;
    } finally {
      this.running = false;
    }
  }
}
