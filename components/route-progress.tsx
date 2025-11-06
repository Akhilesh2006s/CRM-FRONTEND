'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function RouteProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // start
    setVisible(true)
    setProgress(20)
    const t1 = setTimeout(() => setProgress(80), 120)
    const t2 = setTimeout(() => {
      setProgress(100)
      const t3 = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 180)
      return () => clearTimeout(t3)
    }, 350)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60]">
      <div
        className="h-1 bg-blue-500 transition-[width] duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}





