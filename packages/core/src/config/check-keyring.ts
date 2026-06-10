import type { KeytarLike } from "./bun-secrets-keytar";

export type KeyringReason = "unavailable" | "locked" | "access_denied" | "unknown";

export interface KeyringCheckResult {
  available: boolean;
  reason?: KeyringReason;
  platform: string;
}

const CHECK_SERVICE = "kogoro-check";
const CHECK_ACCOUNT = "check";
const CHECK_VALUE = "test";

export async function checkKeyring(
  keytar: KeytarLike,
  platform: string,
): Promise<KeyringCheckResult> {
  try {
    await keytar.setPassword(CHECK_SERVICE, CHECK_ACCOUNT, CHECK_VALUE);
    await keytar.deletePassword(CHECK_SERVICE, CHECK_ACCOUNT);
    return { available: true, platform };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { available: false, reason: classifyError(msg, platform), platform };
  }
}

function classifyError(msg: string, platform: string): KeyringReason {
  if (platform === "darwin") {
    if (/SecKeychain|keychain|locked/i.test(msg)) return "locked";
  }
  if (/DBus|org\.freedesktop|not.?available|no.?secret.?service/i.test(msg)) return "unavailable";
  if (/permission|denied|access.?denied/i.test(msg)) return "access_denied";
  return "unknown";
}
