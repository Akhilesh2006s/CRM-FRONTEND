import { permissionForPath } from './nav-permissions'
import {
  type AuthUserWithPermissions,
  hasPermission,
  isRbacActive,
  isSuperAdmin,
} from './permissions'

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
