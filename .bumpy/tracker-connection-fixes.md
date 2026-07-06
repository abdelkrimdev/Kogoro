---
kogoro-gui: patch
kogoro-plugins: patch
kogoro-core: patch
---

Fix critical tracker connection issues:
- AniList OAuth flow now correctly reads code field from dialog
- AniList plugin now properly handles expired tokens with refreshSession
- MAL raw token entry now stores as JSON blob for proper credential handling
- MAL plugin now throws TrackerError instead of generic Error for consistency
- Cancel tracker auth now properly resolves pending promises
- Callback server now auto-stops after successful callback
- AniList GraphQL errors now throw instead of returning null
- Fix openExternal RPC type mismatch
- Remove non-functional dialog tests
