/** Roles that can apply for leave and view their own leave history on the web app. */
export const LEAVE_SELF_SERVICE_ROLES = [
  'Executive',
  'Sales BDE',
  'Employee',
  'Trainer',
  'Manager',
] as const

/** Roles that can view org-wide leave lists and approve pending requests. */
export const LEAVE_TEAM_MANAGER_ROLES = [
  'Manager',
  'Admin',
  'Super Admin',
  'Executive Manager',
] as const

/** Backend: roles that may query leaves without forced self-only filter. */
export const LEAVE_ORG_VIEW_ROLES = LEAVE_TEAM_MANAGER_ROLES

export type LeaveSelfServiceRole = (typeof LEAVE_SELF_SERVICE_ROLES)[number]

export type DashboardLeaveCard = {
  href: string
  title: string
  subtitle: string
  variant: 'apply' | 'myLeaves' | 'pending'
}

const includesRole = (roles: readonly string[], role: string | undefined) =>
  !!role && roles.includes(role)

export function canApplyForLeave(role: string | undefined): boolean {
  return includesRole(LEAVE_SELF_SERVICE_ROLES, role)
}

export function canViewMyLeaves(role: string | undefined): boolean {
  return canApplyForLeave(role)
}

export function canManageTeamLeaves(role: string | undefined): boolean {
  return includesRole(LEAVE_TEAM_MANAGER_ROLES, role)
}

export function canViewLeavesReport(role: string | undefined): boolean {
  return canManageTeamLeaves(role)
}

export function showDashboardLeaveSection(role: string | undefined): boolean {
  return canApplyForLeave(role) || canManageTeamLeaves(role)
}

export function getDashboardLeaveCards(role: string | undefined): DashboardLeaveCard[] {
  if (!role) return []

  const cards: DashboardLeaveCard[] = []

  if (canManageTeamLeaves(role)) {
    cards.push({
      href: '/dashboard/leaves/pending',
      title: 'Pending Leaves',
      subtitle: 'Review and approve team leave requests',
      variant: 'pending',
    })
  }

  if (canApplyForLeave(role)) {
    cards.push({
      href: '/dashboard/leaves/request',
      title: 'Apply for Leave',
      subtitle: 'Submit a new leave request',
      variant: 'apply',
    })
    cards.push({
      href: '/dashboard/leaves/approved',
      title: 'My Leaves',
      subtitle: 'View all your leave requests',
      variant: 'myLeaves',
    })
  }

  return cards
}

export function getLeaveAccessDeniedRedirect(role: string | undefined): string {
  if (canManageTeamLeaves(role)) return '/dashboard/leaves/pending'
  return '/dashboard'
}
