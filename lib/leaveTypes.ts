/** Matches backend `Leave.leaveType` enum (`backend/utils/leavePolicy.js` ALL_LEAVE_TYPES). */
export const LEAVE_TYPE_ENUM = [
  'Sick Leave',
  'Company Paid Leave',
  'Comp Off',
  'Unpaid Leave',
  'Annual Leave',
  'Casual Leave',
  'Emergency Leave',
  'Other',
] as const

export type LeaveTypeValue = (typeof LEAVE_TYPE_ENUM)[number]

/**
 * Request-form options. Sick Leave / Company Paid Leave use the monthly paid leave (1 a month),
 * Comp Off uses comp-offs earned by working Sundays / holidays, Unpaid Leave is loss of pay.
 */
export const LEAVE_TYPE_OPTIONS: { label: string; value: LeaveTypeValue; hint: string }[] = [
  { label: 'Sick Leave', value: 'Sick Leave', hint: 'Paid from monthly leave, then comp-off' },
  { label: 'Company Paid Leave', value: 'Company Paid Leave', hint: 'Paid from monthly leave, then comp-off' },
  { label: 'Comp Off', value: 'Comp Off', hint: 'Paid from comp-offs earned on holidays worked' },
  { label: 'Unpaid Leave', value: 'Unpaid Leave', hint: 'Loss of pay (salary deducted)' },
]

const LABEL_BY_VALUE: Record<string, string> = {
  'Sick Leave': 'Sick Leave',
  'Company Paid Leave': 'Company Paid Leave',
  'Comp Off': 'Comp Off',
  'Unpaid Leave': 'Unpaid Leave',
  'Annual Leave': 'Earned Leave',
  'Casual Leave': 'Casual Leave',
  'Emergency Leave': 'Emergency Leave',
  'Other': 'Other',
}

/** Map a stored enum value to the UI label without changing the record. */
export function leaveTypeLabel(value?: string | null): string {
  if (!value) return '-'
  return LABEL_BY_VALUE[value] ?? value
}


/** Matches backend `Leave.dayType` (default Full Day; Half Day = one date, 0.5 day). */
export const LEAVE_DAY_TYPES = ['Full Day', 'Half Day'] as const
export type LeaveDayType = (typeof LEAVE_DAY_TYPES)[number]

/** Optional half of the day for a Half Day leave (`Leave.halfDaySession`). */
export const HALF_DAY_SESSIONS = ['First Half', 'Second Half'] as const
export type HalfDaySession = (typeof HALF_DAY_SESSIONS)[number]

type LeaveDayFields = {
  dayType?: string | null
  halfDaySession?: string | null
  days?: number | null
  startDate?: string | null
  endDate?: string | null
}

export function isHalfDayLeave(leave?: LeaveDayFields | null): boolean {
  return String(leave?.dayType || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'halfday'
}

/** Leave days: 0.5 for a half day, else stored days or the inclusive date count. */
export function leaveDayCount(leave?: LeaveDayFields | null): number {
  if (!leave) return 0
  if (isHalfDayLeave(leave)) return 0.5
  const stored = Number(leave.days)
  if (Number.isFinite(stored) && stored > 0) return stored
  if (!leave.startDate) return 0
  const from = new Date(leave.startDate).getTime()
  const to = new Date(leave.endDate || leave.startDate).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
  return Math.round((to - from) / 86400000) + 1
}

/** '0.5 day', '1 day', '3 days'. */
export function formatLeaveDays(n: number): string {
  return `${n} ${n === 1 || n === 0.5 ? 'day' : 'days'}`
}

/** 'Full Day' or 'Half Day (First Half)'. */
export function leaveDayTypeLabel(leave?: LeaveDayFields | null): string {
  if (!isHalfDayLeave(leave)) return 'Full Day'
  return leave?.halfDaySession ? `Half Day (${leave.halfDaySession})` : 'Half Day'
}
