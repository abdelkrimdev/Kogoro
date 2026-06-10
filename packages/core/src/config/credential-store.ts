import { BunSecretsKeytar, type KeytarLike } from "./bun-secrets-keytar";

interface CredentialStoreOptions {
  keytar?: KeytarLike | null;
}

export class CredentialStore {
  private readonly keytar: KeytarLike | null;

  constructor(options: CredentialStoreOptions = {}) {
    this.keytar = options.keytar ?? null;
  }

  private envVarName(service: string): string {
    return `KOGORO_${service.toUpperCase()}_KEY`;
  }

  async getCredential(service: string): Promise<string | undefined> {
    if (this.keytar) {
      const val = await this.keytar.getPassword("kogoro", service);
      if (val !== null) return val;
    }
    return process.env[this.envVarName(service)] ?? undefined;
  }

  async setCredential(service: string, credential: string): Promise<{ usedKeyring: boolean }> {
    if (this.keytar) {
      try {
        await this.keytar.setPassword("kogoro", service, credential);
        return { usedKeyring: true };
      } catch {
        // fall through to env var
      }
    }
    process.env[this.envVarName(service)] = credential;
    return { usedKeyring: false };
  }

  async deleteCredential(service: string): Promise<void> {
    if (this.keytar) {
      try {
        await this.keytar.deletePassword("kogoro", service);
      } catch {
        // fall through to env var cleanup
      }
    }
    delete process.env[this.envVarName(service)];
  }
}

export function createCredentialStore(): CredentialStore {
  return new CredentialStore({ keytar: new BunSecretsKeytar() });
}
