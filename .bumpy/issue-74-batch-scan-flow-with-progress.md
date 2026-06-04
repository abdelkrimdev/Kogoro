---
"@kogoro/gui": minor
---

Implement batch scanning flow with progress (#74, PRD #68). When Scan Selected is clicked, folders are scanned sequentially with a global progress bar and per-folder inline status. Added markWatchedFolderScanned RPC to persist lastScannedAt. Changed onMessage to support multiple listeners. New BatchScanProgress type and deriveBatchProgress function in scan-state.ts.
