/** Leave / attendance policy shapes from the backend (`/leaves/balance`, `/leaves/preview`, `/holidays`). */

export type HolidayWorkedDay = { date: string; reason: 'Sunday' | 'Holiday'; name: string }

export type LeaveBalance = {
  workType: 'field' | 'office'
  month: string
  monthlyPaidLeave: { allowance: number; used: number; remaining: number }
  compOff: { earned: number; used: number; available: number; resetsOn: string | null; financialYear: string }
  totalAvailable: number
  holidayWorked: HolidayWorkedDay[]
  lopDaysThisYear: number
}

export type AllocationEntry = { date: string; fraction: number; source: 'monthly' | 'compoff' | 'lop'; sandwich?: boolean }

export type LeaveAllocation = {
  entries: AllocationEntry[]
  sandwichDates: string[]
  sandwichRuns?: { dates: string[]; before: string; after: string }[]
  chargedDays: number
  monthlyDays: number
  compOffDays: number
  lopDays: number
}

export type Holiday = { _id: string; date: string; name: string; year: number }

/** 'Sun 8 Nov' from 'YYYY-MM-DD'. */
export function shortDay(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** '31 Mar 2027' from 'YYYY-MM-DD'. */
export function longDay(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const SOURCE_LABELS: Record<AllocationEntry['source'], string> = {
  monthly: 'Paid from monthly leave',
  compoff: 'Paid from comp-off',
  lop: 'Loss of pay (salary deducted)',
}

export const fmtDays = (n: number) => `${n} ${n === 1 || n === 0.5 ? 'day' : 'days'}`
