export type StatusKind = "ready" | "active" | "complete";

export function statusKindFor(statusText: string): StatusKind {
  if (statusText === "Ready" || statusText === "Review ready") {
    return "ready";
  }
  if (
    statusText.startsWith("Scanning") ||
    statusText.startsWith("Executing") ||
    statusText.startsWith("Cover art") ||
    statusText.startsWith("Metadata")
  ) {
    return "active";
  }
  if (statusText.startsWith("Complete") || statusText === "Scan complete — review results") {
    return "complete";
  }
  return "ready";
}
