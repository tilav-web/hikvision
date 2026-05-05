import * as dgram from 'node:dgram';
import { randomUUID } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { logger } from './logger';

const SADP_PORT = 37020;
const SADP_MULTICAST = '239.255.255.250';
const PROBE_INTERVAL_MS = 30_000;
const STALE_AFTER_MS = 90_000;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

export interface DiscoveredDevice {
  serialNumber: string;
  macAddress: string | null;
  ipv4Address: string;
  httpPort: number;
  deviceType: string | null;
  deviceDescription: string | null;
  firmwareVersion: string | null;
  lastSeenAt: number;
}

export class SadpDiscovery {
  private socket: dgram.Socket | null = null;
  private readonly cache = new Map<string, DiscoveredDevice>();
  private probeTimer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.socket) return;
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket = sock;

    sock.on('error', (err) => {
      logger.warn(`SADP socket xato: ${err.message}`);
    });
    sock.on('message', (buf, rinfo) => this.onMessage(buf, rinfo));

    sock.bind(SADP_PORT, () => {
      try {
        sock.addMembership(SADP_MULTICAST);
        sock.setBroadcast(true);
        logger.info(`📡 SADP discovery boshlandi (UDP ${SADP_PORT})`);
        this.probe();
        this.probeTimer = setInterval(() => this.probe(), PROBE_INTERVAL_MS);
      } catch (e) {
        logger.warn(`SADP membership xato: ${(e as Error).message}`);
      }
    });
  }

  stop(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }

  /** Joriy aniqlangan qurilmalar (60 sekunddan eski yozuvlarni filtrlaydi). */
  list(): DiscoveredDevice[] {
    const now = Date.now();
    return [...this.cache.values()].filter(
      (d) => now - d.lastSeenAt < STALE_AFTER_MS,
    );
  }

  private probe(): void {
    if (!this.socket) return;
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Probe><Uuid>${randomUUID().toUpperCase()}</Uuid><Types>inquiry</Types></Probe>`;
    const buf = Buffer.from(xml, 'utf8');
    this.socket.send(buf, 0, buf.length, SADP_PORT, SADP_MULTICAST, (err) => {
      if (err) logger.debug(`SADP probe yuborishda xato: ${err.message}`);
    });
  }

  private onMessage(buf: Buffer, rinfo: dgram.RemoteInfo): void {
    const text = buf.toString('utf8');
    if (!text.includes('<ProbeMatch')) return;

    let parsed: any;
    try {
      parsed = xmlParser.parse(text);
    } catch {
      return;
    }
    const m = parsed?.ProbeMatch ?? parsed?.Probe?.ProbeMatch;
    if (!m) return;

    const sn = String(m.DeviceSN ?? m.SerialNumber ?? '').trim();
    if (!sn) return;

    const ip = String(m.IPv4Address ?? rinfo.address).trim();
    const httpPort = Number.parseInt(String(m.HttpPort ?? '80'), 10) || 80;
    const mac = m.MAC ? String(m.MAC).trim() : null;

    const entry: DiscoveredDevice = {
      serialNumber: sn,
      macAddress: mac,
      ipv4Address: ip,
      httpPort,
      deviceType: m.DeviceType ? String(m.DeviceType) : null,
      deviceDescription: m.DeviceDescription
        ? String(m.DeviceDescription)
        : null,
      firmwareVersion: m.SoftwareVersion ? String(m.SoftwareVersion) : null,
      lastSeenAt: Date.now(),
    };

    const prev = this.cache.get(sn);
    this.cache.set(sn, entry);
    if (!prev) {
      logger.info(
        `🔍 SADP yangi qurilma topildi: ${sn} (${ip}:${httpPort}, ${entry.deviceType ?? '?'})`,
      );
    } else if (prev.ipv4Address !== ip || prev.httpPort !== httpPort) {
      logger.info(
        `🔄 SADP qurilma manzili o'zgardi: ${sn} ${prev.ipv4Address}:${prev.httpPort} → ${ip}:${httpPort}`,
      );
    }
  }
}
