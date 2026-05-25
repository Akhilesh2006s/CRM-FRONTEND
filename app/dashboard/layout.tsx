'use client'

import type React from "react"
import { useEffect } from "react"
import { TopBar } from "@/components/dashboard/TopBar"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { RequireAuth } from "@/components/require-auth"
import { SidebarProvider } from "@/contexts/SidebarContext"

function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto p-6 md:p-8"
      id="main-content"
    >
      <RequireAuth>
        <div className="w-full min-w-0">{children}</div>
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

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-neutral-50/50">
      <Sidebar />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden pl-16 md:pl-0">
        <TopBar />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  )
}
