---
"@kogoro/gui": minor
---

Add folder selection checkboxes and toolbar to scan view (#73, PRD #68). Each folder row now has a checkbox (disabled for missing folders). Toolbar includes Select All with indeterminate state, folder count, and Scan Selected button. New pure functions: toggleFolder, toggleAll, deriveScanToolbar in scan-state.ts.
