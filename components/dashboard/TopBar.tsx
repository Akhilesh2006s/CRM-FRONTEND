'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function TopBar() {
  const router = useRouter()
  const [company] = useState('C‑FORGIA')
  const [visible, setVisible] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const lastY = useRef(0)

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
    }
    router.push('/auth/login')
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastY.current + 10) {
        setVisible(false) // scrolling down
      } else if (y < lastY.current - 10) {
        setVisible(true) // scrolling up
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    
    // Check sidebar collapsed state from localStorage
    // Note: sidebarCollapsed stores !sidebarOpen, so when sidebarOpen is false, sidebarCollapsed is true
    const checkSidebarState = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sidebarCollapsed')
        const isCollapsed = saved ? JSON.parse(saved) : false
        setSidebarCollapsed(isCollapsed)
      }
    }
    checkSidebarState()
    
    // Listen for sidebar state changes
    const handleStorageChange = () => checkSidebarState()
    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically (in case of same-tab updates)
    const interval = setInterval(checkSidebarState, 100)
    
    // Listen for custom event dispatched by sidebar
    const handleSidebarToggle = () => checkSidebarState()
    window.addEventListener('sidebarToggle', handleSidebarToggle)
    
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('sidebarToggle', handleSidebarToggle)
      clearInterval(interval)
    }
  }, [])

  // Calculate left offset based on sidebar state
  // Collapsed: 64px (w-16), Expanded: 256px (w-64) on desktop, always 64px on mobile
  const leftOffset = sidebarCollapsed ? 'md:left-16' : 'md:left-64'
  
  return (
    <div className={`fixed top-0 left-16 ${leftOffset} right-0 z-40 transition-all duration-300 ease-out ${
      visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
    }`}>
      <div className="w-full bg-white/80 backdrop-blur-xl border-b border-neutral-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image 
                  src="/logo.png" 
                  alt="logo" 
                  width={28} 
                  height={28} 
                  className="rounded-lg ring-1 ring-neutral-200/50 shadow-sm" 
                />
              </div>
              <span className="text-base font-semibold tracking-tight text-neutral-900">{company}</span>
            </div>
            <button 
              onClick={handleLogout} 
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900 px-4 py-2 rounded-lg hover:bg-neutral-100/80 transition-all duration-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


