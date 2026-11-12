/** Leave / attendance policy shapes from the backend (`/leaves/balance`, `/leaves/preview`, `/holidays`). Same as web `lib/leavePolicy.ts`. */

export type HolidayWorkedDay = { date: string; reason: 'Sunday' | 'Holiday'; name: string };

export type LeaveBalance = {
  workType: 'field' | 'office';
  month: string;
  monthlyPaidLeave: { allowance: number; used: number; remaining: number };
  compOff: { earned: number; used: number; available: number; resetsOn: string | null; financialYear: string };
  totalAvailable: number;
  holidayWorked: HolidayWorkedDay[];
  lopDaysThisYear: number;
};

export type AllocationEntry = { date: string; fraction: number; source: 'monthly' | 'compoff' | 'lop'; sandwich?: boolean };

export type LeaveAllocation = {
  entries: AllocationEntry[];
  sandwichDates: string[];
  sandwichRuns?: { dates: string[]; before: string; after: string }[];
  chargedDays: number;
  monthlyDays: number;
  compOffDays: number;
  lopDays: number;
};

export type Holiday = { _id: string; date: string; name: string; year: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 'Sun 8 Nov' from 'YYYY-MM-DD'. */
export function shortDay(key: string): string {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return key;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}`;
}

/** '31 Mar 2027' from 'YYYY-MM-DD'. */
export function longDay(key: string): string {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return key;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export const SOURCE_LABELS: Record<AllocationEntry['source'], string> = {
  monthly: 'Paid from monthly leave',
  compoff: 'Paid from comp-off',
  lop: 'Loss of pay (salary deducted)',
};

export const fmtDays = (n: number) => `${n} ${n === 1 || n === 0.5 ? 'day' : 'days'}`;

/** Stored allocation of an approved leave (null for leaves approved before the policy). */
export function allocationOf(l: any): LeaveAllocation | null {
  const entries: AllocationEntry[] = Array.isArray(l?.allocation) ? l.allocation : [];
  if (entries.length === 0) return null;
  const sum = (src: string) => entries.filter((e) => e.source === src).reduce((t, e) => t + e.fraction, 0);
  return {
    entries,
    sandwichDates: l.sandwichDates || [],
    chargedDays: l.chargedDays ?? entries.reduce((t, e) => t + e.fraction, 0),
    monthlyDays: sum('monthly'),
    compOffDays: sum('compoff'),
    lopDays: l.lopDays ?? sum('lop'),
  };
}
