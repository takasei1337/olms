import { getApiBaseUrl } from '../../api/client';

/**
 * Formats an ISO timestamp into concise Vietnamese local date/time (dd/MM/yyyy HH:mm).
 */
export function formatExamDateTime(isoString?: string | null): string {
  if (!isoString) return 'Chưa thiết lập';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Thời gian không hợp lệ';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

/**
 * Converts an ISO timestamp to the local `YYYY-MM-DDTHH:mm` value used by `<input type="datetime-local">`.
 */
export function toLocalDateTimeInput(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parses a local `<input type="datetime-local">` value back into an ISO 8601 UTC string.
 */
export function fromLocalDateTimeInput(localValue: string): string | null {
  if (!localValue.trim()) return null;
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * Produces default opens_at (next rounded hour) and closes_at (+2 hours) local input strings.
 */
export function getDefaultExamScheduleInputs(): {
  opensAt: string;
  closesAt: string;
} {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const open = new Date(now.getTime() + 60 * 60 * 1000);
  const close = new Date(open.getTime() + 2 * 60 * 60 * 1000);
  return {
    opensAt: toLocalDateTimeInput(open.toISOString()),
    closesAt: toLocalDateTimeInput(close.toISOString()),
  };
}

export function formatScore(value: number): string {
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Resolves a backend download URL (absolute or `/api/v1/...` relative) against the configured API base URL.
 */
export function resolveApiDownloadUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  const baseUrl = getApiBaseUrl();
  if (rawUrl.startsWith('/api/v1')) {
    const suffix = rawUrl.slice('/api/v1'.length);
    return `${baseUrl}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
  }

  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
  } catch {
    return rawUrl;
  }
}

export function readDraftSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeDraftSession<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function buildParticipantsCsvTemplate(): string {
  const header = 'student_code,full_name,email';
  const row1 = 'SV2026001,Nguyễn Văn An,an.sv@example.edu.vn';
  const row2 = 'SV2026002,Trần Thị Bình,binh.sv@example.edu.vn';
  return `\uFEFF${header}\n${row1}\n${row2}\n`;
}

export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
