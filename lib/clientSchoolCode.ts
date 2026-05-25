/** Client records use school_code; dc_code is legacy fallback only. */
export function displayClientSchoolCode(
  record?: { school_code?: string; dc_code?: string } | null
): string {
  if (!record) return '';
  return String(record.school_code || record.dc_code || '').trim();
}

export function schoolMapKey(code: string, fallbackId: string): string {
  const c = code.trim();
  return c || `id:${fallbackId}`;
}
