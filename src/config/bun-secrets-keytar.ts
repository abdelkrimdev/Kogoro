import type { KeytarLike } from "./credential-store.ts";

export interface SecretsLike {
  set(options: { service: string; name: string; value: string }): Promise<void>;
  get(options: { service: string; name: string }): Promise<string | null | undefined>;
  delete(options: { service: string; name: string }): Promise<boolean>;
}

export class BunSecretsKeytar implements KeytarLike {
  private secrets: SecretsLike;

  constructor(secrets: SecretsLike) {
    this.secrets = secrets;
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    await this.secrets.set({ service, name: account, value: password });
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      const val = await this.secrets.get({ service, name: account });
      return val ?? null;
    } catch {
      return null;
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    try {
      await this.secrets.delete({ service, name: account });
      return true;
    } catch {
      return false;
    }
  }
}
