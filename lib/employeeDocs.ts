import { apiUrl, resolveUploadUrl } from '@/lib/api'

/** Kinds sent to POST /employees/upload. Only the passbook may be an image; the rest are PDF. */
export type EmployeeDocKind = 'aadhaar' | 'location' | 'passport' | 'reference-aadhaar' | 'passbook'

export const PASSBOOK_ACCEPT = 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

/** Client-side type check matching the backend rule (utils/employeeFields.js). */
export function employeeDocTypeError(kind: EmployeeDocKind, file: File): string | null {
  const name = file.name.toLowerCase()
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
  if (isPdf) return null
  if (kind === 'passbook' && (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/.test(name))) {
    return null
  }
  return kind === 'passbook' ? 'Upload the passbook as a PDF or an image (JPG, PNG).' : 'Only PDF files are allowed.'
}

/** Upload one employee document and return its stored URL (same storage as the Aadhaar upload). */
export async function uploadEmployeeDoc(file: File, kind: EmployeeDocKind): Promise<string> {
  const typeError = employeeDocTypeError(kind, file)
  if (typeError) throw new Error(typeError)
  const fd = new FormData()
  fd.append('kind', kind)
  fd.append('file', file)
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  const res = await fetch(apiUrl(`/employees/upload?kind=${encodeURIComponent(kind)}`), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.url) throw new Error(data?.message || 'Upload failed')
  return String(data.url)
}

/** Link target for a stored employee document. */
export function employeeDocHref(url?: string | null): string {
  return resolveUploadUrl(url || '')
}

/** File name part of a stored document URL. */
export function employeeDocName(url?: string | null): string {
  const last = String(url || '').split('?')[0].split('/').pop() || ''
  return last.replace(/^\d{10,}-/, '') || 'Document'
}
