# Keyring UX improvements

The GUI now proactively detects OS keyring availability and translates raw OS errors into human-readable reasons. Users see clear guidance when the keyring is unavailable, with platform-specific fix instructions delivered via a reusable Popover component. Raw errors (e.g. `org.freedesktop.DBus.Error.NotSupported`) are never shown.

The check runs before the user enters an API key (wizard step 2) and on Settings load, so failures are discovered early. The system still warns and allows proceeding — the env-var fallback remains the safety net. Error classification (`unavailable`, `locked`, `access_denied`, `unknown`) lives in `checkKeyring` from `@kogoro/core` so both onboarding and settings produce consistent, translated messages.
