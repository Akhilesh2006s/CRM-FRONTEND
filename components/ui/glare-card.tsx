"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type GlareCardProps = React.HTMLAttributes<HTMLDivElement> & {
  fromColor?: string
  toColor?: string
}

export function GlareCard({ className, children, fromColor = '#38bdf8', toColor = '#7c3aed', ...props }: GlareCardProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ x: 50, y: 50 })

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setPos({ x, y })
    }
    el.addEventListener("mousemove", onMove)
    return () => el.removeEventListener("mousemove", onMove)
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-2xl border border-neutral-200 bg-white/90 shadow-2xl overflow-hidden",
        "before:pointer-events-none before:absolute before:inset-[-1px] before:rounded-2xl before:bg-gradient-to-br before:from-white/40 before:to-transparent",
        className,
      )}
      style={{
        // colorful sweep + subtle radial glare following the cursor
        backgroundImage: `linear-gradient(135deg, ${fromColor}, ${toColor}), radial-gradient(600px circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.35), transparent 40%)`,
        backgroundBlendMode: 'overlay',
      }}
      {...props}
    >
      {/* soft drop shadow */}
      <div className="absolute -bottom-10 left-1/2 h-24 w-[120%] -translate-x-1/2 rounded-full bg-black/10 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  )
}

export function GlareCardDemo() {
  return (
    <GlareCard className="flex flex-col items-center justify-center p-10 bg-neutral-900 text-white">
      <svg
        width="66"
        height="65"
        viewBox="0 0 66 65"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-7 w-7 text-white"
      >
        <path
          d="M8 8.05571C8 8.05571 54.9009 18.1782 57.8687 30.062C60.8365 41.9458 9.05432 57.4696 9.05432 57.4696"
          stroke="currentColor"
          strokeWidth="15"
          strokeMiterlimit="3.86874"
          strokeLinecap="round"
        />
      </svg>
      <p className="font-bold text-xl mt-4">Aceternity</p>
    </GlareCard>
  )
}


