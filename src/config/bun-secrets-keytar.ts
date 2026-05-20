import type { KeytarLike } from "./credential-store";

export class BunSecretsKeytar implements KeytarLike {
  async setPassword(service: string, account: string, password: string): Promise<void> {
    await Bun.secrets.set({ service, name: account, value: password });
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      return (await Bun.secrets.get({ service, name: account })) ?? null;
    } catch {
      return null;
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    try {
      return await Bun.secrets.delete({ service, name: account });
    } catch {
      return false;
    }
  }
}
