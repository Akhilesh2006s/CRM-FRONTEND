/**
 * Maps dashboard routes to RBAC page permission keys.
 * Must stay in sync with backend/constants/permissionsCatalog.js
 */

export const HREF_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard.home.page.view',
  '/dashboard/dc/create': 'clients.create_sale.page.view',
  '/dashboard/dc/closed': 'clients.closed_sales.page.view',
  '/dashboard/dc/saved': 'clients.saved_dc.page.view',
  '/dashboard/dc/pending': 'clients.pending_dc.page.view',
  '/dashboard/dc/emp': 'clients.emp_dc.page.view',
  '/dashboard/dc/term-wise': 'clients.term_wise_dc.page.view',
  '/dashboard/dc/client-dc': 'clients.my_clients.page.view',
  '/dashboard/dc/client-dc/term-wise': 'clients.my_clients_term_wise.page.view',
  '/dashboard/clients/closed-sales': 'clients.po_edit_request.page.view',
  '/dashboard/leads/add': 'leads.add.page.view',
  '/dashboard/leads/renewal': 'leads.renewal.page.view',
  '/dashboard/leads/followup': 'leads.followup.page.view',
  '/dashboard/employees/new': 'employees.new.page.view',
  '/dashboard/employees/active': 'employees.active.page.view',
  '/dashboard/employees/inactive': 'employees.inactive.page.view',
  '/dashboard/executives/assign-areas': 'employees.assign_areas.page.view',
  '/dashboard/leaves/pending': 'leaves.pending.page.view',
  '/dashboard/leaves/report': 'leaves.report.page.view',
  '/dashboard/leaves/request': 'leaves.request.page.view',
  '/dashboard/leaves/approved': 'leaves.approved.page.view',
  '/dashboard/training/trainers/new': 'training.trainers_new.page.view',
  '/dashboard/training/trainers/active': 'training.trainers_active.page.view',
  '/dashboard/training/dashboard': 'training.dashboard.page.view',
  '/dashboard/training/assign': 'training.assign.page.view',
  '/dashboard/training/list': 'training.list.page.view',
  '/dashboard/training/services': 'training.services.page.view',
  '/dashboard/training/trainers/inactive': 'training.trainers_inactive.page.view',
  '/dashboard/training/trainer/my': 'training.trainer_my.page.view',
  '/dashboard/training/trainer/completed': 'training.trainer_completed.page.view',
  '/dashboard/warehouse/inventory-items': 'warehouse.inventory_items.page.view',
  '/dashboard/warehouse/stock': 'warehouse.stock.page.view',
  '/dashboard/warehouse/dc-at-warehouse': 'warehouse.dc_at_warehouse.page.view',
  '/dashboard/warehouse/completed-dc': 'warehouse.completed_dc.page.view',
  '/dashboard/warehouse/hold-dc': 'warehouse.hold_dc.page.view',
  '/dashboard/warehouse/dc-listed': 'warehouse.dc_listed.page.view',
  '/dashboard/warehouse/search-dc': 'warehouse.search_dc.page.view',
  '/dashboard/returns/employees': 'returns.employees_list.page.view',
  '/dashboard/returns/warehouse': 'returns.warehouse_list.page.view',
  '/dashboard/returns/executive': 'returns.executive.page.view',
  '/dashboard/returns/warehouse-executive': 'returns.warehouse_executive.page.view',
  '/dashboard/returns/warehouse-manager': 'returns.warehouse_manager.page.view',
  '/dashboard/payments': 'payments.pending.page.view',
  '/dashboard/payments/add-payment': 'payments.add.page.view',
  '/dashboard/payments/done': 'payments.done.page.view',
  '/dashboard/payments/transaction-report': 'payments.transaction_report.page.view',
  '/dashboard/payments/approval-pending-cash': 'payments.approval_cash.page.view',
  '/dashboard/payments/approval-pending-cheques': 'payments.approval_cheques.page.view',
  '/dashboard/payments/approved-payments': 'payments.approved.page.view',
  '/dashboard/payments/hold-payments': 'payments.hold.page.view',
  '/dashboard/expenses/pending': 'expenses.pending.page.view',
  '/dashboard/expenses/finance-pending': 'expenses.finance_pending.page.view',
  '/dashboard/expenses/create': 'expenses.create.page.view',
  '/dashboard/expenses/my': 'expenses.my.page.view',
  '/dashboard/expenses/executive-manager-pending': 'expenses.executive_manager_pending.page.view',
  '/dashboard/reports/leads': 'reports.leads.page.view',
  '/dashboard/reports/sales-visit': 'reports.sales_visit.page.view',
  '/dashboard/reports/employee-track': 'reports.employee_track.page.view',
  '/dashboard/reports/contact-queries': 'reports.contact_queries.page.view',
  '/dashboard/reports/change-logs': 'reports.change_logs.page.view',
  '/dashboard/reports/stock': 'reports.stock.page.view',
  '/dashboard/reports/dc': 'reports.dc.page.view',
  '/dashboard/reports/returns': 'reports.returns.page.view',
  '/dashboard/reports/expenses': 'reports.expenses.page.view',
  '/dashboard/products': 'products.list.page.view',
  '/dashboard/products/new': 'products.new.page.view',
  '/dashboard/products/deliverables': 'products.deliverables.page.view',
  '/dashboard/products/vendors': 'products.vendors.page.view',
  '/dashboard/settings/password': 'settings.password.page.view',
  '/dashboard/settings/upload': 'settings.upload.page.view',
  '/dashboard/settings/sms': 'settings.sms.page.view',
  '/dashboard/settings/backup': 'settings.backup.page.view',
  '/dashboard/settings/expenses': 'settings.expenses.page.view',
  '/dashboard/settings/roles': 'settings.roles.page.view',
  '/dashboard/executive-managers': 'executive_managers.list.page.view',
  '/dashboard/executive-managers/new': 'executive_managers.create.page.view',
  '/dashboard/executive-managers/executives': 'executive_managers.executives.page.view',
  '/dashboard/samples/request': 'samples.request.page.view',
  '/dashboard/stocks': 'vendor.stocks.page.view',
  '/dashboard/dcs': 'vendor.dcs.page.view',
}

/** Longest-prefix match for dynamic routes */
export function permissionForPath(pathname: string): string | null {
  if (!pathname) return null
  if (HREF_PERMISSION_MAP[pathname]) return HREF_PERMISSION_MAP[pathname]
  const sorted = Object.keys(HREF_PERMISSION_MAP).sort((a, b) => b.length - a.length)
  for (const href of sorted) {
    if (pathname === href || pathname.startsWith(href + '/')) {
      return HREF_PERMISSION_MAP[href]
    }
  }
  return null
}

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  leads: 'Leads',
  employees: 'Users / Employees',
  leaves: 'Leave Management',
  training: 'Trainings & Services',
  warehouse: 'Warehouse',
  returns: 'Stock Returns',
  payments: 'Payments',
  expenses: 'Expenses',
  reports: 'Reports',
  products: 'Products',
  settings: 'Settings',
  executive_managers: 'Executive Managers',
  samples: 'Samples',
  vendor: 'Vendor',
}
