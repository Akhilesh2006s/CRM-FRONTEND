/** Role-aware navigation targets for dashboard KPI cards (index matches STAT_CONFIG). */

const FOLLOW_UP_REPORT = '/dashboard/reports/leads/follow-up-leads'

const DEFAULT_STAT_HREFS: (string | null)[] = [
  '/dashboard/leads',
  '/dashboard/dc/closed',
  '/dashboard/leads/renewal',
  '/dashboard/training/list',
  '/dashboard/training/list',
  '/dashboard/training/services',
  '/dashboard/training/services',
]

const ROLES_WITHOUT_CLIENTS = new Set([
  'Manager',
  'Warehouse Executive',
  'Warehouse Manager',
  'Trainer',
])

const ROLES_WITHOUT_TRAINING = new Set([
  'Manager',
  'Executive',
  'Executive Manager',
  'Warehouse Executive',
  'Warehouse Manager',
  'Trainer',
])

const ROLES_WITHOUT_REPORTS = new Set([
  'Executive',
  'Trainer',
  'Warehouse Executive',
  'Warehouse Manager',
  'Partner',
  'Vendor',
])

export function getAlertHref(level: 'warning' | 'info'): string {
  if (level === 'warning') return FOLLOW_UP_REPORT
  return '/dashboard/training/list'
}

export const DASHBOARD_ALERTS_VIEW_ALL = FOLLOW_UP_REPORT

export function getStatHref(role: string | undefined, index: number): string | null {
  if (index < 0 || index >= DEFAULT_STAT_HREFS.length) return null
  const r = role || ''

  if (index === 0) {
    if (r === 'Executive') return '/dashboard/leads/followup'
    if (ROLES_WITHOUT_CLIENTS.has(r) && r !== 'Coordinator' && r !== 'Senior Coordinator') {
      if (r === 'Manager') return '/dashboard/reports/leads'
      return null
    }
    return DEFAULT_STAT_HREFS[0]
  }

  if (index === 1) {
    if (r === 'Executive') return '/dashboard/dc/client-dc'
    if (r === 'Trainer') return '/dashboard/training/trainer/my'
    if (r === 'Warehouse Executive' || r === 'Warehouse Manager') {
      return '/dashboard/returns/warehouse-executive'
    }
    return DEFAULT_STAT_HREFS[1]
  }

  if (index === 2) {
    if (ROLES_WITHOUT_CLIENTS.has(r)) return null
    return DEFAULT_STAT_HREFS[2]
  }

  if (index >= 3 && index <= 6) {
    if (ROLES_WITHOUT_TRAINING.has(r)) return null
    return DEFAULT_STAT_HREFS[index]
  }

  return DEFAULT_STAT_HREFS[index]
}

export function canViewChangeLogs(role: string | undefined): boolean {
  if (!role) return false
  return !ROLES_WITHOUT_REPORTS.has(role)
}

export const SECTION_REDIRECTS: Record<string, string> = {
  leads: '/dashboard/leads',
  sales: '/dashboard/dc/closed',
  employees: '/dashboard/employees',
  expenses: '/dashboard/expenses',
  payments: '/dashboard/payments',
  reports: '/dashboard/reports/leads',
  training: '/dashboard/training',
  warehouse: '/dashboard/warehouse',
  dc: '/dashboard/dc',
  inventory: '/dashboard/warehouse/inventory-items',
}

export const AI_TEASER_TOOLS = [
  { id: 'revenue-at-risk', title: 'Revenue at Risk' },
  { id: 'executive-dashboard', title: 'Executive Dashboard' },
  { id: 'priority-engine', title: 'Smart Priority Engine' },
  { id: 'deal-risk-scoring', title: 'Deal Risk Scoring' },
  { id: 'performance-risk', title: 'Performance Risk Index' },
  { id: 'fraud-detection', title: 'Fraud Detection' },
] as const
