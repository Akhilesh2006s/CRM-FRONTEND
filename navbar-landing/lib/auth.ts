'use client'

import type { AuthUserWithPermissions } from './permissions'
import { persistAuthUser } from './permissions'
import { apiRequest } from './api'

type AuthResponse = AuthUserWithPermissions

export async function login(mobile: string, password: string) {
  const data = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, email: mobile, password }),
  })
  persistAuthUser(data)
  return data
}

export async function registerUser(payload: {
  name: string
  email: string
  password: string
  role?: string
  phone?: string
  department?: string
}) {
  const data = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  persistAuthUser(data)
  return data
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
  }
}

export function getCurrentUser(): AuthUserWithPermissions | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('authUser')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUserWithPermissions
  } catch {
    return null
  }
}

export async function refreshAuthUser(): Promise<AuthUserWithPermissions | null> {
  try {
    const me = await apiRequest<AuthUserWithPermissions>('/auth/me')
    const existing = getCurrentUser()
    const merged = { ...existing, ...me, token: existing?.token || '' } as AuthUserWithPermissions
    persistAuthUser(merged)
    return merged
  } catch {
    return getCurrentUser()
  }
}


