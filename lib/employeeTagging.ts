/**
 * Sales tagging is one step down the hierarchy:
 * National Head → Regional Head → Regional Manager → Zonal Manager → Coordinators → BDE
 */

const TAG_LABELS: Record<string, string> = {
  'Regional Head': 'Regional Heads',
  'Regional Manager': 'Regional Managers',
  'Executive Manager': 'Zonal Managers',
  Coordinator: 'Coordinators',
  'Senior Coordinator': 'Coordinators',
  Executive: 'BDEs',
  'Sales BDE': 'BDEs',
}

/** User type → roles they may tag (the level directly below). */
export const HIERARCHY_TAG_TARGETS: Record<string, string[]> = {
  'National Head': ['Regional Head'],
  'Regional Head': ['Regional Manager'],
  'Regional Manager': ['Executive Manager'],
  'Executive Manager': ['Coordinator', 'Senior Coordinator'],
  Coordinator: ['Executive', 'Sales BDE'],
  'Senior Coordinator': ['Executive', 'Sales BDE'],
}

export const TAGGING_ROLES = Object.keys(HIERARCHY_TAG_TARGETS)

/** BDE is one zone. Every other user type may hold several zones. */
export function isSingleZoneRole(role: string): boolean {
  return role === 'Executive' || role === 'Sales BDE' || role === 'Employee' || role === 'BDE'
}

/** Roles shown in the tagging picker for a given user type. */
export function getTaggingTargetRoles(role: string): string[] | null {
  return HIERARCHY_TAG_TARGETS[role] || null
}

export function filterTagOptions<T extends { role: string }>(
  options: T[],
  role: string
): T[] {
  const targets = getTaggingTargetRoles(role)
  if (!targets) return []
  const rank = new Map(targets.map((name, index) => [name, index]))
  return options
    .filter((e) => targets.includes(e.role))
    .sort((a, b) => (rank.get(a.role) ?? 0) - (rank.get(b.role) ?? 0))
}

export function getTaggingSectionLabel(role: string): string {
  const targets = getTaggingTargetRoles(role)
  if (!targets) return 'Employee tagging'
  const labels = [...new Set(targets.map((name) => TAG_LABELS[name] || name))]
  return `Tag ${labels.join(' / ')}`
}

export function supportsEmployeeTagging(role: string): boolean {
  return Boolean(HIERARCHY_TAG_TARGETS[role])
}
