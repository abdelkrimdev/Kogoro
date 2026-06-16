import { basename } from "node:path";
import type { ScanSummary } from "../types";
import type { ScanResult } from "./scanner";

export function buildSummary(
  sessionId: string,
  results: ScanResult[],
  renameResults: Map<string, { success: boolean; error?: string }>,
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
  const renameFailures: Array<{ file: string; reason: string }> = [];

  for (const [file, result] of renameResults) {
    if (result.success) renamed++;
    else {
      renameFailed++;
      renameFailures.push({
        file: basename(file),
        reason: result.error ?? "Unknown error",
      });
    }
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
    renameFailures,
  };
}
