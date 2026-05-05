import { IsapiClient } from './isapi/isapi-client';
import { DeviceCredentials } from './isapi/types';
import { logger } from './logger';

export type DeviceMode = 'entry' | 'exit' | 'both';

export interface ManagedDevice {
  id: string;
  name?: string;
  mode: DeviceMode;
  credentials: DeviceCredentials;
}

interface Entry {
  device: ManagedDevice;
  client: IsapiClient;
}

export class DevicePool {
  private readonly entries = new Map<string, Entry>();

  upsert(devices: ManagedDevice[]): void {
    const incoming = new Set(devices.map((d) => d.id));

    for (const id of [...this.entries.keys()]) {
      if (!incoming.has(id)) {
        this.entries.delete(id);
        logger.info(`➖ qurilma o'chirildi: ${id}`);
      }
    }

    for (const d of devices) {
      const cur = this.entries.get(d.id);
      if (!cur) {
        const client = new IsapiClient(d.credentials);
        this.entries.set(d.id, { device: d, client });
        logger.info(`➕ qurilma qo'shildi: ${d.id} (${d.credentials.host}:${d.credentials.port}, mode=${d.mode})`);
      } else if (this.changed(cur.device, d)) {
        cur.device = d;
        cur.client = new IsapiClient(d.credentials);
        logger.info(`♻️  qurilma yangilandi: ${d.id}`);
      }
    }
  }

  private changed(a: ManagedDevice, b: ManagedDevice): boolean {
    return (
      a.mode !== b.mode ||
      a.credentials.host !== b.credentials.host ||
      a.credentials.port !== b.credentials.port ||
      a.credentials.useHttps !== b.credentials.useHttps ||
      a.credentials.username !== b.credentials.username ||
      a.credentials.password !== b.credentials.password
    );
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): Entry | undefined {
    return this.entries.get(id);
  }

  clientFor(id: string): IsapiClient {
    const e = this.entries.get(id);
    if (!e) throw new Error(`device ${id} not managed by this agent`);
    return e.client;
  }

  list(): ManagedDevice[] {
    return [...this.entries.values()].map((e) => e.device);
  }

  size(): number {
    return this.entries.size;
  }

  async pingAll(): Promise<Array<{ id: string; ok: boolean }>> {
    // Parallel — 100 qurilmali kampaniyada inspect 15s o'rniga ~1s.
    const items = [...this.entries.entries()];
    return Promise.all(
      items.map(async ([id, e]) => ({
        id,
        ok: await e.client.ping().catch(() => false),
      })),
    );
  }
}
