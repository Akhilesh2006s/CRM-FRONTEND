import { Linking } from 'react-native';
import { getApiUrl } from '../services/api';

/** Stored employee document path (e.g. /uploads/employees/x.pdf) as a URL the app can open. */
export function employeeDocUrl(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^(data|blob|file):/.test(trimmed)) return trimmed;
  const origin = getApiUrl().replace(/\/api\/?$/, '');
  if (/^https?:\/\//.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith('/uploads/')) return `${origin}${u.pathname}${u.search}`;
    } catch {
      /* use as-is */
    }
    return trimmed;
  }
  return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/** File name part of a stored document URL, without the upload timestamp. */
export function employeeDocName(raw?: string | null): string {
  const last = String(raw || '').split('?')[0].split('/').pop() || '';
  return last.replace(/^\d{10,}-/, '') || 'Document';
}

/** Open a stored employee document in the browser / viewer. */
export function openEmployeeDoc(raw?: string | null): void {
  const url = employeeDocUrl(raw);
  if (url) Linking.openURL(url).catch(() => {});
}

/** Stored date as YYYY-MM-DD on the Indian calendar ('' when missing). */
export function employeeDateYmd(value: unknown): string {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** Stored date as DD/MM/YYYY ('' when missing). */
export function employeeDateText(value: unknown): string {
  const ymd = employeeDateYmd(value);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}
