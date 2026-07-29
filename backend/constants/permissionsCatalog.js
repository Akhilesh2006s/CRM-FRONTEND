/**
 * Central permission catalog for RBAC.
 * Keys: {module}.{resource}.{action}
 */

function pageKey(module, resource) {
  return `${module}.${resource}.page.view`;
}

function buttonKey(module, resource, action) {
  return `${module}.${resource}.${action}`;
}

function moduleKey(module) {
  return `${module}.module.view`;
}

/** @type {Array<{ key: string, module: string, resource: string, action: string, type: string, label: string, group?: string }>} */
const PAGE_ENTRIES = [
  // Dashboard
  { href: '/dashboard', module: 'dashboard', resource: 'home', label: 'Dashboard' },
  // Clients / DC
  { href: '/dashboard/dc/create', module: 'clients', resource: 'create_sale', label: 'Create Sale' },
  { href: '/dashboard/dc/closed', module: 'clients', resource: 'closed_sales', label: 'Closed Sales' },
  { href: '/dashboard/dc/saved', module: 'clients', resource: 'saved_dc', label: 'Saved DC' },
  { href: '/dashboard/dc/pending', module: 'clients', resource: 'pending_dc', label: 'Pending DC' },
  { href: '/dashboard/dc/emp', module: 'clients', resource: 'emp_dc', label: 'EMP DC' },
  { href: '/dashboard/dc/term-wise', module: 'clients', resource: 'term_wise_dc', label: 'Term-Wise DC' },
  { href: '/dashboard/dc/client-dc', module: 'clients', resource: 'my_clients', label: 'My Clients' },
  { href: '/dashboard/dc/client-dc/term-wise', module: 'clients', resource: 'my_clients_term_wise', label: 'Term-Wise My Clients' },
  { href: '/dashboard/clients/closed-sales', module: 'clients', resource: 'po_edit_request', label: 'PO Edit Request' },
  // Leads (Executive)
  { href: '/dashboard/leads/add', module: 'leads', resource: 'add', label: 'Add Lead' },
  { href: '/dashboard/leads/renewal', module: 'leads', resource: 'renewal', label: 'Renewal Leads' },
  { href: '/dashboard/leads/followup', module: 'leads', resource: 'followup', label: 'Followup Leads' },
  // Employees
  { href: '/dashboard/employees/new', module: 'employees', resource: 'new', label: 'New Employee' },
  { href: '/dashboard/employees/active', module: 'employees', resource: 'active', label: 'Active Employees' },
  { href: '/dashboard/employees/inactive', module: 'employees', resource: 'inactive', label: 'Inactive Employees' },
  { href: '/dashboard/executives/assign-areas', module: 'employees', resource: 'assign_areas', label: 'Assign Areas' },
  // Leaves
  { href: '/dashboard/leaves/pending', module: 'leaves', resource: 'pending', label: 'Pending Leaves' },
  { href: '/dashboard/leaves/report', module: 'leaves', resource: 'report', label: 'Leaves Report' },
  { href: '/dashboard/leaves/request', module: 'leaves', resource: 'request', label: 'Leave Request' },
  { href: '/dashboard/leaves/approved', module: 'leaves', resource: 'approved', label: 'My Leaves' },
  // Training
  { href: '/dashboard/training/trainers/new', module: 'training', resource: 'trainers_new', label: 'Add Trainer' },
  { href: '/dashboard/training/trainers/active', module: 'training', resource: 'trainers_active', label: 'Active Trainers' },
  { href: '/dashboard/training/dashboard', module: 'training', resource: 'dashboard', label: 'Trainers Dashboard' },
  { href: '/dashboard/training/assign', module: 'training', resource: 'assign', label: 'Assign Training/Service' },
  { href: '/dashboard/training/list', module: 'training', resource: 'list', label: 'Trainings List' },
  { href: '/dashboard/training/services', module: 'training', resource: 'services', label: 'Services List' },
  { href: '/dashboard/training/trainers/inactive', module: 'training', resource: 'trainers_inactive', label: 'Inactive Trainers' },
  { href: '/dashboard/training/trainer/my', module: 'training', resource: 'trainer_my', label: 'My Training & Services' },
  { href: '/dashboard/training/trainer/completed', module: 'training', resource: 'trainer_completed', label: 'Completed Training & Services' },
  // Warehouse
  { href: '/dashboard/warehouse/inventory-items', module: 'warehouse', resource: 'inventory_items', label: 'Inventory Items' },
  { href: '/dashboard/warehouse/stock', module: 'warehouse', resource: 'stock', label: 'Stock' },
  { href: '/dashboard/warehouse/dc-at-warehouse', module: 'warehouse', resource: 'dc_at_warehouse', label: 'DC @ Warehouse' },
  { href: '/dashboard/warehouse/completed-dc', module: 'warehouse', resource: 'completed_dc', label: 'Completed DC' },
  { href: '/dashboard/warehouse/hold-dc', module: 'warehouse', resource: 'hold_dc', label: 'Hold DC' },
  { href: '/dashboard/warehouse/dc-listed', module: 'warehouse', resource: 'dc_listed', label: 'DC listed' },
  { href: '/dashboard/warehouse/search-dc', module: 'warehouse', resource: 'search_dc', label: 'Search DC' },
  // Returns
  { href: '/dashboard/returns/employees', module: 'returns', resource: 'employees_list', label: 'Employee Returns List' },
  { href: '/dashboard/returns/warehouse', module: 'returns', resource: 'warehouse_list', label: 'Warehouse Returns List' },
  { href: '/dashboard/returns/executive', module: 'returns', resource: 'executive', label: 'Executive Stock Returns' },
  { href: '/dashboard/returns/warehouse-executive', module: 'returns', resource: 'warehouse_executive', label: 'Warehouse Executive Returns' },
  { href: '/dashboard/returns/warehouse-manager', module: 'returns', resource: 'warehouse_manager', label: 'Warehouse Manager Returns' },
  // Payments
  { href: '/dashboard/payments', module: 'payments', resource: 'pending', label: 'Pending Payments' },
  { href: '/dashboard/payments/add-payment', module: 'payments', resource: 'add', label: 'Add Payment' },
  { href: '/dashboard/payments/done', module: 'payments', resource: 'done', label: 'Payments Done' },
  { href: '/dashboard/payments/transaction-report', module: 'payments', resource: 'transaction_report', label: 'Transaction Report' },
  { href: '/dashboard/payments/approval-pending-cash', module: 'payments', resource: 'approval_cash', label: 'Approval Pending Cash' },
  { href: '/dashboard/payments/approval-pending-cheques', module: 'payments', resource: 'approval_cheques', label: 'Approval Pending Cheques' },
  { href: '/dashboard/payments/approved-payments', module: 'payments', resource: 'approved', label: 'Approved Payments' },
  { href: '/dashboard/payments/hold-payments', module: 'payments', resource: 'hold', label: 'HOLD Payments' },
  // Expenses
  { href: '/dashboard/expenses/pending', module: 'expenses', resource: 'pending', label: 'Pending Expenses List' },
  { href: '/dashboard/expenses/finance-pending', module: 'expenses', resource: 'finance_pending', label: 'Finance Pending Exp List' },
  { href: '/dashboard/expenses/create', module: 'expenses', resource: 'create', label: 'Create Expense' },
  { href: '/dashboard/expenses/my', module: 'expenses', resource: 'my', label: 'My Expenses' },
  { href: '/dashboard/expenses/executive-manager-pending', module: 'expenses', resource: 'executive_manager_pending', label: 'Executive Manager Pending' },
  // Reports
  { href: '/dashboard/reports/leads', module: 'reports', resource: 'leads', label: 'Leads Report' },
  { href: '/dashboard/reports/sales-visit', module: 'reports', resource: 'sales_visit', label: 'Sales Visit' },
  { href: '/dashboard/reports/employee-track', module: 'reports', resource: 'employee_track', label: 'Employee Track' },
  { href: '/dashboard/reports/contact-queries', module: 'reports', resource: 'contact_queries', label: 'Contact Queries' },
  { href: '/dashboard/reports/change-logs', module: 'reports', resource: 'change_logs', label: 'Change Logs' },
  { href: '/dashboard/reports/stock', module: 'reports', resource: 'stock', label: 'Stock Report' },
  { href: '/dashboard/reports/dc', module: 'reports', resource: 'dc', label: 'DC Report' },
  { href: '/dashboard/reports/returns', module: 'reports', resource: 'returns', label: 'Returns Report' },
  { href: '/dashboard/reports/expenses', module: 'reports', resource: 'expenses', label: 'All Expenses Report' },
  // Products
  { href: '/dashboard/products', module: 'products', resource: 'list', label: 'All Products' },
  { href: '/dashboard/products/new', module: 'products', resource: 'new', label: 'Add New Product' },
  { href: '/dashboard/products/deliverables', module: 'products', resource: 'deliverables', label: 'Deliverables' },
  { href: '/dashboard/products/vendors', module: 'products', resource: 'vendors', label: 'Vendor' },
  // Settings
  { href: '/dashboard/settings/password', module: 'settings', resource: 'password', label: 'Change Password' },
  { href: '/dashboard/settings/upload', module: 'settings', resource: 'upload', label: 'App Dashboard Data Upload' },
  { href: '/dashboard/settings/sms', module: 'settings', resource: 'sms', label: 'SMS' },
  { href: '/dashboard/settings/backup', module: 'settings', resource: 'backup', label: 'DB Backup' },
  { href: '/dashboard/settings/expenses', module: 'settings', resource: 'expenses', label: 'Expense policy' },
  { href: '/dashboard/settings/roles', module: 'settings', resource: 'roles', label: 'Roles & Permissions' },
  // Executive manager
  { href: '/dashboard/executive-managers', module: 'executive_managers', resource: 'list', label: 'All Managers' },
  { href: '/dashboard/executive-managers/new', module: 'executive_managers', resource: 'create', label: 'Create Manager' },
  { href: '/dashboard/executive-managers/executives', module: 'executive_managers', resource: 'executives', label: 'Executives' },
  // Samples / vendor
  { href: '/dashboard/samples/request', module: 'samples', resource: 'request', label: 'Employee Sample' },
  { href: '/dashboard/stocks', module: 'vendor', resource: 'stocks', label: 'Stocks' },
  { href: '/dashboard/dcs', module: 'vendor', resource: 'dcs', label: 'My DCs' },
];

const BUTTON_ENTRIES = [
  { key: buttonKey('warehouse', 'completed_dc', 'view_pdf'), module: 'warehouse', resource: 'completed_dc', action: 'view_pdf', label: 'View PDF (Completed DC)' },
  { key: buttonKey('warehouse', 'completed_dc', 'replace_pdf'), module: 'warehouse', resource: 'completed_dc', action: 'replace_pdf', label: 'Replace PDF (Completed DC)' },
  { key: buttonKey('clients', 'closed_sales', 'request_dc'), module: 'clients', resource: 'closed_sales', action: 'request_dc', label: 'Request DC (Closed Sales)' },
  { key: buttonKey('clients', 'closed_sales', 'approve_dc'), module: 'clients', resource: 'closed_sales', action: 'approve_dc', label: 'Approve DC (Closed Sales)' },
  { key: buttonKey('employees', 'active', 'add'), module: 'employees', resource: 'active', action: 'add', label: 'Add Employee' },
  { key: buttonKey('employees', 'active', 'edit'), module: 'employees', resource: 'active', action: 'edit', label: 'Edit Employee' },
  { key: buttonKey('employees', 'active', 'delete'), module: 'employees', resource: 'active', action: 'delete', label: 'Delete Employee' },
  { key: buttonKey('returns', 'warehouse', 'verify'), module: 'returns', resource: 'warehouse', action: 'verify', label: 'Verify Return (Warehouse Executive)' },
  { key: buttonKey('returns', 'warehouse', 'approve'), module: 'returns', resource: 'warehouse', action: 'approve', label: 'Approve Return (Warehouse Manager)' },
];

const pagePermissions = PAGE_ENTRIES.map((e) => ({
  key: pageKey(e.module, e.resource),
  module: e.module,
  resource: e.resource,
  action: 'view',
  type: 'page',
  label: e.label,
  group: e.module,
  href: e.href,
}));

const buttonPermissions = BUTTON_ENTRIES.map((e) => ({
  ...e,
  type: 'button',
  group: e.module,
}));

const modules = [...new Set(PAGE_ENTRIES.map((e) => e.module))];
const modulePermissions = modules.map((m) => ({
  key: moduleKey(m),
  module: m,
  resource: '_module',
  action: 'view',
  type: 'module',
  label: `${m} module`,
  group: m,
}));

const ALL_PERMISSIONS = [...modulePermissions, ...pagePermissions, ...buttonPermissions];

const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.map((p) => p.key);

const HREF_TO_PERMISSION = Object.fromEntries(
  PAGE_ENTRIES.map((e) => [e.href, pageKey(e.module, e.resource)])
);

/** System role templates: slug -> permission keys */
const ROLE_TEMPLATE_KEYS = {
  'super-admin': ALL_PERMISSION_KEYS,
  admin: ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('leads.') && !k.includes('my_clients')),
  'finance-manager': [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('expenses'),
    pageKey('expenses', 'pending'),
    pageKey('expenses', 'finance_pending'),
    pageKey('expenses', 'create'),
    pageKey('expenses', 'my'),
    moduleKey('payments'),
    pageKey('payments', 'pending'),
    pageKey('payments', 'done'),
    pageKey('payments', 'transaction_report'),
    pageKey('payments', 'approval_cash'),
    pageKey('payments', 'approval_cheques'),
    pageKey('payments', 'approved'),
    moduleKey('reports'),
    pageKey('reports', 'expenses'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  executive: [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('leads'),
    pageKey('leads', 'add'),
    pageKey('leads', 'renewal'),
    pageKey('leads', 'followup'),
    moduleKey('clients'),
    pageKey('clients', 'my_clients'),
    pageKey('clients', 'my_clients_term_wise'),
    // Needed for My Clients → Request DC (moves sale to Closed Sales as dc_requested)
    buttonKey('clients', 'closed_sales', 'request_dc'),
    moduleKey('payments'),
    pageKey('payments', 'pending'),
    pageKey('payments', 'add'),
    pageKey('payments', 'done'),
    moduleKey('expenses'),
    pageKey('expenses', 'create'),
    pageKey('expenses', 'my'),
    moduleKey('samples'),
    pageKey('samples', 'request'),
    moduleKey('returns'),
    pageKey('returns', 'executive'),
    moduleKey('leaves'),
    pageKey('leaves', 'request'),
    pageKey('leaves', 'approved'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  manager: [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('clients'),
    pageKey('clients', 'closed_sales'),
    pageKey('clients', 'saved_dc'),
    pageKey('clients', 'pending_dc'),
    pageKey('clients', 'emp_dc'),
    moduleKey('warehouse'),
    pageKey('warehouse', 'dc_at_warehouse'),
    pageKey('warehouse', 'completed_dc'),
    buttonKey('warehouse', 'completed_dc', 'view_pdf'),
    buttonKey('warehouse', 'completed_dc', 'replace_pdf'),
    pageKey('warehouse', 'dc_listed'),
    moduleKey('expenses'),
    pageKey('expenses', 'pending'),
    moduleKey('reports'),
    pageKey('reports', 'leads'),
    pageKey('reports', 'sales_visit'),
    pageKey('reports', 'employee_track'),
    pageKey('reports', 'expenses'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  coordinator: [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('clients'),
    pageKey('clients', 'create_sale'),
    pageKey('clients', 'closed_sales'),
    pageKey('clients', 'saved_dc'),
    pageKey('clients', 'pending_dc'),
    pageKey('clients', 'emp_dc'),
    buttonKey('clients', 'closed_sales', 'request_dc'),
    buttonKey('clients', 'closed_sales', 'approve_dc'),
    moduleKey('employees'),
    pageKey('employees', 'active'),
    buttonKey('employees', 'active', 'edit'),
    moduleKey('training'),
    pageKey('training', 'trainers_active'),
    pageKey('training', 'dashboard'),
    pageKey('training', 'assign'),
    pageKey('training', 'list'),
    pageKey('training', 'services'),
    pageKey('training', 'trainers_inactive'),
    moduleKey('warehouse'),
    pageKey('warehouse', 'dc_at_warehouse'),
    pageKey('warehouse', 'completed_dc'),
    buttonKey('warehouse', 'completed_dc', 'view_pdf'),
    buttonKey('warehouse', 'completed_dc', 'replace_pdf'),
    pageKey('warehouse', 'dc_listed'),
    pageKey('warehouse', 'hold_dc'),
    moduleKey('payments'),
    pageKey('payments', 'pending'),
    pageKey('payments', 'done'),
    pageKey('payments', 'transaction_report'),
    pageKey('payments', 'approval_cash'),
    pageKey('payments', 'approval_cheques'),
    pageKey('payments', 'approved'),
    moduleKey('reports'),
    pageKey('reports', 'leads'),
    pageKey('reports', 'dc'),
    pageKey('reports', 'returns'),
    pageKey('reports', 'expenses'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  'senior-coordinator': [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('clients'),
    pageKey('clients', 'create_sale'),
    pageKey('clients', 'closed_sales'),
    pageKey('clients', 'saved_dc'),
    pageKey('clients', 'pending_dc'),
    pageKey('clients', 'emp_dc'),
    pageKey('clients', 'term_wise_dc'),
    moduleKey('warehouse'),
    pageKey('warehouse', 'inventory_items'),
    pageKey('warehouse', 'stock'),
    pageKey('warehouse', 'dc_at_warehouse'),
    pageKey('warehouse', 'completed_dc'),
    buttonKey('warehouse', 'completed_dc', 'view_pdf'),
    pageKey('warehouse', 'hold_dc'),
    pageKey('warehouse', 'dc_listed'),
    pageKey('warehouse', 'search_dc'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  'warehouse-executive': [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('returns'),
    pageKey('returns', 'warehouse_executive'),
    buttonKey('returns', 'warehouse', 'verify'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  'warehouse-manager': [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('returns'),
    pageKey('returns', 'warehouse_manager'),
    buttonKey('returns', 'warehouse', 'verify'),
    buttonKey('returns', 'warehouse', 'approve'),
    moduleKey('warehouse'),
    pageKey('warehouse', 'completed_dc'),
    buttonKey('warehouse', 'completed_dc', 'view_pdf'),
    buttonKey('warehouse', 'completed_dc', 'replace_pdf'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  trainer: [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('training'),
    pageKey('training', 'trainer_my'),
    pageKey('training', 'trainer_completed'),
    moduleKey('expenses'),
    pageKey('expenses', 'create'),
    pageKey('expenses', 'my'),
    moduleKey('leaves'),
    pageKey('leaves', 'request'),
    pageKey('leaves', 'approved'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
  vendor: [
    moduleKey('dashboard'),
    pageKey('dashboard', 'home'),
    moduleKey('vendor'),
    pageKey('vendor', 'stocks'),
    pageKey('vendor', 'dcs'),
    moduleKey('settings'),
    pageKey('settings', 'password'),
  ],
};

const LEGACY_ROLE_TO_SLUG = {
  'Super Admin': 'super-admin',
  Admin: 'admin',
  'Finance Manager': 'finance-manager',
  Executive: 'executive',
  Manager: 'manager',
  Coordinator: 'coordinator',
  'Senior Coordinator': 'senior-coordinator',
  'Warehouse Executive': 'warehouse-executive',
  'Warehouse Manager': 'warehouse-manager',
  Trainer: 'trainer',
  Vendor: 'vendor',
  Partner: 'vendor',
  'Executive Manager': 'executive-manager',
  'Sales BDE': 'executive',
};

module.exports = {
  pageKey,
  buttonKey,
  moduleKey,
  ALL_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  HREF_TO_PERMISSION,
  ROLE_TEMPLATE_KEYS,
  LEGACY_ROLE_TO_SLUG,
};
