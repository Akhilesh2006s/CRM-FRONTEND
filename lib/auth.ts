'use client'

import { apiRequest } from './api'

type AuthResponse = {
  _id: string
  name: string
  email: string
  role: string
  token: string
}

export async function login(email: string, password: string) {
  const data = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('authUser', JSON.stringify(data))
  }
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
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('authUser', JSON.stringify(data))
  }
  return data
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
  }
}

export function getCurrentUser(): AuthResponse | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('authUser')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthResponse
  } catch {
    return null
  }
}


