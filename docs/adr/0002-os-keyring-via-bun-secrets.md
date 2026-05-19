# OS keyring via Bun.secrets

Kogoro stores Database API credentials in the OS keyring using Bun's native `Bun.secrets` API, falling back to `KOGORO_*_KEY` environment variables when no keyring daemon is available.

The original deferral (Bun's FFI couldn't reliably call `libsecret`/Keychain/Credential Manager) no longer applies: `Bun.secrets` is a native, non-FFI, cross-platform API that hooks directly into host OS secure storage. We keep the `KeytarLike` interface as the abstraction boundary and implement it with a `BunSecretsKeytar` adapter — the `CredentialStore` requires no changes.
