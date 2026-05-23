'use client'

import type React from "react"
import { TopBar } from "@/components/dashboard/TopBar"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { RequireAuth } from "@/components/require-auth"
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext"

// Main content component that uses sidebar state
function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main 
      className="flex-1 flex flex-col min-h-0 p-6 md:p-8 ml-16 md:ml-0 overflow-hidden min-w-0" 
      id="main-content"
      style={{ minWidth: 0 }}
    >
      <RequireAuth>
        <div className="w-full min-w-0 flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </RequireAuth>
    </main>
  )
}

// Premium Dashboard layout - Apple x Notion x Linear x Stripe inspired
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50/50">
      <TopBar />
      <div className="flex items-start min-h-[calc(100dvh-4rem)] pt-16">
        <Sidebar />
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


