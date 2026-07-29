'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'
import {
  AuthUserWithPermissions,
  hasPermission as checkPermission,
  hasAnyPermission as checkAny,
  isSuperAdmin as checkSuperAdmin,
  isRbacActive,
  hasNoModuleAccess,
  readAuthUser,
} from '@/lib/permissions'
import { apiRequest } from '@/lib/api'

type PermissionsContextValue = {
  user: AuthUserWithPermissions | null
  permissions: string[]
  isSuperAdmin: boolean
  rbacActive: boolean
  permissionsReady: boolean
  noModuleAccess: boolean
  hasPermission: (key: string) => boolean
  hasAnyPermission: (keys: string[]) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

function readInitialUser(): AuthUserWithPermissions | null {
  return readAuthUser() || getCurrentUser()
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserWithPermissions | null>(null)
  const [permissionsReady, setPermissionsReady] = useState(false)
  const fetchStarted = useRef(false)

  const loadUser = useCallback(() => {
    setUser(readInitialUser())
  }, [])

  const refreshPermissions = useCallback(async () => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    if (!token) {
      loadUser()
      setPermissionsReady(true)
      return
    }
    try {
      const me = await apiRequest<AuthUserWithPermissions & { permissions?: string[] }>(
        '/auth/me'
      )
      const existing = readAuthUser()
      const merged: AuthUserWithPermissions = {
        ...(existing || {}),
        ...me,
        token: existing?.token || me.token || token,
      } as AuthUserWithPermissions
      if (typeof window !== 'undefined') {
        localStorage.setItem('authUser', JSON.stringify(merged))
      }
      setUser(merged)
    } catch {
      loadUser()
    } finally {
      setPermissionsReady(true)
    }
  }, [loadUser])

  useEffect(() => {
    if (fetchStarted.current) return
    fetchStarted.current = true
    loadUser()
    refreshPermissions().catch(() => setPermissionsReady(true))
  }, [loadUser, refreshPermissions])

  const value = useMemo<PermissionsContextValue>(() => {
    const permissions = user?.permissions || []
    const superAdmin = checkSuperAdmin(user)
    const rbacActive = isRbacActive(user)
    return {
      user,
      permissions,
      isSuperAdmin: superAdmin,
      rbacActive,
      permissionsReady,
      noModuleAccess: hasNoModuleAccess(user),
      hasPermission: (key: string) => checkPermission(user, key),
      hasAnyPermission: (keys: string[]) => checkAny(user, keys),
      refreshPermissions,
    }
  }, [user, permissionsReady, refreshPermissions])

  return (
    <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) {
    throw new Error('usePermissions must be used within PermissionsProvider')
  }
  return ctx
}

export function usePermission(key: string): boolean {
  const { hasPermission } = usePermissions()
  return hasPermission(key)
}
