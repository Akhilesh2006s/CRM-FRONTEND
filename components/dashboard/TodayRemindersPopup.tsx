'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CalendarClock, MapPin } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { dmy, time12, type Reminder, type Reminders } from '@/lib/pjp'

const KIND_CLASS: Record<string, string> = {
  'Follow-up': 'bg-sky-100 text-sky-800',
  'Visit due': 'bg-sky-100 text-sky-800',
  Training: 'bg-violet-100 text-violet-800',
  Service: 'bg-violet-100 text-violet-800',
  'PJP visit': 'bg-emerald-100 text-emerald-800',
}

function ReminderRow({ r, showDate }: { r: Reminder; showDate?: boolean }) {
  return (
    <li className="rounded-lg border border-neutral-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-neutral-900">{r.schoolName}</div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${KIND_CLASS[r.kind] || 'bg-neutral-100 text-neutral-700'}`}>{r.kind}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-4 w-4" />
          {showDate ? `${dmy(r.date)} · ` : ''}
          {r.time ? time12(r.time) : 'Any time'}
        </span>
        {r.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {r.location}
          </span>
        ) : null}
      </div>
      {r.detail ? <div className="mt-1 text-xs text-neutral-500">{r.detail}</div> : null}
    </li>
  )
}

/**
 * Home page pop-up: today's follow-ups (BDE), trainings / services (Trainer) and PJP visits.
 * Shown once per sign-in session and day.
 */
export function TodayRemindersPopup() {
  const pathname = usePathname()
  const [data, setData] = useState<Reminders | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (pathname !== '/dashboard') return
    const user = getCurrentUser() as { _id?: string; role?: string } | null
    if (!user?._id || ['Vendor', 'Partner', 'Franchise'].includes(String(user.role))) return
    let cancelled = false
    apiRequest<Reminders>('/dashboard/today-reminders')
      .then((r) => {
        if (cancelled || !r || (r.todayItems.length === 0 && r.upcomingItems.length === 0)) return
        const key = `todayReminders:${user._id}:${r.today}`
        try {
          if (sessionStorage.getItem(key)) return
          sessionStorage.setItem(key, '1')
        } catch {
          // Storage blocked: show it anyway.
        }
        setData(r)
        setOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname])

  if (!data) return null
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Today, {dmy(data.today)}</DialogTitle>
        </DialogHeader>
        {data.todayItems.length ? (
          <ul className="space-y-2">
            {data.todayItems.map((r) => (
              <ReminderRow key={`${r.kind}-${r.id}-${r.time}`} r={r} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600">Nothing scheduled for today.</p>
        )}
        {data.upcomingItems.length ? (
          <>
            <div className="mt-2 text-sm font-semibold text-neutral-800">Coming up</div>
            <ul className="space-y-2">
              {data.upcomingItems.map((r) => (
                <ReminderRow key={`${r.kind}-${r.id}-${r.date}`} r={r} showDate />
              ))}
            </ul>
          </>
        ) : null}
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
