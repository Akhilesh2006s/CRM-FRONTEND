import { Platform } from 'react-native';
import { getApiUrl } from '../services/api';

/**
 * Resolve a stored upload path / URL (bill, ticket) to a URL loadable from the app.
 * `/uploads/...` paths (and absolute URLs pointing at /uploads on another host) are
 * served from the same origin as the API — same approach as TrainingListScreen.
 */
export function resolveUploadUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('file:')) return trimmed;
  const origin = getApiUrl().replace(/\/api\/?$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith('/uploads/')) return `${origin}${u.pathname}${u.search}`;
    } catch (_) {
      /* use as-is */
    }
    return trimmed;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic)(\?.*)?$/i;
const PDF_EXT = /\.pdf(\?.*)?$/i;

export function isPdfUrl(url: string): boolean {
  return PDF_EXT.test(url) || url.startsWith('data:application/pdf');
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url) || url.startsWith('data:image/');
}

/** A picked local file (image or PDF) to attach as the expense bill. */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  /** Browser File object (Expo web only). */
  webFile?: any;
};

export const MAX_BILL_BYTES = 5 * 1024 * 1024;

/** Append a picked file to FormData (RN `{uri,name,type}` on native, Blob on web). */
export async function appendFileToFormData(formData: FormData, field: string, file: PickedFile) {
  if (Platform.OS === 'web') {
    const blob = file.webFile || (await fetch(file.uri).then((r) => r.blob()));
    formData.append(field, blob as any, file.name);
  } else {
    formData.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as any);
  }
}
