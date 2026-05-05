import { IsapiClient } from './isapi/isapi-client';
import { logger } from './logger';

interface StreamSession {
  /** ISAPI client (qayta foydalaniladi) */
  client: IsapiClient;
  /** Joriy fps */
  fps: number;
  /** Polling timer */
  timer: NodeJS.Timeout | null;
  /** Oxirgi muvaffaqiyatli kadr */
  latestFrame: Buffer | null;
  /** Oxirgi olishdagi xato */
  lastError: string | null;
  /** Oxirgi `getFrame` yoki `start` chaqiruvi (lifecycle uchun) */
  lastTouch: number;
}

/**
 * Agent ichidagi kamera stream sessiyalarini boshqaradi.
 *
 * Har session uchun agent qurilmadan ISAPI snapshot'ni belgilangan fps bilan
 * oladi va eng so'nggi kadrni RAM'da keshlaydi. Server `getStreamFrame` so'rasa,
 * keshdan tezda javob beradi (qurilmaga to'g'ridan-to'g'ri tegishi shart emas).
 *
 * Lifecycle:
 *  - start(deviceId, ...) — sessiyani yaratadi yoki fps'ni yangilaydi
 *  - getFrame(deviceId)    — keshlangan kadrni qaytaradi, lastTouch'ni yangilaydi
 *  - stop(deviceId)        — sessiyani darhol to'xtatadi
 *  - 60s'dan ortiq lastTouch yangilanmasa session avto-yopiladi (browser crash uchun)
 */
export class StreamManager {
  private readonly sessions = new Map<string, StreamSession>();
  private readonly idleTimeoutMs = 60_000;

  /**
   * Sessiyani boshlash yoki fps'ni yangilash. Idempotent — bir necha marta
   * chaqirilsa ham bitta sessiya bo'ladi.
   */
  start(deviceId: string, client: IsapiClient, fps = 3): void {
    const cleanFps = Math.max(0.2, Math.min(10, fps));
    const existing = this.sessions.get(deviceId);
    if (existing) {
      existing.lastTouch = Date.now();
      if (existing.fps !== cleanFps) {
        existing.fps = cleanFps;
        this.scheduleNext(deviceId, existing);
        logger.info(`📹 stream fps yangilandi: ${deviceId} → ${cleanFps}fps`);
      }
      return;
    }

    const session: StreamSession = {
      client,
      fps: cleanFps,
      timer: null,
      latestFrame: null,
      lastError: null,
      lastTouch: Date.now(),
    };
    this.sessions.set(deviceId, session);
    logger.info(`📹 stream boshlandi: ${deviceId} @ ${cleanFps}fps`);

    // Birinchi kadrni darhol olamiz — keshda bo'sh ko'rinmasin.
    this.fetchOnce(deviceId, session);
    this.scheduleNext(deviceId, session);
  }

  /** Sessiyani darhol to'xtatadi. */
  stop(deviceId: string): void {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    if (session.timer) clearTimeout(session.timer);
    this.sessions.delete(deviceId);
    logger.info(`🛑 stream to'xtatildi: ${deviceId}`);
  }

  /** Server uchun: oxirgi keshlangan kadr. lastTouch'ni yangilaydi. */
  getFrame(
    deviceId: string,
  ): { imageBase64: string | null; bytes: number; error: string | null } {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return { imageBase64: null, bytes: 0, error: 'no active stream' };
    }
    session.lastTouch = Date.now();
    if (!session.latestFrame) {
      return {
        imageBase64: null,
        bytes: 0,
        error: session.lastError ?? 'still loading',
      };
    }
    return {
      imageBase64: session.latestFrame.toString('base64'),
      bytes: session.latestFrame.length,
      error: session.lastError,
    };
  }

  /** Hozirgi sessiyalar haqida xulosa (debug uchun). */
  list(): Array<{
    deviceId: string;
    fps: number;
    lastTouchAgoMs: number;
    hasFrame: boolean;
    lastError: string | null;
  }> {
    const now = Date.now();
    return [...this.sessions.entries()].map(([deviceId, s]) => ({
      deviceId,
      fps: s.fps,
      lastTouchAgoMs: now - s.lastTouch,
      hasFrame: s.latestFrame !== null,
      lastError: s.lastError,
    }));
  }

  /** Barcha sessiyalarni to'xtatish (graceful shutdown). */
  stopAll(): void {
    for (const id of [...this.sessions.keys()]) this.stop(id);
  }

  // ───── ichki ─────

  private scheduleNext(deviceId: string, session: StreamSession): void {
    if (session.timer) clearTimeout(session.timer);
    const intervalMs = Math.round(1000 / session.fps);
    session.timer = setTimeout(
      () => this.tick(deviceId, session),
      intervalMs,
    );
  }

  private async tick(
    deviceId: string,
    session: StreamSession,
  ): Promise<void> {
    if (this.sessions.get(deviceId) !== session) return; // stop'dan keyin dropped

    // Idle timeout — server stop'ni yo'qotsa ham agent o'zi to'xtaydi.
    if (Date.now() - session.lastTouch > this.idleTimeoutMs) {
      logger.warn(
        `⏰ stream idle timeout (60s, browser crash?): ${deviceId} avto-yopildi`,
      );
      this.stop(deviceId);
      return;
    }

    await this.fetchOnce(deviceId, session);
    if (this.sessions.get(deviceId) === session) {
      this.scheduleNext(deviceId, session);
    }
  }

  private async fetchOnce(
    deviceId: string,
    session: StreamSession,
  ): Promise<void> {
    try {
      const buf = await session.client.getSnapshot(1);
      if (this.sessions.get(deviceId) !== session) return;
      session.latestFrame = buf;
      session.lastError = null;
    } catch (e) {
      if (this.sessions.get(deviceId) !== session) return;
      session.lastError = (e as Error).message;
      logger.debug(`stream snapshot xato (${deviceId}): ${session.lastError}`);
    }
  }
}
