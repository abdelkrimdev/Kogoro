import { randomUUID } from "node:crypto";
import type { AnimeGroup, ReviewPlan, ScanFileStatus, ScanSummary } from "../types";
import { aggregateReviewPlan } from "./rename-plan-aggregator";
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
  resolveFile?: (filePath: string, animeId: string, episodeId: string) => Promise<ScanResult>;
}

function buildSummary(
  sessionId: string,
  results: ScanResult[],
  renameResults: Map<string, { success: boolean }>,
): ScanSummary {
  let matched = 0;
  let cached = 0;
  let ambiguous = 0;
  let failed = 0;

  for (const r of results) {
    switch (r.status) {
      case "matched":
        matched++;
        break;
      case "cached":
        cached++;
        break;
      case "ambiguous":
        ambiguous++;
        break;
      case "failed":
        failed++;
        break;
    }
  }

  let renamed = 0;
  let renameFailed = 0;

  for (const [, result] of renameResults) {
    if (result.success) renamed++;
    else renameFailed++;
  }

  return {
    sessionId,
    totalFiles: results.length,
    matched,
    cached,
    ambiguous,
    failed,
    renamed,
    renameFailed,
  };
}

export class ScanOrchestrator {
  private _state: ScanState = "idle";
  private sessionId: string = "";
  private results: ScanResult[] = [];
  private plan: ReviewPlan | null = null;
  private listeners: ScanEventListener[] = [];
  private options: ScanOrchestratorOptions;
  private approvedAnimeIds: Set<string> = new Set();
  private rejectedAnimeIds: Set<string> = new Set();

  constructor(options: ScanOrchestratorOptions) {
    this.options = options;
  }

  private isDone(): boolean {
    return this._state === "done";
  }

  getState(): ScanState {
    return this._state;
  }

  getPlan(): ReviewPlan | null {
    return this.plan;
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
      if (this.isDone()) break;

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

  approveGroup(animeId: string): void {
    if (this._state !== "review") {
      throw new Error("Cannot approve group: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot approve group: no plan available");
    }

    let found = false;
    for (const group of this.plan.groups) {
      if (group.animeId === animeId) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`Anime group not found: ${animeId}`);
    }

    this.approvedAnimeIds.add(animeId);
    this.rejectedAnimeIds.delete(animeId);

    for (const group of this.plan.groups) {
      if (group.animeId === animeId) {
        group.rejected = false;
      }
    }

    this.emit({
      type: "scanReviewReady",
      sessionId: this.sessionId,
      plan: this.plan,
    });
  }

  rejectGroup(animeId: string): void {
    if (this._state !== "review") {
      throw new Error("Cannot reject group: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot reject group: no plan available");
    }

    let found = false;
    for (const group of this.plan.groups) {
      if (group.animeId === animeId) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`Anime group not found: ${animeId}`);
    }

    this.rejectedAnimeIds.add(animeId);
    this.approvedAnimeIds.delete(animeId);

    for (const group of this.plan.groups) {
      if (group.animeId === animeId) {
        group.rejected = true;
      }
    }

    this.emit({
      type: "scanReviewReady",
      sessionId: this.sessionId,
      plan: this.plan,
    });
  }

  swapFiles(fileAId: string, fileBId: string): void {
    if (this._state !== "review") {
      throw new Error("Cannot swap: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot swap: no plan available");
    }

    let targetGroup: AnimeGroup | null = null;
    for (const group of this.plan.groups) {
      const hasA = group.files.some((f) => f.fileId === fileAId);
      const hasB = group.files.some((f) => f.fileId === fileBId);
      if (hasA && hasB) {
        targetGroup = group;
        break;
      }
    }

    if (!targetGroup) {
      throw new Error("Cannot swap: files not in same group");
    }

    const fileA = targetGroup.files.find((f) => f.fileId === fileAId);
    const fileB = targetGroup.files.find((f) => f.fileId === fileBId);

    if (!fileA || !fileB) {
      throw new Error("Cannot swap: file not found");
    }

    const tempPath = fileA.proposedPath;
    fileA.proposedPath = fileB.proposedPath;
    fileB.proposedPath = tempPath;

    const tempEpisodeId = fileA.episodeId;
    fileA.episodeId = fileB.episodeId;
    fileB.episodeId = tempEpisodeId;

    const tempEpisode = fileA.episode;
    fileA.episode = fileB.episode;
    fileB.episode = tempEpisode;

    this.emit({
      type: "scanReviewReady",
      sessionId: this.sessionId,
      plan: this.plan,
    });
  }

  cancel(): void {
    if (this._state === "idle" || this.isDone()) {
      throw new Error("Cannot cancel: not running");
    }
    this.finish(this.makeSummary());
  }

  async resolveMatch(fileId: string, animeId: string, episodeId: string): Promise<void> {
    if (this._state !== "review") {
      throw new Error("Cannot resolve: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot resolve: no plan available");
    }

    let sourcePath: string | null = null;
    for (const group of this.plan.groups) {
      for (const file of group.files) {
        if (file.fileId === fileId) {
          sourcePath = file.sourcePath;
          break;
        }
      }
      if (sourcePath) break;
    }

    if (!sourcePath) {
      throw new Error("Cannot resolve: file not found");
    }

    if (!this.options.resolveFile) {
      throw new Error("Cannot resolve: resolve not available");
    }

    const resultIndex = this.results.findIndex((r) => r.file === sourcePath);
    if (resultIndex === -1) {
      throw new Error("Cannot resolve: file not found");
    }

    const resolved = await this.options.resolveFile(sourcePath, animeId, episodeId);
    this.results[resultIndex] = resolved;
    this.plan = aggregateReviewPlan(this.results, this.sessionId);

    this.emit({
      type: "scanReviewReady",
      sessionId: this.sessionId,
      plan: this.plan,
    });
  }

  private async executeApproved(): Promise<void> {
    this._state = "execute";

    const filesToRename = this.results.filter(
      (r): r is ScanResult & { plan: NonNullable<ScanResult["plan"]> } => {
        if (!r.plan) return false;

        const animeId = r.match?.anime.id;
        if (!animeId) return false;

        if (this.approvedAnimeIds.has(animeId)) return true;
        if (this.rejectedAnimeIds.has(animeId)) return false;
        if (this.approvedAnimeIds.size > 0) return false;
        return true;
      },
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
