import { permissionForPath } from './nav-permissions'
import {
  type AuthUserWithPermissions,
  hasPermission,
  isRbacActive,
  isSuperAdmin,
} from './permissions'

/** Personal EM routes — must not inherit All Managers (`executive_managers.list`) permission. */
const EXECUTIVE_MANAGER_OWN_ROUTE =
  /^\/dashboard\/executive-managers\/([^/]+)\/(dashboard|leaves)(?:\/|$)/

/**
 * Executive Manager workspace routes (sidebar role menu).
 * These are intentionally granted by role, not via the admin All Managers permission.
 */
const EXECUTIVE_MANAGER_WORKSPACE_ROUTES = [
  '/dashboard/executive-managers/executives',
  '/dashboard/expenses/executive-manager-pending',
  '/dashboard/clients/closed-sales',
]

function canAccessExecutiveManagerOwnRoute(
  user: AuthUserWithPermissions,
  pathname: string
): boolean {
  const match = pathname.match(EXECUTIVE_MANAGER_OWN_ROUTE)
  if (!match) return false

  const managerId = match[1]

  // Admins who can list managers may open any manager's dashboard/leaves
  if (user.role === 'Admin' || hasPermission(user, 'executive_managers.list.page.view')) {
    return true
  }

  // Executive Manager may only open their own dashboard/leaves
  if (user.role === 'Executive Manager') {
    return String(user._id) === String(managerId)
  }

  return false
}

function canAccessExecutiveManagerWorkspace(
  user: AuthUserWithPermissions,
  pathname: string
): boolean {
  if (user.role !== 'Executive Manager') return false
  return EXECUTIVE_MANAGER_WORKSPACE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

/** Same rule for sidebar links and RouteGuard page access */
export function canAccessPath(
  user: AuthUserWithPermissions | null,
  pathname: string,
  options?: { loading?: boolean }
): boolean {
  if (options?.loading) return true
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (!isRbacActive(user)) return true

  // All Created DCs — Admin + Coordinators + Super Admin (via Create Sale redirect / Clients nav).
  if (
    (user.role === 'Admin' ||
      user.role === 'Coordinator' ||
      user.role === 'Senior Coordinator') &&
    (pathname === '/dashboard/dc/admin/my' || pathname.startsWith('/dashboard/dc/admin/my/'))
  ) {
    return true
  }

  if (EXECUTIVE_MANAGER_OWN_ROUTE.test(pathname)) {
    return canAccessExecutiveManagerOwnRoute(user, pathname)
  }

  // Role-based workspace for Executive Managers (Executives list, pending expenses, PO edits)
  if (canAccessExecutiveManagerWorkspace(user, pathname)) {
    return true
  }

  const key = permissionForPath(pathname)
  if (!key) return true
  return hasPermission(user, key)
}

export function canAccessHref(
  user: AuthUserWithPermissions | null,
  href: string | undefined
): boolean {
  if (!href || href === '/auth/login') return true
  return canAccessPath(user, href)
}
