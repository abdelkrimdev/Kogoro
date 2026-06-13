---
"@kogoro/gui": minor
---

Library rebuild after scan approval (#85, PRD #76)

After scan approval and execution, the library database is now rebuilt from matched scan results. Added getMatchResults() to ScanOrchestrator that extracts match data filtered by status and approval state. The approvePlan RPC handler calls libraryDb.rebuildFromMatches() with extracted match data and source DB from config.
