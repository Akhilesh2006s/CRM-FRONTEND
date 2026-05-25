export const TAGGING_ROLES = [
  'Executive',
  'Coordinator',
  'Senior Coordinator',
  'Finance Manager',
  'Warehouse Manager',
  'Executive Manager',
  'Manager',
] as const

/** Roles shown in the tagging picker for a given user type (null = all active employees). */
export function getTaggingTargetRoles(role: string): string[] | null {
  if (role === 'Executive Manager' || role === 'Manager') return ['Executive']
  return null
}

export function filterTagOptions<T extends { role: string }>(
  options: T[],
  role: string
): T[] {
  const targets = getTaggingTargetRoles(role)
  if (!targets) return options
  return options.filter((e) => targets.includes(e.role))
}

export function getTaggingSectionLabel(role: string): string {
  if (role === 'Executive Manager' || role === 'Manager') {
    return 'Tag executives'
  }
  return 'Employee tagging'
}

export function supportsEmployeeTagging(role: string): boolean {
  return (TAGGING_ROLES as readonly string[]).includes(role)
}
