'use client'

import { usePermissions } from './PermissionsProvider'

type CanProps = {
  permission?: string | string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { hasPermission, hasAnyPermission } = usePermissions()

  if (!permission) return <>{children}</>

  const allowed = Array.isArray(permission)
    ? hasAnyPermission(permission)
    : hasPermission(permission)

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
