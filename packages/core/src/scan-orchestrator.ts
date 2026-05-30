import { randomUUID } from "node:crypto";
import { aggregateReviewPlan } from "./rename-plan-aggregator";
import type { ReviewPlan, ScanFileStatus, ScanSummary } from "./scan-types";
import type { ScanResult } from "./scanner";

export type ScanState = "idle" | "scan" | "plan" | "review" | "execute" | "done";

export type ScanEventType =
  | "scanProgress"
  | "scanPhaseComplete"
  | "scanReviewReady"
  | "scanExecutionProgress"
  | "scanComplete";

export interface ScanProgressEvent {
  type: "scanProgress";
  sessionId: string;
  file: string;
  status: ScanFileStatus;
  matched: boolean;
  completed: number;
  total: number;
}

export interface ScanPhaseCompleteEvent {
  type: "scanPhaseComplete";
  sessionId: string;
  phase: ScanState;
  summary: ScanSummary;
}

export interface ScanReviewReadyEvent {
  type: "scanReviewReady";
  sessionId: string;
  plan: ReviewPlan;
}

export interface ScanExecutionProgressEvent {
  type: "scanExecutionProgress";
  sessionId: string;
  completed: number;
  total: number;
  file: string;
  status: ScanFileStatus;
}

export interface ScanCompleteEvent {
  type: "scanComplete";
  sessionId: string;
  summary: ScanSummary;
}

export type ScanEvent =
  | ScanProgressEvent
  | ScanPhaseCompleteEvent
  | ScanReviewReadyEvent
  | ScanExecutionProgressEvent
  | ScanCompleteEvent;

type ScanEventListener = (event: ScanEvent) => void;

export interface ScanOrchestratorOptions {
  scanner: {
    match(parsed: unknown): Promise<unknown[]>;
    matchBatch?(parsed: unknown[]): Promise<unknown[]>;
  };
  walk: (path: string, options?: { extensions?: readonly string[] }) => Promise<string[]>;
  scanFile: (
    filePath: string,
    options?: { dryRun?: boolean; force?: boolean; extensions?: readonly string[] },
    index?: number,
  ) => Promise<ScanResult>;
  executeRename?: (
    plan: NonNullable<ScanResult["plan"]>,
    baseDir: string,
  ) => Promise<{ success: boolean; error?: { type: string; message: string } }>;
}

function buildSummary(
  sessionId: string,
  results: ScanResult[],
  renameResults: Map<string, { success: boolean }>,
): ScanSummary {
  let renamed = 0;
  let renameFailed = 0;

  for (const [, result] of renameResults) {
    if (result.success) renamed++;
    else renameFailed++;
  }

  return {
    sessionId,
    totalFiles: results.length,
    matched: results.filter((r) => r.status === "matched").length,
    cached: results.filter((r) => r.status === "cached").length,
    ambiguous: results.filter((r) => r.status === "ambiguous").length,
    failed: results.filter((r) => r.status === "failed").length,
    renamed,
    renameFailed,
  };
}

export class ScanOrchestrator {
  private _state: ScanState = "idle" as ScanState;
  private sessionId: string = "";
  private results: ScanResult[] = [];
  private plan: ReviewPlan | null = null;
  private listeners: ScanEventListener[] = [];
  private options: ScanOrchestratorOptions;

  constructor(options: ScanOrchestratorOptions) {
    this.options = options;
  }

  private getStateNow(): ScanState {
    return this._state as ScanState;
  }

  private isDone(): boolean {
    return this.getStateNow() === "done";
  }

  getState(): ScanState {
    return this.getStateNow();
  }

  on(_event: ScanEventType | "*", listener: ScanEventListener): void {
    this.listeners.push(listener);
  }

  private emit(event: ScanEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private makeSummary(renameResults?: Map<string, { success: boolean }>): ScanSummary {
    return buildSummary(this.sessionId, this.results, renameResults ?? new Map());
  }

  async startScan(path: string): Promise<void> {
    if (this._state !== "idle" && this._state !== "done") {
      throw new Error("Scan already running");
    }

    this.sessionId = randomUUID();
    this.results = [];
    this.plan = null;
    this._state = "scan";

    const filePaths = await this.options.walk(path);

    for (let i = 0; i < filePaths.length; i++) {
      if ((this._state as ScanState) === "done") break;

      const filePath = filePaths[i];
      if (filePath === undefined) continue;
      const result = await this.options.scanFile(filePath, { dryRun: true }, i);
      this.results.push(result);

      this.emit({
        type: "scanProgress",
        sessionId: this.sessionId,
        file: filePath,
        status: result.status as ScanFileStatus,
        matched: result.status === "matched" || result.status === "cached",
        completed: this.results.length,
        total: filePaths.length,
      });
    }

    if (this.isDone()) return;

    this._state = "plan";

    this.emit({
      type: "scanPhaseComplete",
      sessionId: this.sessionId,
      phase: "plan",
      summary: this.makeSummary(),
    });

    this.plan = aggregateReviewPlan(this.results, this.sessionId);
    this._state = "review";

    this.emit({
      type: "scanPhaseComplete",
      sessionId: this.sessionId,
      phase: "review",
      summary: this.makeSummary(),
    });

    this.emit({
      type: "scanReviewReady",
      sessionId: this.sessionId,
      plan: this.plan,
    });
  }

  async approvePlan(): Promise<void> {
    if (this._state !== "review") {
      throw new Error("Cannot approve: not in review state");
    }
    await this.executeApproved();
  }

  rejectPlan(): void {
    if (this._state !== "review") {
      throw new Error("Cannot reject: not in review state");
    }
    this.finish(this.makeSummary());
  }

  cancel(): void {
    if (this._state === "idle" || this.isDone()) {
      throw new Error("Cannot cancel: not running");
    }
    this.finish(this.makeSummary());
  }

  private async executeApproved(): Promise<void> {
    this._state = "execute";

    const filesToRename = this.results.filter(
      (r): r is ScanResult & { plan: NonNullable<ScanResult["plan"]> } => r.plan !== null,
    );
    const renameResults = new Map<string, { success: boolean }>();

    for (let i = 0; i < filesToRename.length; i++) {
      if (this.isDone()) break;

      const result = filesToRename[i];
      if (result === undefined) continue;
      const plan = result.plan;

      let renameResult: { success: boolean; error?: { type: string; message: string } };
      if (this.options.executeRename) {
        const baseDir = plan.sourcePath.substring(0, plan.sourcePath.lastIndexOf("/"));
        renameResult = await this.options.executeRename(plan, baseDir);
      } else {
        renameResult = { success: true };
      }

      renameResults.set(result.file, renameResult);

      this.emit({
        type: "scanExecutionProgress",
        sessionId: this.sessionId,
        completed: i + 1,
        total: filesToRename.length,
        file: result.file,
        status: renameResult.success ? "renamed" : "rename-failed",
      });
    }

    this.finish(this.makeSummary(renameResults));
  }

  private finish(summary: ScanSummary): void {
    this._state = "done";
    this.emit({
      type: "scanComplete",
      sessionId: this.sessionId,
      summary,
    });
  }
}
