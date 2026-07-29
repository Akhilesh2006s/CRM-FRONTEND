export type AuthUserWithPermissions = {
  _id: string
  name: string
  email: string
  role: string
  roleId?: string | null
  roleName?: string
  token: string
  permissions?: string[]
  isSuperAdmin?: boolean
  rbacEnabled?: boolean
}

export function isRbacActive(user: AuthUserWithPermissions | null): boolean {
  if (!user) return false
  if (user.rbacEnabled === false) return false
  return Array.isArray(user.permissions)
}

export function isSuperAdmin(user: AuthUserWithPermissions | null): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  return user.role === 'Super Admin'
}

export function hasPermission(
  user: AuthUserWithPermissions | null,
  key: string | undefined | null
): boolean {
  if (!key) return true
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (!isRbacActive(user)) return true
  return (user.permissions || []).includes(key)
}

export function hasAnyPermission(
  user: AuthUserWithPermissions | null,
  keys: string[]
): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  if (!isRbacActive(user)) return true
  return keys.some((k) => hasPermission(user, k))
}

export function hasModuleAccess(user: AuthUserWithPermissions | null, module: string): boolean {
  return hasPermission(user, `${module}.module.view`)
}

export function canViewPage(user: AuthUserWithPermissions | null, pageKey: string): boolean {
  return hasPermission(user, pageKey)
}

export function hasNoModuleAccess(user: AuthUserWithPermissions | null): boolean {
  if (!user) return true
  if (isSuperAdmin(user)) return false
  if (!isRbacActive(user)) return false
  const perms = user.permissions || []
  if (perms.length === 0) return true
  return !perms.some((k) => k.endsWith('.module.view') || k.endsWith('.page.view'))
}

export function persistAuthUser(data: AuthUserWithPermissions) {
  if (typeof window === 'undefined') return
  localStorage.setItem('authToken', data.token)
  localStorage.setItem('authUser', JSON.stringify(data))
}

export function readAuthUser(): AuthUserWithPermissions | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('authUser')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUserWithPermissions
  } catch {
    return null
  }
}
