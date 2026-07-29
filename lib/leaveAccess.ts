import { canAccessPath } from './access'
import type { AuthUserWithPermissions } from './permissions'
import { hasPermission, isRbacActive, isSuperAdmin } from './permissions'

/** Roles that can apply for leave (legacy, when RBAC is off). */
export const LEAVE_SELF_SERVICE_ROLES = [
  'Executive',
  'Sales BDE',
  'Employee',
  'Trainer',
  'Manager',
] as const

export const LEAVE_TEAM_MANAGER_ROLES = [
  'Manager',
  'Admin',
  'Super Admin',
  'Executive Manager',
] as const

const includesRole = (roles: readonly string[], role: string | undefined) =>
  !!role && (roles as readonly string[]).includes(role)

const LEAVE_PATH_PERMISSION: Record<string, string> = {
  '/dashboard/leaves/request': 'leaves.request.page.view',
  '/dashboard/leaves/approved': 'leaves.approved.page.view',
  '/dashboard/leaves/pending': 'leaves.pending.page.view',
  '/dashboard/leaves/report': 'leaves.report.page.view',
}

export function canAccessLeavePage(
  user: AuthUserWithPermissions | null,
  pathname: string,
  legacyRole?: string
): boolean {
  if (user && isRbacActive(user)) {
    return canAccessPath(user, pathname)
  }
  const key = LEAVE_PATH_PERMISSION[pathname]
  if (key && user) {
    return hasPermission(user, key)
  }
  switch (pathname) {
    case '/dashboard/leaves/request':
      return canApplyForLeave(legacyRole)
    case '/dashboard/leaves/approved':
      return canViewMyLeaves(legacyRole)
    case '/dashboard/leaves/pending':
      return canManageTeamLeaves(legacyRole)
    case '/dashboard/leaves/report':
      return canViewLeavesReport(legacyRole)
    default:
      return true
  }
}

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

export function getLeaveAccessDeniedRedirect(role: string | undefined): string {
  if (includesRole(LEAVE_TEAM_MANAGER_ROLES, role)) return '/dashboard/leaves/pending'
  return '/dashboard'
}

export type DashboardLeaveCard = {
  href: string
  title: string
  subtitle: string
  variant: 'pending' | 'apply' | 'myLeaves'
}

function resolveLegacyRole(
  roleOrUser: string | AuthUserWithPermissions | null | undefined
): string | undefined {
  if (!roleOrUser) return undefined
  if (typeof roleOrUser === 'string') return roleOrUser
  return roleOrUser.role
}

/** Whether the home dashboard should show Leave Management quick links. */
export function showDashboardLeaveSection(
  roleOrUser: string | AuthUserWithPermissions | null | undefined
): boolean {
  if (!roleOrUser) return false
  if (typeof roleOrUser === 'object' && isRbacActive(roleOrUser)) {
    if (isSuperAdmin(roleOrUser)) return true
    return getDashboardLeaveCards(roleOrUser).length > 0
  }
  const role = resolveLegacyRole(roleOrUser)
  return canApplyForLeave(role) || canManageTeamLeaves(role)
}

/** Quick-link cards for the dashboard Leave Management section. */
export function getDashboardLeaveCards(
  roleOrUser: string | AuthUserWithPermissions | null | undefined
): DashboardLeaveCard[] {
  if (!roleOrUser) return []

  if (typeof roleOrUser === 'object' && isRbacActive(roleOrUser)) {
    const user = roleOrUser
    const cards: DashboardLeaveCard[] = []
    if (isSuperAdmin(user) || hasPermission(user, 'leaves.pending.page.view')) {
      cards.push({
        href: '/dashboard/leaves/pending',
        title: 'Pending Leaves',
        subtitle: 'Review team leave requests',
        variant: 'pending',
      })
    }
    if (isSuperAdmin(user) || hasPermission(user, 'leaves.report.page.view')) {
      cards.push({
        href: '/dashboard/leaves/report',
        title: 'Leaves Report',
        subtitle: 'View all leave records',
        variant: 'myLeaves',
      })
    }
    if (isSuperAdmin(user) || hasPermission(user, 'leaves.request.page.view')) {
      cards.push({
        href: '/dashboard/leaves/request',
        title: 'Apply for Leave',
        subtitle: 'Submit a new leave request',
        variant: 'apply',
      })
    }
    if (isSuperAdmin(user) || hasPermission(user, 'leaves.approved.page.view')) {
      cards.push({
        href: '/dashboard/leaves/approved',
        title: 'My Leaves',
        subtitle: 'View your leave history',
        variant: 'myLeaves',
      })
    }
    return cards
  }

  const role = resolveLegacyRole(roleOrUser)
  const cards: DashboardLeaveCard[] = []
  if (canManageTeamLeaves(role)) {
    cards.push({
      href: '/dashboard/leaves/pending',
      title: 'Pending Leaves',
      subtitle: 'Review team leave requests',
      variant: 'pending',
    })
    cards.push({
      href: '/dashboard/leaves/report',
      title: 'Leaves Report',
      subtitle: 'View all leave records',
      variant: 'myLeaves',
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
      subtitle: 'View your leave history',
      variant: 'myLeaves',
    })
  }
  return cards
}
