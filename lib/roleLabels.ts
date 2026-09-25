/** Display names only. Stored role values are unchanged. */
const ROLE_LABELS: Record<string, string> = {
  'Executive Manager': 'Zonal Manager',
  Manager: 'Product Manager',
  Executive: 'BDE',
  Employee: 'BDE',
}

export function displayRoleName(role: string | null | undefined): string {
  if (!role) return ''
  return ROLE_LABELS[role] || role
}
