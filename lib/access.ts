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

  // Higher hierarchy roles open assigned Zonal Manager dashboards. The API rejects anyone outside their chain.
  if (
    user.role === 'Regional Manager' ||
    user.role === 'Regional Head' ||
    user.role === 'National Head'
  ) {
    return true
  }

  return false
}

function canAccessHierarchyPath(user: AuthUserWithPermissions, pathname: string): boolean {
  if (user.role === 'Super Admin' || user.isSuperAdmin) return true
  if (pathname === '/dashboard/hierarchy') return false

  const regionalManager = pathname.match(/^\/dashboard\/hierarchy\/regional-manager\/([^/]+)(?:\/|$)/)
  if (regionalManager) {
    if (user.role === 'Regional Manager') return String(user._id) === regionalManager[1]
    return user.role === 'Regional Head' || user.role === 'National Head'
  }

  const regionalHead = pathname.match(/^\/dashboard\/hierarchy\/regional-head\/([^/]+)(?:\/|$)/)
  if (regionalHead) {
    if (user.role === 'Regional Head') return String(user._id) === regionalHead[1]
    return user.role === 'National Head'
  }

  const nationalHead = pathname.match(/^\/dashboard\/hierarchy\/national-head\/([^/]+)(?:\/|$)/)
  if (nationalHead) {
    return user.role === 'National Head' && String(user._id) === nationalHead[1]
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
  if (pathname === '/dashboard/dc/pending' || pathname.startsWith('/dashboard/dc/pending/')) {
    return user.role === 'Senior Coordinator'
  }
  if (
    (user.role === 'Executive' || user.role === 'Sales BDE') &&
    (pathname === '/dashboard/dc/create' ||
      pathname.startsWith('/dashboard/dc/create/') ||
      pathname === '/dashboard/dc/emp' ||
      pathname.startsWith('/dashboard/dc/emp/'))
  ) {
    return true
  }
  if (user.role === 'Manager') {
    return (
      pathname === '/dashboard' ||
      pathname === '/dashboard/product-manager' ||
      pathname.startsWith('/dashboard/settings/password')
    )
  }
  if (!isRbacActive(user)) return true

  if (pathname === '/dashboard/dc/grid' || pathname.startsWith('/dashboard/dc/grid/')) {
    return ['clients.create_sale.page.view', 'clients.my_clients.page.view', 'clients.closed_sales.approve_dc']
      .some((key) => hasPermission(user, key))
  }

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

  if (pathname === '/dashboard/hierarchy' || pathname.startsWith('/dashboard/hierarchy/')) {
    return canAccessHierarchyPath(user, pathname)
  }

  const isEmWorkspace = EXECUTIVE_MANAGER_WORKSPACE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
  if (isEmWorkspace) {
    return canAccessExecutiveManagerWorkspace(user, pathname)
  }

  // Trainer raises a training request the same way a BDE does.
  if (
    user.role === 'Trainer' &&
    (pathname === '/dashboard/training/request' || pathname.startsWith('/dashboard/training/request/'))
  ) {
    return true
  }

  // BDE logs OPERATIONS visits from Clients → Visits
  if (
    user.role === 'Executive' &&
    (pathname === '/dashboard/visits' || pathname.startsWith('/dashboard/visits/'))
  ) {
    return true
  }

  if (
    user.role === 'Office Team' &&
    (pathname === '/dashboard' ||
      pathname === '/dashboard/attendance' ||
      pathname.startsWith('/dashboard/attendance/') ||
      pathname === '/dashboard/leaves/request' ||
      pathname === '/dashboard/leaves/approved' ||
      pathname.startsWith('/dashboard/leaves/request/') ||
      pathname.startsWith('/dashboard/leaves/approved/') ||
      pathname === '/dashboard/expenses/create' ||
      pathname === '/dashboard/expenses/my' ||
      pathname.startsWith('/dashboard/expenses/create/') ||
      pathname.startsWith('/dashboard/expenses/my/') ||
      pathname === '/dashboard/payslips' ||
      pathname.startsWith('/dashboard/settings/password'))
  ) {
    return true
  }

  // HR Manager always has employee directory + verification + leave access
  if (
    (user.role === 'HR Manager' || user.role === 'HR Executive') &&
    (pathname.startsWith('/dashboard/employees') ||
      pathname.startsWith('/dashboard/leaves') ||
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/settings/password'))
  ) {
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
