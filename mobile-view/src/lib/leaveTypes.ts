/**
 * Request-form leave types (backend `utils/leavePolicy.js` LEAVE_TYPES). Sick Leave / Company Paid Leave
 * use the monthly paid leave (1 a month), Comp Off uses comp-offs, Unpaid Leave is loss of pay.
 */
export const LEAVE_TYPE_OPTIONS = [
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Company Paid Leave', value: 'Company Paid Leave' },
  { label: 'Comp Off', value: 'Comp Off' },
  { label: 'Unpaid Leave', value: 'Unpaid Leave' },
] as const;

export const LEAVE_TYPE_HINTS: Record<string, string> = {
  'Sick Leave': 'Paid from monthly leave, then comp-off',
  'Company Paid Leave': 'Paid from monthly leave, then comp-off',
  'Comp Off': 'Paid from comp-offs earned on holidays worked',
  'Unpaid Leave': 'Loss of pay (salary deducted)',
};

const LABEL_BY_VALUE: Record<string, string> = {
  'Sick Leave': 'Sick Leave',
  'Company Paid Leave': 'Company Paid Leave',
  'Comp Off': 'Comp Off',
  'Unpaid Leave': 'Unpaid Leave',
  'Annual Leave': 'Earned Leave',
  'Casual Leave': 'Casual Leave',
  'Emergency Leave': 'Emergency Leave',
  Other: 'Other',
};

export function leaveTypeLabel(value?: string | null): string {
  if (!value) return '-';
  return LABEL_BY_VALUE[value] ?? value;
}


/** Matches backend `Leave.dayType` (default Full Day; Half Day = one date, 0.5 day). */
export const LEAVE_DAY_TYPES = ['Full Day', 'Half Day'] as const;
export type LeaveDayType = (typeof LEAVE_DAY_TYPES)[number]

/** Optional half of the day for a Half Day leave (`Leave.halfDaySession`). */
export const HALF_DAY_SESSIONS = ['First Half', 'Second Half'] as const;
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
