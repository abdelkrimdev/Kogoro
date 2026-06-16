import { randomUUID } from "node:crypto";
import { lstatSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import type { LibraryService } from "../library/library-service";
import type { CacheService } from "../match/cache-service";
import type { MatcherLike, MatchResult } from "../match/matcher";
import type { ScanStateService } from "../match/scan-state-service";
import type { RenamePlan, Renamer } from "../rename/renamer";
import type { MatchEntry, ReviewPlan, ScanFileStatus, ScanSummary } from "../types";
import { cleanupEmptyDirs } from "./cleanup-dirs";
import { createEventBus, type EventBus } from "./event-bus";
import { createGroupApproval, type GroupApproval } from "./group-approval";
import { probeMatches } from "./match-pipeline";
import { buildMatchResults } from "./match-results";
import {
  aggregateReviewPlan,
  buildCanonicalIdMap,
  type TopCandidate,
} from "./rename-plan-aggregator";
import { findFileSourcePath } from "./resolve-match";
import { buildSummary } from "./scan-summary";
import type { ScanResult } from "./scanner";
import { swapFilesInGroup } from "./swap-files";

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

export interface OrchestratorPipeline {
  scanBatch: (
    filePaths: string[],
    options: { force?: boolean; dryRun?: boolean; extensions?: readonly string[] },
  ) => Promise<ScanResult[]>;
  resolve?: (filePath: string, animeId: string, episodeId: string) => Promise<ScanResult>;
  rename?: (
    plan: NonNullable<ScanResult["plan"]>,
    baseDir: string,
  ) => Promise<{ success: boolean; error?: { type: string; message: string } }>;
  plan?: (filePath: string, match: MatchResult) => RenamePlan | null;
  walk: (path: string, options?: { extensions?: readonly string[] }) => Promise<string[]>;
  topCandidates?: (sourcePath: string) => Promise<TopCandidate[]>;
}

export interface ScanOrchestratorOptions {
  pipeline: OrchestratorPipeline;
  matcher?: MatcherLike;
  renamer?: Renamer;
  libraryService?: LibraryService;
  sourceDb?: string;
  cacheService?: CacheService;
  scanStateService?: ScanStateService;
  force?: boolean;
}

export class ScanOrchestrator {
  private _state: ScanState = "idle";
  private sessionId: string = "";
  private results: ScanResult[] = [];
  private plan: ReviewPlan | null = null;
  private eventBus: EventBus<ScanEvent>;
  private groupApproval: GroupApproval;
  private pipeline: OrchestratorPipeline;
  private options: ScanOrchestratorOptions;
  private initialAmbiguousCount: number | null = null;
  private baseDir: string = "";
  private canonicalIdMap: Map<string, string> = new Map();

  constructor(options: ScanOrchestratorOptions, sessionId?: string) {
    this.pipeline = options.pipeline;
    this.options = options;
    this.sessionId = sessionId ?? "";
    this.eventBus = createEventBus<ScanEvent>();
    this.groupApproval = createGroupApproval();
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

  getMatchResults(): MatchEntry[] {
    return buildMatchResults(
      this.results,
      this.canonicalIdMap,
      this.groupApproval,
      this.options.sourceDb ?? "tvdb",
    );
  }

  createRenamePlan(filePath: string, match: MatchResult): RenamePlan | null {
    if (this.pipeline.plan) {
      return this.pipeline.plan(filePath, match);
    }
    if (this.options.renamer) {
      const extension = filePath.split(".").pop() ?? "mkv";
      return this.options.renamer.plan(filePath, match, extension);
    }
    return null;
  }

  async topCandidates(sourcePath: string): Promise<TopCandidate[]> {
    if (this.pipeline.topCandidates) {
      return this.pipeline.topCandidates(sourcePath);
    }
    if (this.options.matcher) {
      const { best } = await probeMatches(this.options.matcher, sourcePath);
      return best.slice(0, 3).map((m) => ({
        episodeNumber: m.episode?.episode ?? 0,
        title: m.episode?.titleEn ?? "",
      }));
    }
    return [];
  }

  on(event: ScanEventType | "*", listener: ScanEventListener): void {
    this.eventBus.on(event, listener);
  }

  private emit(event: ScanEvent): void {
    this.eventBus.emit(event);
  }

  private emitReviewReady(): void {
    if (!this.plan) return;
    this.emit({
      type: "scanReviewReady",
      sessionId: this.sessionId,
      plan: this.plan,
    });
  }

  private makeSummary(
    renameResults?: Map<string, { success: boolean; error?: string }>,
  ): ScanSummary {
    return buildSummary(this.sessionId, this.results, renameResults ?? new Map());
  }

  private async refreshPlan(): Promise<void> {
    const unorganizedResults = this.results.filter((r) => {
      if (!r.plan) return true;
      return relative(this.baseDir, r.file) !== r.plan.targetPath;
    });
    this.plan = await aggregateReviewPlan(
      unorganizedResults,
      this.sessionId,
      this.options.libraryService,
      this.options.sourceDb,
      this.topCandidates.bind(this),
    );
    if (this.initialAmbiguousCount === null) {
      this.initialAmbiguousCount = this.plan.ambiguousCount;
    }
    this.plan.initialAmbiguousCount = this.initialAmbiguousCount;

    this.canonicalIdMap = buildCanonicalIdMap(this.plan);
  }

  async startScan(path: string): Promise<void> {
    if (this._state !== "idle" && this._state !== "done") {
      throw new Error("Scan already running");
    }

    if (!this.sessionId) {
      this.sessionId = randomUUID();
    }
    this.results = [];
    this.plan = null;
    this.groupApproval.clear();
    this.initialAmbiguousCount = null;
    try {
      this.baseDir = lstatSync(path).isDirectory() ? path : dirname(path);
    } catch {
      this.baseDir = dirname(path);
    }
    this._state = "scan";

    const filePaths = await this.pipeline.walk(path);

    if (this.options.cacheService) {
      this.options.cacheService.purgeStale(filePaths);
    }

    if (this.pipeline.scanBatch) {
      this.results = await this.pipeline.scanBatch(filePaths, {
        force: this.options.force,
        dryRun: true,
      });
      for (let i = 0; i < this.results.length; i++) {
        const result = this.results[i];
        if (result) {
          this.emit({
            type: "scanProgress",
            sessionId: this.sessionId,
            file: result.file,
            status: result.status as ScanFileStatus,
            matched: result.status === "matched" || result.status === "cached",
            completed: i + 1,
            total: this.results.length,
          });
        }
      }
    }

    if (this.isDone()) return;

    this._state = "plan";

    this.emit({
      type: "scanPhaseComplete",
      sessionId: this.sessionId,
      phase: "plan",
      summary: this.makeSummary(),
    });

    await this.refreshPlan();
    this._state = "review";

    this.emit({
      type: "scanPhaseComplete",
      sessionId: this.sessionId,
      phase: "review",
      summary: this.makeSummary(),
    });

    this.emitReviewReady();
  }

  async approvePlan(): Promise<void> {
    if (this._state !== "review") {
      throw new Error("Cannot approve: not in review state");
    }
    await this.executeApproved();
  }

  approveGroup(animeId: string): void {
    if (this._state !== "review") {
      throw new Error("Cannot approve group: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot approve group: no plan available");
    }

    const group = this.plan.groups.find((g) => g.animeId === animeId);
    if (!group) {
      throw new Error(`Anime group not found: ${animeId}`);
    }

    this.groupApproval.approve(animeId);
    group.rejected = false;

    this.emitReviewReady();
  }

  rejectGroup(animeId: string): void {
    if (this._state !== "review") {
      throw new Error("Cannot reject group: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot reject group: no plan available");
    }

    const group = this.plan.groups.find((g) => g.animeId === animeId);
    if (!group) {
      throw new Error(`Anime group not found: ${animeId}`);
    }

    this.groupApproval.reject(animeId);
    group.rejected = true;

    this.emitReviewReady();
  }

  swapFiles(fileAId: string, fileBId: string): void {
    if (this._state !== "review") {
      throw new Error("Cannot swap: not in review state");
    }
    if (!this.plan) {
      throw new Error("Cannot swap: no plan available");
    }

    const swapped = swapFilesInGroup(this.plan.groups, fileAId, fileBId);
    if (!swapped) {
      throw new Error("Cannot swap: files not in same group");
    }

    this.emitReviewReady();
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

    const sourcePath = findFileSourcePath(this.plan.groups, fileId);

    if (!sourcePath) {
      throw new Error("Cannot resolve: file not found");
    }

    const resultIndex = this.results.findIndex((r) => r.file === sourcePath);
    if (resultIndex === -1) {
      throw new Error("Cannot resolve: file not found");
    }

    let resolved: ScanResult;
    if (this.pipeline.resolve) {
      resolved = await this.pipeline.resolve(sourcePath, animeId, episodeId);
    } else if (this.options.matcher && this.options.renamer) {
      const { parsed, best } = await probeMatches(this.options.matcher, sourcePath);
      const chosen = best.find((m) => m.anime.id === animeId && m.episode?.id === episodeId);
      if (!chosen) {
        resolved = {
          file: sourcePath,
          hash: "",
          parsed,
          match: null,
          plan: null,
          cached: false,
          skipped: false,
          status: "failed",
          failureReason: "Selected candidate not found",
        };
      } else {
        const { hashFile } = await import("../io/file-hash");
        const hash = await hashFile(sourcePath);
        const extension = extname(sourcePath).replace(".", "") || "mkv";
        const plan = this.options.renamer.plan(sourcePath, chosen, extension);
        resolved = {
          file: sourcePath,
          hash,
          parsed,
          match: chosen,
          plan,
          cached: false,
          skipped: false,
          status: "matched",
        };
      }
    } else {
      throw new Error("Cannot resolve: resolve not available");
    }

    this.results[resultIndex] = resolved;

    if (this.options.cacheService && resolved.hash && resolved.match) {
      this.options.cacheService.storeMatchFromResult(
        resolved.hash,
        resolved.match,
        this.options.sourceDb ?? "tvdb",
      );
    }

    await this.refreshPlan();

    this.emitReviewReady();
  }

  private shouldExecuteFile(r: ScanResult): boolean {
    if (!r.plan) return false;

    const originalId = r.match?.anime.id;
    if (!originalId) return false;

    return this.groupApproval.shouldExecute(originalId, this.canonicalIdMap);
  }

  private async executeApproved(): Promise<void> {
    this._state = "execute";

    const filesToRename = this.results.filter(
      (r): r is ScanResult & { plan: NonNullable<ScanResult["plan"]> } => this.shouldExecuteFile(r),
    );
    const renameResults = new Map<string, { success: boolean; error?: string }>();

    for (let i = 0; i < filesToRename.length; i++) {
      if (this.isDone()) break;

      const result = filesToRename[i];
      if (result === undefined) continue;
      const plan = result.plan;

      let renameResult: { success: boolean; error?: { type: string; message: string } };
      if (this.pipeline.rename) {
        renameResult = await this.pipeline.rename(plan, this.baseDir);
      } else if (this.options.renamer) {
        const result = this.options.renamer.execute(plan, this.baseDir);
        renameResult = { success: result.success, error: result.error };
      } else {
        renameResult = { success: true };
      }

      renameResults.set(result.file, {
        success: renameResult.success,
        error: renameResult.error?.message,
      });

      if (renameResult.success && this.options.scanStateService) {
        try {
          const targetAbsolute = join(this.baseDir, plan.targetPath);
          this.options.scanStateService.moveRename(result.file, targetAbsolute, result.hash);
        } catch {
          // Target path stat failed — ignore
        }
      }

      this.emit({
        type: "scanExecutionProgress",
        sessionId: this.sessionId,
        completed: i + 1,
        total: filesToRename.length,
        file: result.file,
        status: renameResult.success ? "renamed" : "rename-failed",
      });
    }

    this.runCleanup();
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

  private runCleanup(): void {
    const sourceDirs = new Set<string>();
    for (const result of this.results) {
      if (!result.plan) continue;
      if (result.status !== "matched" && result.status !== "cached") continue;
      const originalId = result.match?.anime.id;
      if (!originalId) continue;
      const canonicalId = this.canonicalIdMap.get(originalId) ?? originalId;
      if (this.groupApproval.isRejected(canonicalId)) continue;
      if (this.groupApproval.hasApprovals && !this.groupApproval.isApproved(canonicalId)) continue;
      sourceDirs.add(dirname(result.plan.sourcePath));
    }

    cleanupEmptyDirs(sourceDirs, this.baseDir);
  }
}
