'use client'

import type React from "react"
import { useEffect } from "react"
import { TopBar } from "@/components/dashboard/TopBar"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { RequireAuth } from "@/components/require-auth"
import { SidebarProvider } from "@/contexts/SidebarContext"
import { PermissionsProvider } from "@/components/permissions/PermissionsProvider"
import { RouteGuard } from "@/components/permissions/RouteGuard"

function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto p-6 md:p-8"
      id="main-content"
    >
      <RequireAuth>
        <RouteGuard>
          <div className="w-full min-w-0">{children}</div>
        </RouteGuard>
      </RequireAuth>
    </main>
  )
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  // The login is shared by every tab of this browser. When another tab signs in as someone
  // else (or signs out), reload so this tab never shows one user while acting as another.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'authToken' || event.key === null) window.location.reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-neutral-50/50">
      <Sidebar />
      {/* pl-16: room for fixed collapsed sidebar on small screens */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden pl-16 md:pl-0">
        <TopBar />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <SidebarProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
