import { EventCategory, VerifyMode } from '../entities/access-event.entity';

/**
 * AcsEvent (Access Control Event) majorEvent codes (Hikvision standart):
 * 5  — Operation
 * 3  — Alarm
 * 1  — Exception
 * 2  — Event (default access events ko'pincha 5 keladi)
 *
 * minorEvent codes (qisqartirilgan, eng muhimlari):
 * 75   (0x4B)  — legitimate face / fingerprint / card → accessGranted
 * 76   (0x4C)  — invalid card / face → accessDenied
 * 8    (0x08)  — door opened
 * 7    (0x07)  — door closed (or button)
 * 38   (0x26)  — duress
 *
 * Aparat versiyalarga qarab kichik farqlar bo'ladi — shu uchun "shubhada qoldir" mantig'i.
 */

const GRANTED_MINORS = new Set<number>([75, 0x4b, 0x4f, 79, 39, 0x27]);
const DENIED_MINORS = new Set<number>([76, 0x4c, 77, 0x4d, 78, 0x4e]);
const DOOR_OPEN_MINORS = new Set<number>([8, 0x08]);
const DOOR_CLOSE_MINORS = new Set<number>([7, 0x07]);
const DURESS_MINORS = new Set<number>([38, 0x26]);
const TAMPER_MINORS = new Set<number>([1, 2, 3]); // major=3 alarm bilan birga

export function classifyEvent(major?: number, minor?: number): EventCategory {
  if (minor == null) return 'unknown';
  if (GRANTED_MINORS.has(minor)) return 'accessGranted';
  if (DENIED_MINORS.has(minor)) return 'accessDenied';
  if (DOOR_OPEN_MINORS.has(minor)) return 'doorOpen';
  if (DOOR_CLOSE_MINORS.has(minor)) return 'doorClose';
  if (DURESS_MINORS.has(minor)) return 'duress';
  if (major === 3 && TAMPER_MINORS.has(minor)) return 'tamper';
  return 'unknown';
}

export function classifyVerifyMode(currentVerifyMode?: string): VerifyMode {
  if (!currentVerifyMode) return 'unknown';
  const v = currentVerifyMode.toLowerCase();
  if (v.includes('face') && v.includes('card')) return 'faceAndCard';
  if (v.includes('face') && v.includes('pw')) return 'faceAndPin';
  if (v.includes('card') && v.includes('pw')) return 'cardAndPin';
  if (v.includes('face')) return 'face';
  if (v.includes('finger')) return 'fingerprint';
  if (v.includes('card')) return 'card';
  if (v.includes('pw') || v.includes('pin')) return 'pin';
  return 'unknown';
}

export interface ParsedAcsEvent {
  capturedAt: Date;
  majorEvent: number | null;
  minorEvent: number | null;
  category: EventCategory;
  verifyMode: VerifyMode;
  employeeNo: string | null;
  personName: string | null;
  raw: Record<string, any>;
}

/**
 * Aparatdan kelgan event payload'ini parse qilamiz.
 *
 * DS-K1T343MFWX (firmware V4.38.0) multipart bilan yuborganda struktura:
 *   {
 *     AccessControllerEvent: "<JSON-string>"   // multipart text field
 *   }
 * yoki to'g'ridan-to'g'ri JSON bilan kelganda:
 *   {
 *     ipAddress, dateTime, eventType, AccessControllerEvent: { majorEventType, subEventType, ... }
 *   }
 * Ikki holatni ham qo'llaymiz.
 */
export function parseAcsEventPayload(payload: any): ParsedAcsEvent | null {
  if (!payload || typeof payload !== 'object') return null;

  // Tashqi konvert (string bo'lishi ham mumkin) — JSON parse
  let outer = payload;
  if (typeof outer.AccessControllerEvent === 'string') {
    const parsed = safeJson(outer.AccessControllerEvent);
    if (parsed && typeof parsed === 'object') outer = parsed;
  }

  // Ichki blok (eski/yangi nomlar)
  let inner =
    outer.AccessControllerEvent ||
    outer.AcsEventInfo ||
    outer.acs ||
    null;

  if (typeof inner === 'string') {
    const parsedInner = safeJson(inner);
    if (parsedInner && typeof parsedInner === 'object') inner = parsedInner;
  }

  // Tashqi blokda eventType bor bo'lsa, lekin inner topilmasa — outer ni ichki sifatida olamiz
  const acs = inner ?? (outer.eventType ? outer : null);
  if (!acs) return null;

  const dateTime: string | undefined =
    outer.dateTime || acs.dateTime || acs.eventTime;
  const major = toInt(acs.majorEventType ?? outer.majorEventType ?? acs.major);
  const minor = toInt(acs.subEventType ?? outer.subEventType ?? acs.minor);

  return {
    capturedAt: dateTime ? new Date(dateTime) : new Date(),
    majorEvent: major,
    minorEvent: minor,
    category: classifyEvent(major ?? undefined, minor ?? undefined),
    verifyMode: classifyVerifyMode(acs.currentVerifyMode),
    employeeNo: stringOrNull(acs.employeeNoString ?? acs.employeeNo),
    personName: stringOrNull(acs.name),
    raw: outer,
  };
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s || null;
}
