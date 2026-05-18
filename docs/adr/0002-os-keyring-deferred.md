# OS keyring integration deferred

Kogoro's `CredentialStore` falls back to environment variables (`KOGORO_TVDB_KEY`, etc.) for API credentials. The architecture supports OS-native keyring storage via a `KeytarLike` interface — but Bun lacks the FFI maturity to reliably call `libsecret` (Linux), Keychain (macOS), or Credential Manager (Windows).

The trade-off: native keyring storage is the right long-term home for API keys (it's what password managers and system agents expect), but Bun's FFI layer for native libraries is still evolving. Shipping a fragile FFI bridge that fails silently on some Linux distros or macOS versions would be worse than deferring and documenting the env-var fallback.

We keep the `KeytarLike` interface in place as an extension point and defer native keyring support until Bun's FFI story stabilizes or user pain justifies the engineering investment.
