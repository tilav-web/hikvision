/**
 * Telegram message format'lari. HTML parse_mode (Telegram'ning tavsiyasi).
 * Foydalanuvchi nomlari xavfsiz escape qilinishi shart — `escapeHtml`.
 */

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtMinutes(m: number): string {
  if (!m) return '0d';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0 && mm > 0) return `${h}s ${mm}d`;
  if (h > 0) return `${h}s`;
  return `${mm}d`;
}

function fmtTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('uz-UZ', {
    timeZone: process.env.TZ_DEFAULT || 'Asia/Tashkent',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// ───── Event-specific templatelar ─────

export interface LatePayload {
  personName: string;
  employeeNo: string;
  lateMinutes: number;
  date: string;
  companyName?: string;
}

export function lateTemplate(p: LatePayload): string {
  const head = p.companyName ? `[${escapeHtml(p.companyName)}] ` : '';
  return (
    `🕐 <b>Kechikish</b>\n` +
    `${head}<b>${escapeHtml(p.personName)}</b> (#${escapeHtml(p.employeeNo)})\n` +
    `Kechikkan vaqt: <b>${fmtMinutes(p.lateMinutes)}</b>\n` +
    `Sana: ${escapeHtml(p.date)}`
  );
}

export interface BlackListPayload {
  personName: string;
  employeeNo: string;
  deviceName: string;
  capturedAt: Date | string;
  companyName?: string;
}

export function blacklistTemplate(p: BlackListPayload): string {
  const head = p.companyName ? `[${escapeHtml(p.companyName)}] ` : '';
  return (
    `🚨 <b>BlackList yuz aniqlandi</b>\n` +
    `${head}<b>${escapeHtml(p.personName)}</b> (#${escapeHtml(p.employeeNo)})\n` +
    `Qurilma: ${escapeHtml(p.deviceName)}\n` +
    `Vaqt: ${fmtTime(p.capturedAt)}`
  );
}

export interface AgentOfflinePayload {
  agentName: string;
  lastSeenAt: Date | string;
  companyName?: string;
}

export function agentOfflineTemplate(p: AgentOfflinePayload): string {
  const head = p.companyName ? `[${escapeHtml(p.companyName)}] ` : '';
  return (
    `🔌 <b>Agent uzildi</b>\n` +
    `${head}Agent: <b>${escapeHtml(p.agentName)}</b>\n` +
    `Oxirgi ulanish: ${fmtTime(p.lastSeenAt)}\n` +
    `<i>Qurilmalar bilan boshqarish va event qabul qilish to'xtagan.</i>`
  );
}

export interface TestPayload {
  channelTitle?: string;
  companyName?: string;
}

export function testTemplate(p: TestPayload): string {
  const head = p.companyName ? `<b>[${escapeHtml(p.companyName)}]</b>\n` : '';
  return (
    `${head}✅ <b>Telegram bog'lanish muvaffaqiyatli</b>\n` +
    `Bu kanal endi Hikvision tizimidan bildirishnomalar oladi.\n` +
    (p.channelTitle ? `Kanal: ${escapeHtml(p.channelTitle)}` : '')
  );
}

export type EventType = 'late' | 'blacklist' | 'agent_offline';

export function formatEvent(
  eventType: EventType,
  payload: any,
): string {
  switch (eventType) {
    case 'late':
      return lateTemplate(payload);
    case 'blacklist':
      return blacklistTemplate(payload);
    case 'agent_offline':
      return agentOfflineTemplate(payload);
    default:
      return `Event: ${escapeHtml(eventType)}\n<pre>${escapeHtml(JSON.stringify(payload))}</pre>`;
  }
}
