/** PJP (Planned Journey Plan) types and helpers shared by the web pages. Same API as the app. */

export const PJP_ROLES = new Set([
  'Executive', 'Sales BDE', 'Employee', 'BDE', 'Trainer',
  'Admin', 'Super Admin', 'Manager', 'Executive Manager', 'Coordinator', 'Senior Coordinator',
  'Regional Manager', 'Regional Head', 'National Head', 'HR Manager',
])

/** Roles that see their team's plans (Team PJP). */
export const PJP_TEAM_ROLES = new Set([
  'Admin', 'Super Admin', 'Manager', 'Executive Manager', 'Coordinator', 'Senior Coordinator',
  'Regional Manager', 'Regional Head', 'National Head', 'HR Manager', 'HR Executive',
])

export type PjpItem = {
  _id?: string
  date: string
  time: string
  schoolName: string
  schoolCode?: string
  leadId?: string
  location?: string
  purpose: string
  notes?: string
  visitStatus?: 'Completed' | 'Pending' | 'Missed'
  actual?: { kind: string; at?: string | null } | null
}

export type PjpSummary = { planned: number; completed: number; pending: number; missed: number; unplanned: number }

type Person = { _id?: string; name?: string; empCode?: string; role?: string } | null

export type Pjp = {
  _id: string
  employeeId: Person
  period: 'Weekly' | 'Monthly'
  fromDate: string
  toDate: string
  items: PjpItem[]
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
  approverId?: Person
  decidedBy?: Person
  decidedAt?: string
  remarks?: string
  submittedAt?: string
  changeRequest?: {
    items: PjpItem[]
    fromDate?: string
    toDate?: string
    reason?: string
    status: 'Pending' | 'Approved' | 'Rejected'
    requestedAt?: string
    remarks?: string
  } | null
  history?: { action: string; by?: Person; at: string; note?: string }[]
  summary?: PjpSummary
  unplanned?: { day: string; schoolName: string; kind: string }[]
  isOwn?: boolean
  canEdit?: boolean
  canSubmit?: boolean
  canDelete?: boolean
  canDecide?: boolean
}

export const PJP_PURPOSES = [
  'New Lead Visit', 'Follow-up', 'Demo', 'Order Collection', 'Payment Collection',
  'Training', 'Service', 'Relationship Visit', 'Other',
]

export const dmy = (k?: string) => (k ? k.split('-').reverse().join('/') : '')
export const weekday = (k: string) =>
  new Date(`${k}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })

/** 'HH:MM' to '10:30 AM'. */
export function time12(t?: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (!Number.isFinite(h)) return t
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export function periodEnd(period: string, from: string) {
  if (!from) return ''
  if (period === 'Monthly') {
    const d = new Date(`${from}T00:00:00Z`)
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
    return addDays(next.toISOString().slice(0, 10), -1)
  }
  return addDays(from, 6)
}

export function daysBetween(from: string, to: string) {
  const out: string[] = []
  if (!from || !to || to < from) return out
  for (let d = from; d <= to && out.length < 40; d = addDays(d, 1)) out.push(d)
  return out
}

/** Label of a plan's state, with a pending change shown as "Change waiting". */
export function pjpStatusLabel(p: Pick<Pjp, 'status' | 'changeRequest'>) {
  if (p.changeRequest?.status === 'Pending') return 'Change waiting'
  if (p.status === 'Submitted') return 'Waiting for approval'
  return p.status
}

export function pjpStatusClass(p: Pick<Pjp, 'status' | 'changeRequest'>) {
  if (p.changeRequest?.status === 'Pending' || p.status === 'Submitted') return 'bg-amber-100 text-amber-800'
  if (p.status === 'Approved') return 'bg-green-100 text-green-800'
  if (p.status === 'Rejected') return 'bg-red-100 text-red-700'
  return 'bg-neutral-100 text-neutral-700'
}

export function visitStatusClass(s?: string) {
  if (s === 'Completed') return 'bg-green-100 text-green-800'
  if (s === 'Missed') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-800'
}

export type Reminder = {
  kind: string
  schoolName: string
  date: string
  time: string
  location: string
  detail: string
  id: string
}
export type Reminders = { today: string; todayItems: Reminder[]; upcomingItems: Reminder[] }
