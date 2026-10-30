'use client'

import { formatLeaveDays, isHalfDayLeave, leaveDayCount, leaveDayTypeLabel } from '@/lib/leaveTypes'

type LeaveDayFields = {
  dayType?: string | null
  halfDaySession?: string | null
  days?: number | null
  startDate?: string | null
  endDate?: string | null
}

/**
 * Full Day / Half Day tag with the day count, e.g. "Half Day (First Half) · 0.5 day".
 * Leaves saved before day types existed show as Full Day.
 */
export function LeaveDayTypeBadge({ leave, showDays = true }: { leave: LeaveDayFields; showDays?: boolean }) {
  const half = isHalfDayLeave(leave)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        half ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-700'
      }`}
    >
      {leaveDayTypeLabel(leave)}
      {showDays ? ` · ${formatLeaveDays(leaveDayCount(leave))}` : ''}
    </span>
  )
}
