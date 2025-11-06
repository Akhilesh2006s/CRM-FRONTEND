import type React from "react"
import { TopBar } from "@/components/dashboard/TopBar"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { RequireAuth } from "@/components/require-auth"

// Premium Dashboard layout - Apple x Notion x Linear x Stripe inspired
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50/50">
      <TopBar />
      <div className="flex pt-0">
        <Sidebar />
        <main className="flex-1 transition-all duration-300 ease-out md:ml-64 ml-16 p-6 md:p-8 pt-24 md:pt-24" id="main-content">
          <RequireAuth>
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </RequireAuth>
        </main>
      </div>
    </div>
  )
}


