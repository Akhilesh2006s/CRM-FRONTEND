import { permissionForPath } from './nav-permissions'

/** Routes that skip RBAC page check (always allowed when authenticated) */
export const ROUTE_PERMISSION_EXEMPT = new Set([
  '/dashboard',
  '/auth/login',
])

export function getRequiredPermissionForPath(pathname: string): string | null {
  if (ROUTE_PERMISSION_EXEMPT.has(pathname)) return null
  return permissionForPath(pathname)
}
