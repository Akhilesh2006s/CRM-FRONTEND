/**
 * Full sidebar tree for RBAC — every page in permissionsCatalog.js must appear here.
 * Sidebar builds visible items from the user's granted page permissions.
 */
import { canAccessHref } from './access'
import { MODULE_LABELS } from './nav-permissions'
import type { AuthUserWithPermissions } from './permissions'
import { isSuperAdmin } from './permissions'

export type RbacNavPage = { label: string; href: string }

export type RbacNavModule = {
  module: string
  label: string
  pages: RbacNavPage[]
}

/** Module order in the sidebar (matches Roles & Permissions grouping). */
export const RBAC_MODULE_ORDER = [
  'dashboard',
  'clients',
  'leads',
  'employees',
  'leaves',
  'training',
  'warehouse',
  'returns',
  'payments',
  'expenses',
  'reports',
  'products',
  'settings',
  'executive_managers',
  'samples',
  'vendor',
] as const

/**
 * All RBAC pages grouped by module. Keep in sync with backend/constants/permissionsCatalog.js PAGE_ENTRIES.
 */
export const RBAC_NAV_MODULES: RbacNavModule[] = [
  {
    module: 'dashboard',
    label: MODULE_LABELS.dashboard,
    pages: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    module: 'clients',
    label: MODULE_LABELS.clients,
    pages: [
      { label: 'Create Sale', href: '/dashboard/dc/create' },
      { label: 'Closed Sales', href: '/dashboard/dc/closed' },
      { label: 'Saved DC', href: '/dashboard/dc/saved' },
      { label: 'Pending DC', href: '/dashboard/dc/pending' },
      { label: 'EMP DC', href: '/dashboard/dc/emp' },
      { label: 'Term-Wise DC', href: '/dashboard/dc/term-wise' },
      { label: 'My Clients', href: '/dashboard/dc/client-dc' },
      { label: 'Term-Wise My Clients', href: '/dashboard/dc/client-dc/term-wise' },
      { label: 'PO Edit Request', href: '/dashboard/clients/closed-sales' },
    ],
  },
  {
    module: 'leads',
    label: MODULE_LABELS.leads,
    pages: [
      { label: 'Add Lead', href: '/dashboard/leads/add' },
      { label: 'Renewal Leads', href: '/dashboard/leads/renewal' },
      { label: 'Followup Leads', href: '/dashboard/leads/followup' },
    ],
  },
  {
    module: 'employees',
    label: MODULE_LABELS.employees,
    pages: [
      { label: 'New Employee', href: '/dashboard/employees/new' },
      { label: 'Active Employees', href: '/dashboard/employees/active' },
      { label: 'Inactive Employees', href: '/dashboard/employees/inactive' },
      { label: 'Assign Areas', href: '/dashboard/executives/assign-areas' },
    ],
  },
  {
    module: 'leaves',
    label: MODULE_LABELS.leaves,
    pages: [
      { label: 'Pending Leaves', href: '/dashboard/leaves/pending' },
      { label: 'Leaves Report', href: '/dashboard/leaves/report' },
      { label: 'Leave Request', href: '/dashboard/leaves/request' },
      { label: 'My Leaves', href: '/dashboard/leaves/approved' },
    ],
  },
  {
    module: 'training',
    label: MODULE_LABELS.training,
    pages: [
      { label: 'Add Trainer', href: '/dashboard/training/trainers/new' },
      { label: 'Active Trainers', href: '/dashboard/training/trainers/active' },
      { label: 'Trainers Dashboard', href: '/dashboard/training/dashboard' },
      { label: 'Assign Training/Service', href: '/dashboard/training/assign' },
      { label: 'Trainings List', href: '/dashboard/training/list' },
      { label: 'Services List', href: '/dashboard/training/services' },
      { label: 'Inactive Trainers', href: '/dashboard/training/trainers/inactive' },
      { label: 'My Training & Services', href: '/dashboard/training/trainer/my' },
      { label: 'Completed Training & Services', href: '/dashboard/training/trainer/completed' },
    ],
  },
  {
    module: 'warehouse',
    label: MODULE_LABELS.warehouse,
    pages: [
      { label: 'Inventory Items', href: '/dashboard/warehouse/inventory-items' },
      { label: 'Stock', href: '/dashboard/warehouse/stock' },
      { label: 'DC @ Warehouse', href: '/dashboard/warehouse/dc-at-warehouse' },
      { label: 'Completed DC', href: '/dashboard/warehouse/completed-dc' },
      { label: 'Hold DC', href: '/dashboard/warehouse/hold-dc' },
      { label: 'DC listed', href: '/dashboard/warehouse/dc-listed' },
      { label: 'Search DC', href: '/dashboard/warehouse/search-dc' },
    ],
  },
  {
    module: 'returns',
    label: MODULE_LABELS.returns,
    pages: [
      { label: 'Employee Returns List', href: '/dashboard/returns/employees' },
      { label: 'Warehouse Returns List', href: '/dashboard/returns/warehouse' },
      { label: 'Executive Stock Returns', href: '/dashboard/returns/executive' },
      { label: 'Warehouse Executive Returns', href: '/dashboard/returns/warehouse-executive' },
      { label: 'Warehouse Manager Returns', href: '/dashboard/returns/warehouse-manager' },
    ],
  },
  {
    module: 'payments',
    label: MODULE_LABELS.payments,
    pages: [
      { label: 'Pending Payments', href: '/dashboard/payments' },
      { label: 'Add Payment', href: '/dashboard/payments/add-payment' },
      { label: 'Payments Done', href: '/dashboard/payments/done' },
      { label: 'Transaction Report', href: '/dashboard/payments/transaction-report' },
      { label: 'Approval Pending Cash', href: '/dashboard/payments/approval-pending-cash' },
      { label: 'Approval Pending Cheques', href: '/dashboard/payments/approval-pending-cheques' },
      { label: 'Approved Payments', href: '/dashboard/payments/approved-payments' },
      { label: 'HOLD Payments', href: '/dashboard/payments/hold-payments' },
    ],
  },
  {
    module: 'expenses',
    label: MODULE_LABELS.expenses,
    pages: [
      { label: 'Pending Expenses List', href: '/dashboard/expenses/pending' },
      { label: 'Finance Pending Exp List', href: '/dashboard/expenses/finance-pending' },
      { label: 'Create Expense', href: '/dashboard/expenses/create' },
      { label: 'My Expenses', href: '/dashboard/expenses/my' },
      { label: 'Executive Manager Pending', href: '/dashboard/expenses/executive-manager-pending' },
    ],
  },
  {
    module: 'reports',
    label: MODULE_LABELS.reports,
    pages: [
      { label: 'Leads Report', href: '/dashboard/reports/leads' },
      { label: 'Sales Visit', href: '/dashboard/reports/sales-visit' },
      { label: 'Employee Track', href: '/dashboard/reports/employee-track' },
      { label: 'Contact Queries', href: '/dashboard/reports/contact-queries' },
      { label: 'Change Logs', href: '/dashboard/reports/change-logs' },
      { label: 'Stock Report', href: '/dashboard/reports/stock' },
      { label: 'DC Report', href: '/dashboard/reports/dc' },
      { label: 'Returns Report', href: '/dashboard/reports/returns' },
      { label: 'All Expenses Report', href: '/dashboard/reports/expenses' },
    ],
  },
  {
    module: 'products',
    label: MODULE_LABELS.products,
    pages: [
      { label: 'All Products', href: '/dashboard/products' },
      { label: 'Add New Product', href: '/dashboard/products/new' },
      { label: 'Deliverables', href: '/dashboard/products/deliverables' },
      { label: 'Vendor', href: '/dashboard/products/vendors' },
    ],
  },
  {
    module: 'settings',
    label: MODULE_LABELS.settings,
    pages: [
      { label: 'Change Password', href: '/dashboard/settings/password' },
      { label: 'App Dashboard Data Upload', href: '/dashboard/settings/upload' },
      { label: 'SMS', href: '/dashboard/settings/sms' },
      { label: 'DB Backup', href: '/dashboard/settings/backup' },
      { label: 'Expense policy', href: '/dashboard/settings/expenses' },
      { label: 'Roles & Permissions', href: '/dashboard/settings/roles' },
    ],
  },
  {
    module: 'executive_managers',
    label: MODULE_LABELS.executive_managers,
    pages: [
      { label: 'All Managers', href: '/dashboard/executive-managers' },
      { label: 'Create Manager', href: '/dashboard/executive-managers/new' },
      { label: 'Executives', href: '/dashboard/executive-managers/executives' },
    ],
  },
  {
    module: 'samples',
    label: MODULE_LABELS.samples,
    pages: [{ label: 'Request Samples', href: '/dashboard/samples/request' }],
  },
  {
    module: 'vendor',
    label: MODULE_LABELS.vendor,
    pages: [
      { label: 'Stocks', href: '/dashboard/stocks' },
      { label: 'My DCs', href: '/dashboard/dcs' },
    ],
  },
]

export type BuiltRbacNavItem = {
  label: string
  module: string
  href?: string
  children?: RbacNavPage[]
}

function pagesForUser(
  user: AuthUserWithPermissions | null,
  pages: RbacNavPage[]
): RbacNavPage[] {
  if (!user) return []
  if (isSuperAdmin(user)) return pages
  return pages.filter((p) => canAccessHref(user, p.href))
}

/** Build sidebar sections from granted page permissions (full catalog). */
export function buildRbacSidebarNav(
  user: AuthUserWithPermissions | null
): BuiltRbacNavItem[] {
  const items: BuiltRbacNavItem[] = []

  for (const mod of RBAC_NAV_MODULES) {
    const allowed = pagesForUser(user, mod.pages)
    if (allowed.length === 0) continue

    if (mod.module === 'dashboard' && allowed.length === 1) {
      items.push({
        label: allowed[0].label,
        module: mod.module,
        href: allowed[0].href,
      })
      continue
    }

    items.push({
      label: mod.label,
      module: mod.module,
      children: allowed,
    })
  }

  return items
}

/** Collect hrefs already represented in the RBAC catalog nav. */
export function rbacCatalogHrefs(): Set<string> {
  const set = new Set<string>()
  for (const mod of RBAC_NAV_MODULES) {
    for (const p of mod.pages) set.add(p.href)
  }
  return set
}
