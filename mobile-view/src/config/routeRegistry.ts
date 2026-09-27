/**
 * Web route (navbar-landing) ↔ mobile screen registry.
 * Dealership DMS and AI dashboard have been removed from the product.
 */

export type ParityStatus = 'done' | 'partial' | 'missing' | 'excluded';

export type RouteEntry = {
  webPath: string;
  mobileScreen?: string;
  module: string;
  status: ParityStatus;
  roles?: string[];
  notes?: string;
};

export const ROUTE_REGISTRY: RouteEntry[] = [
  { webPath: '/dashboard', mobileScreen: 'MainTabs', module: 'Core', status: 'done' },
  { webPath: '/auth/login', mobileScreen: 'Login', module: 'Auth', status: 'done' },

  { webPath: '/dashboard/leads', mobileScreen: 'LeadsList', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/add', mobileScreen: 'LeadAdd', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/add/new-school', mobileScreen: 'LeadAddNewSchool', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/add/renewal', mobileScreen: 'LeadsRenewalList', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/renewal', mobileScreen: 'LeadsRenewalList', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/followup', mobileScreen: 'LeadFollowup', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/edit/[id]', mobileScreen: 'LeadEdit', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/leads/close/[id]', mobileScreen: 'LeadClose', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/visits', mobileScreen: 'SchoolVisits', module: 'Leads', status: 'done' },

  { webPath: '/dashboard/dc/create', mobileScreen: 'DCCreateSale', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/closed', mobileScreen: 'DCClosed', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/saved', mobileScreen: 'DCSaved', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/pending', mobileScreen: 'DCPending', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/emp', mobileScreen: 'DCEmp', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/term-wise', mobileScreen: 'DCTermWise', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/client-dc', mobileScreen: 'DCClient', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/edit/[id]', mobileScreen: 'DCEdit', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/manager', mobileScreen: 'DCManager', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc/admin/my', mobileScreen: 'DCAdminMy', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/clients/closed-sales', mobileScreen: 'ClientsClosedSales', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/dc', mobileScreen: 'DCHub', module: 'Clients', status: 'done' },
  { webPath: '/dashboard/products/deliverables/add', mobileScreen: 'DeliverableAdd', module: 'Products', status: 'done' },
  { webPath: '/dashboard/employees/zones-clusters', mobileScreen: 'EmployeesZonesClusters', module: 'Employees', status: 'done' },

  { webPath: '/dashboard/employees/new', mobileScreen: 'EmployeeNew', module: 'Employees', status: 'done' },
  { webPath: '/dashboard/employees/active', mobileScreen: 'EmployeesActive', module: 'Employees', status: 'done' },
  { webPath: '/dashboard/employees/inactive', mobileScreen: 'EmployeesInactive', module: 'Employees', status: 'done' },
  { webPath: '/dashboard/employees/leaves', mobileScreen: 'EmployeesLeaves', module: 'Employees', status: 'done' },
  { webPath: '/dashboard/employees/zones', mobileScreen: 'EmployeesZones', module: 'Employees', status: 'done' },
  { webPath: '/dashboard/employees/clusters', mobileScreen: 'EmployeesClusters', module: 'Employees', status: 'done' },
  { webPath: '/dashboard/executives/assign-areas', mobileScreen: 'ExecutivesAssignAreas', module: 'Employees', status: 'done' },

  { webPath: '/dashboard/executive-managers', mobileScreen: 'ExecutiveManagers', module: 'ExecutiveManagers', status: 'done' },
  { webPath: '/dashboard/executive-managers/[managerId]/dashboard', mobileScreen: 'ExecutiveManagerDashboard', module: 'ExecutiveManagers', status: 'done' },
  { webPath: '/dashboard/hierarchy', mobileScreen: 'HierarchyAssign', module: 'Hierarchy', status: 'done', roles: ['Super Admin'] },
  { webPath: '/dashboard/product-managers', mobileScreen: 'ProductManagerAssign', module: 'ProductManager', status: 'partial', roles: ['Super Admin'] },
  { webPath: '/dashboard/product-manager', mobileScreen: 'ProductManager', module: 'ProductManager', status: 'done', roles: ['Manager'] },
  { webPath: '/dashboard/hierarchy/regional-manager/[id]', mobileScreen: 'HierarchyDashboard', module: 'Hierarchy', status: 'done' },
  { webPath: '/dashboard/hierarchy/regional-head/[id]', mobileScreen: 'HierarchyDashboard', module: 'Hierarchy', status: 'done' },
  { webPath: '/dashboard/hierarchy/national-head/[id]', mobileScreen: 'HierarchyDashboard', module: 'Hierarchy', status: 'done' },
  { webPath: '/dashboard/executive-managers/[managerId]/leaves', mobileScreen: 'ExecutiveManagerLeaves', module: 'ExecutiveManagers', status: 'done' },
  { webPath: '/dashboard/executive-managers/executives', mobileScreen: 'ExecutiveManagerExecutives', module: 'ExecutiveManagers', status: 'done' },

  { webPath: '/dashboard/leaves/pending', mobileScreen: 'LeavesPending', module: 'Leaves', status: 'done' },
  { webPath: '/dashboard/leaves/report', mobileScreen: 'LeavesReport', module: 'Leaves', status: 'done' },
  { webPath: '/dashboard/leaves/request', mobileScreen: 'LeaveRequest', module: 'Leaves', status: 'done' },
  { webPath: '/dashboard/leaves/approved', mobileScreen: 'LeavesApproved', module: 'Leaves', status: 'done' },

  { webPath: '/dashboard/training/assign', mobileScreen: 'TrainingAssign', module: 'Training', status: 'done' },
  { webPath: '/dashboard/training/list', mobileScreen: 'TrainingList', module: 'Training', status: 'done' },
  { webPath: '/dashboard/training/dashboard', mobileScreen: 'TrainingDashboard', module: 'Training', status: 'done' },
  { webPath: '/dashboard/training/services', mobileScreen: 'ServicesList', module: 'Training', status: 'done' },
  { webPath: '/dashboard/training/trainer/my', mobileScreen: 'TrainingTrainerMy', module: 'Training', status: 'done' },
  { webPath: '/dashboard/training/trainer/completed', mobileScreen: 'TrainingTrainerCompleted', module: 'Training', status: 'done' },

  { webPath: '/dashboard/warehouse/inventory-items', mobileScreen: 'WarehouseInventoryItems', module: 'Warehouse', status: 'done' },
  { webPath: '/dashboard/warehouse/stock', mobileScreen: 'WarehouseStock', module: 'Warehouse', status: 'done' },
  { webPath: '/dashboard/warehouse/dc-at-warehouse', mobileScreen: 'WarehouseDCAtWarehouse', module: 'Warehouse', status: 'done' },
  { webPath: '/dashboard/warehouse/completed-dc', mobileScreen: 'WarehouseCompletedDC', module: 'Warehouse', status: 'done' },
  { webPath: '/dashboard/warehouse/hold-dc', mobileScreen: 'WarehouseHoldDC', module: 'Warehouse', status: 'done' },
  { webPath: '/dashboard/warehouse/dc-listed', mobileScreen: 'WarehouseDCListed', module: 'Warehouse', status: 'done' },
  { webPath: '/dashboard/warehouse/search-dc', mobileScreen: 'WarehouseSearchDC', module: 'Warehouse', status: 'done' },

  { webPath: '/dashboard/returns/employees', mobileScreen: 'ReturnsEmployee', module: 'Returns', status: 'done' },
  { webPath: '/dashboard/returns/warehouse', mobileScreen: 'ReturnsWarehouse', module: 'Returns', status: 'done' },
  { webPath: '/dashboard/returns/executive', mobileScreen: 'ReturnsExecutive', module: 'Returns', status: 'done' },
  { webPath: '/dashboard/returns/warehouse-executive', mobileScreen: 'ReturnsWarehouseExecutive', module: 'Returns', status: 'done' },
  { webPath: '/dashboard/returns/warehouse-manager', mobileScreen: 'ReturnsWarehouseManager', module: 'Returns', status: 'done' },

  { webPath: '/dashboard/payments', mobileScreen: 'PaymentList', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/add-payment', mobileScreen: 'PaymentAdd', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/done', mobileScreen: 'PaymentDone', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/transaction-report', mobileScreen: 'PaymentTransactionReport', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/approval-pending-cash', mobileScreen: 'PaymentApprovalPendingCash', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/approval-pending-cheques', mobileScreen: 'PaymentApprovalPendingCheques', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/approved-payments', mobileScreen: 'PaymentApproved', module: 'Payments', status: 'done' },
  { webPath: '/dashboard/payments/hold-payments', mobileScreen: 'PaymentHold', module: 'Payments', status: 'done' },

  { webPath: '/dashboard/expenses/pending', mobileScreen: 'ExpensePending', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/finance-pending', mobileScreen: 'ExpenseFinancePending', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/create', mobileScreen: 'ExpenseCreate', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/my', mobileScreen: 'ExpenseMy', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/edit/[id]', mobileScreen: 'ExpenseEdit', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/[id]', mobileScreen: 'ExpenseDetail', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/executive-manager-pending', mobileScreen: 'ExpenseExecutiveManagerPending', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/resubmit/[id]', mobileScreen: 'ExpenseResubmit', module: 'Expenses', status: 'done' },
  { webPath: '/dashboard/expenses/manager-update/[employeeId]', mobileScreen: 'ExpenseManagerUpdate', module: 'Expenses', status: 'done' },

  { webPath: '/dashboard/reports/leads', mobileScreen: 'ReportsLeads', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/sales-visit', mobileScreen: 'ReportsSalesVisit', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/employee-track', mobileScreen: 'ReportsEmployeeTrack', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/contact-queries', mobileScreen: 'ReportsContactQueries', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/change-logs', mobileScreen: 'ReportsChangeLogs', module: 'Reports', status: 'done', notes: 'Web + mobile: coming soon UI' },
  { webPath: '/dashboard/reports/stock', mobileScreen: 'ReportsStock', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/dc', mobileScreen: 'ReportsDC', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/returns', mobileScreen: 'ReportsReturns', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/expenses', mobileScreen: 'ReportsExpenses', module: 'Reports', status: 'done' },
  { webPath: '/dashboard/reports/training-service', mobileScreen: 'ReportsTrainingService', module: 'Reports', status: 'done' },

  { webPath: '/dashboard/products', mobileScreen: 'ProductsList', module: 'Products', status: 'done' },
  { webPath: '/dashboard/products/vendors', mobileScreen: 'VendorsList', module: 'Vendor', status: 'done' },
  { webPath: '/dashboard/products/deliverables', mobileScreen: 'DeliverablesList', module: 'Products', status: 'done' },

  { webPath: '/dashboard/settings/password', mobileScreen: 'SettingsPassword', module: 'Settings', status: 'done' },
  { webPath: '/dashboard/settings/upload', mobileScreen: 'SettingsUpload', module: 'Settings', status: 'done' },
  { webPath: '/dashboard/leads/renewal', mobileScreen: 'LeadsRenewalList', module: 'Leads', status: 'done' },
  { webPath: '/dashboard/settings/sms', mobileScreen: 'SettingsSMS', module: 'Settings', status: 'done' },
  { webPath: '/dashboard/settings/backup', mobileScreen: 'SettingsBackup', module: 'Settings', status: 'done' },
  { webPath: '/dashboard/settings/expenses', mobileScreen: 'SettingsExpenses', module: 'Settings', status: 'done' },
  { webPath: '/dashboard/settings/roles', module: 'Settings', status: 'partial', notes: 'Web only — Roles & Permissions' },

  { webPath: '/dashboard/stocks', mobileScreen: 'PartnerStocks', module: 'Vendor', status: 'done' },
  { webPath: '/dashboard/dcs', mobileScreen: 'PartnerDCs', module: 'Vendor', status: 'done' },
  { webPath: '/dashboard/franchises/[email]', mobileScreen: 'FranchiseDetail', module: 'Franchises', status: 'done' },
];

export function getParitySummary() {
  const active = ROUTE_REGISTRY.filter((r) => r.status !== 'excluded');
  return {
    total: active.length,
    done: active.filter((r) => r.status === 'done').length,
    partial: active.filter((r) => r.status === 'partial').length,
    missing: active.filter((r) => r.status === 'missing').length,
  };
}
