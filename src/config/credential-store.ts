import { BunSecretsKeytar } from "./bun-secrets-keytar.ts";

export interface KeytarLike {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export interface CredentialStoreOptions {
  keytar?: KeytarLike | null;
}

export class CredentialStore {
  private keytar: KeytarLike | null;

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

  async setCredential(service: string, credential: string): Promise<void> {
    if (this.keytar) {
      await this.keytar.setPassword("kogoro", service, credential);
      return;
    }
    process.env[this.envVarName(service)] = credential;
  }

  async deleteCredential(service: string): Promise<void> {
    if (this.keytar) {
      await this.keytar.deletePassword("kogoro", service);
      return;
    }
    delete process.env[this.envVarName(service)];
  }
}

export function createCredentialStore(): CredentialStore {
  return new CredentialStore({ keytar: new BunSecretsKeytar() });
}
