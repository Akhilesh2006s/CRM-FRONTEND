'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function TopBar() {
  const router = useRouter()
  const [company] = useState('C‑FORGIA')
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)

  const handleLogout = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken')
        localStorage.removeItem('authUser')
      }
      router.push('/auth/login')
    } catch (error) {
      console.error('Error during logout:', error)
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    }
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastY.current + 10) {
        setVisible(false)
      } else if (y < lastY.current - 10) {
        setVisible(true)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`no-print sticky top-0 z-30 shrink-0 border-b border-neutral-200/50 bg-white/80 backdrop-blur-xl shadow-sm transition-all duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="logo"
            width={28}
            height={28}
            className="rounded-lg ring-1 ring-neutral-200/50 shadow-sm"
          />
          <span className="text-base font-semibold tracking-tight text-neutral-900">{company}</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-neutral-700 hover:text-neutral-900 px-4 py-2 rounded-lg hover:bg-neutral-100/80 transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
