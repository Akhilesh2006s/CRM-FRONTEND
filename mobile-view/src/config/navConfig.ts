/**
 * Mobile nav items — aligned with navbar-landing/components/dashboard/Sidebar.tsx
 * (dealership DMS and AI dashboard removed)
 */

import { getRoleFlags, type CrmUser } from '../utils/roles';

export type NavLink = {
  label: string;
  screen: string;
  params?: object;
  icon?: string;
};

export type NavSection = {
  title: string;
  items: NavLink[];
  icon?: string;
};

const I = {
  leads: '📋',
  clients: '🏢',
  employees: '👥',
  managers: '🛡️',
  leaves: '📅',
  training: '🎓',
  warehouse: '📦',
  returns: '🔄',
  payments: '💳',
  expenses: '💸',
  reports: '📊',
  products: '📦',
  settings: '⚙️',
  partner: '🤝',
  finance: '🏦',
};

function roleNavSections(user: CrmUser | null | undefined): NavSection[] {
  const flags = getRoleFlags(user);
  const {
    role,
    isAdmin,
    isSuperAdmin,
    isPartner,
    isManager,
    isCoordinator,
    isSeniorCoordinator,
    isExecutive,
    isTrainer,
    isWarehouseExecutive,
    isWarehouseManager,
    isFinanceManager,
    isExecutiveManager,
    isRegionalManager,
    isRegionalHead,
    isNationalHead,
  } = flags;

  if (isRegionalManager || isRegionalHead || isNationalHead) {
    const level = isRegionalManager
      ? 'regional-manager'
      : isRegionalHead
        ? 'regional-head'
        : 'national-head';
    return [
      {
        title: 'My Dashboard',
        icon: I.managers,
        items: [
          {
            label: 'My Dashboard',
            screen: 'HierarchyDashboard',
            params: { level, personId: (user as { _id?: string } | null | undefined)?._id },
          },
        ],
      },
      {
        title: 'Settings',
        icon: I.settings,
        items: [{ label: 'Change Password', screen: 'SettingsPassword', icon: '🔐' }],
      },
    ];
  }

  if (isPartner || role === 'Vendor') {
    return [
      {
        title: 'Vendor',
        icon: I.partner,
        // DCs are internal: vendors see their stock only (web Partner menu).
        items: [{ label: 'Stocks', screen: 'PartnerStocks' }],
      },
    ];
  }

  if (isTrainer) {
    return [
      {
        title: 'Training & Services',
        items: [
          {
            label: 'Training & Services (Active / Upcoming)',
            screen: 'TrainingTrainerMy',
          },
          {
            label: 'Completed Training & Services',
            screen: 'TrainingTrainerCompleted',
          },
        ],
      },
      {
        title: 'Expense',
        items: [
          { label: 'Create Expense', screen: 'ExpenseCreate' },
          { label: 'My Expenses', screen: 'ExpenseMy' },
        ],
      },
      {
        title: 'Leave Management',
        items: [
          { label: 'Leave Request', screen: 'LeaveRequest' },
          { label: 'My Leaves', screen: 'LeavesApproved' },
        ],
      },
    ];
  }

  if (isExecutive || role === 'Sales BDE') {
    return [
      {
        title: 'DC',
        items: [
          { label: 'Create Sale', screen: 'DCCreateSale' },
          { label: 'Emp DC', screen: 'DCEmp' },
        ],
      },
      {
        title: 'Clients',
        items: [
          { label: 'My Clients', screen: 'DCClient' },
          { label: 'Renewal', screen: 'LeadsRenewalList' },
          { label: 'Term-Wise DC', screen: 'DCTermWise' },
        ],
      },
      {
        title: 'Leads',
        items: [
          { label: 'Add Lead', screen: 'LeadAdd' },
          { label: 'Followup Leads', screen: 'LeadFollowup' },
          { label: 'My Leads', screen: 'LeadsList' },
          { label: 'School Visits', screen: 'SchoolVisits' },
        ],
      },
      {
        title: 'Payments',
        items: [
          { label: 'Pending Payments', screen: 'PaymentList' },
          { label: 'Add Payment', screen: 'PaymentAdd' },
          { label: 'Payments Done', screen: 'PaymentDone' },
        ],
      },
      {
        title: 'Expenses',
        items: [
          { label: 'Create Expense', screen: 'ExpenseCreate' },
          { label: 'My Expenses', screen: 'ExpenseMy' },
        ],
      },
      {
        title: 'More',
        items: [
          { label: 'Sample Request', screen: 'SamplesRequest' },
          { label: 'Stock Returns', screen: 'ReturnsEmployee' },
          { label: 'Leave Request', screen: 'LeaveRequest' },
          { label: 'My Leaves', screen: 'LeavesApproved' },
        ],
      },
    ];
  }

  if (isExecutiveManager) {
    const managerId = (user as any)?._id;
    return [
      {
        title: 'My Dashboard',
        items: [
          { label: 'My Dashboard', screen: 'ExecutiveManagerDashboard', params: { managerId } },
        ],
      },
      {
        title: 'Executives',
        items: [{ label: 'Executives', screen: 'ExecutiveManagerExecutives' }],
      },
      {
        title: 'Clients',
        items: [{ label: 'PO Edit Request', screen: 'ClientsClosedSales' }],
      },
      {
        title: 'Expenses',
        items: [
          { label: 'Create Expenses', screen: 'ExpenseCreate' },
          { label: 'My Pending Expenses', screen: 'ExpenseMy', params: { view: 'pending' } },
          { label: 'My Completed Expenses', screen: 'ExpenseMy', params: { view: 'completed' } },
          { label: 'Team Expenses to Approve', screen: 'ExpenseExecutiveManagerPending' },
          { label: 'Team Approved / Rejected', screen: 'ExpenseExecutiveManagerPending', params: { tab: 'decided' } },
          { label: 'Employee Track', screen: 'ReportsEmployeeTrack' },
        ],
      },
      {
        title: 'Leave Management',
        items: [
          { label: 'Team Leaves', screen: 'ExecutiveManagerLeaves', params: { managerId } },
          { label: 'Leave Request', screen: 'LeaveRequest' },
          { label: 'My Leaves', screen: 'LeavesApproved' },
        ],
      },
      {
        title: 'Employees',
        items: [{ label: 'Employee Verification', screen: 'EmployeeVerification' }],
      },
    ];
  }

  const isHrRole = role === 'HR Manager' || role === 'HR Executive';
  if (isHrRole) {
    return [
      {
        title: 'Employees',
        icon: I.employees,
        items: [
          { label: 'New Employee', screen: 'EmployeeNew', icon: '➕' },
          { label: 'Employee Approval Status', screen: 'EmployeeVerification', icon: '✅' },
          { label: 'Active Employees', screen: 'EmployeesActive', icon: '👥' },
          { label: 'Inactive Employees', screen: 'EmployeesInactive', icon: '🚫' },
          { label: 'Team Attendance', screen: 'AttendanceRoster', icon: '🕒' },
        ],
      },
      {
        title: 'Leave Management',
        icon: I.leaves,
        items: [
          { label: 'Pending Leaves', screen: 'LeavesPending', icon: '⏳' },
          { label: 'Leaves Report', screen: 'LeavesReport', icon: '📊' },
          { label: 'Leave Request', screen: 'LeaveRequest', icon: '➕' },
          { label: 'My Leaves', screen: 'LeavesApproved', icon: '📅' },
        ],
      },
      {
        title: 'Expenses',
        icon: I.expenses,
        items: [
          { label: 'Create Expenses', screen: 'ExpenseCreate', icon: '➕' },
          { label: 'Pending Expenses', screen: 'ExpenseMy', params: { view: 'pending' }, icon: '⏳' },
          { label: 'Completed Expenses', screen: 'ExpenseMy', params: { view: 'completed' }, icon: '✅' },
        ],
      },
      {
        title: 'Settings',
        icon: I.settings,
        items: [{ label: 'Change Password', screen: 'SettingsPassword', icon: '🔐' }],
      },
    ];
  }

  if (role === 'Office Team') {
    return [
      {
        title: 'Leave Management',
        icon: I.leaves,
        items: [
          { label: 'Leave Request', screen: 'LeaveRequest', icon: '➕' },
          { label: 'My Leaves', screen: 'LeavesApproved', icon: '📅' },
        ],
      },
      {
        title: 'Expenses',
        icon: I.expenses,
        items: [
          { label: 'Create Expenses', screen: 'ExpenseCreate', icon: '➕' },
          { label: 'Pending Expenses', screen: 'ExpenseMy', params: { view: 'pending' }, icon: '⏳' },
          { label: 'Completed Expenses', screen: 'ExpenseMy', params: { view: 'completed' }, icon: '✅' },
        ],
      },
      {
        title: 'Settings',
        icon: I.settings,
        items: [{ label: 'Change Password', screen: 'SettingsPassword', icon: '🔐' }],
      },
    ];
  }

  if (isManager) {
    return [
      {
        title: 'My Products',
        icon: I.managers,
        items: [{ label: 'Assigned products', screen: 'ProductManager' }],
      },
      {
        title: 'Employees',
        icon: I.employees,
        items: [{ label: 'Employee Verification', screen: 'EmployeeVerification' }],
      },
      {
        // Claims the admin tagged to this Product Manager (e.g. their Trainers').
        title: 'Expenses',
        icon: I.expenses,
        items: [{ label: 'Pending Expenses List', screen: 'ExpensePending', icon: '⏳' }],
      },
      {
        title: 'Leave Management',
        icon: I.leaves,
        items: [
          { label: 'Pending Leaves', screen: 'LeavesPending' },
          { label: 'Leave Request', screen: 'LeaveRequest' },
          { label: 'My Leaves', screen: 'LeavesApproved' },
        ],
      },
      {
        title: 'Settings',
        icon: I.settings,
        items: [{ label: 'Change Password', screen: 'SettingsPassword', icon: '🔐' }],
      },
    ];
  }

  if (isCoordinator || isSeniorCoordinator) {
    const clientsChildren: NavLink[] = [
      { label: 'Closed Sales', screen: 'DCClosed' },
      { label: 'Saved DC', screen: 'DCSaved' },
      { label: 'EMP DC', screen: 'DCEmp' },
    ];
    if (isSeniorCoordinator) {
      clientsChildren.splice(2, 0, { label: 'Pending DC', screen: 'DCPending' });
    }
    if (!isManager) {
      clientsChildren.unshift({ label: 'Create Sale', screen: 'DCCreateSale' });
    }
    return [
      { title: 'Clients', items: clientsChildren },
      {
        title: 'Warehouse',
        items: [
          { label: 'DC @ Warehouse', screen: 'WarehouseDCAtWarehouse' },
          { label: 'Completed DC', screen: 'WarehouseCompletedDC' },
          { label: 'DC Listed', screen: 'WarehouseDCListed' },
        ],
      },
      {
        title: 'Expenses',
        items: [{ label: 'Pending Expenses', screen: 'ExpensePending' }],
      },
      {
        title: 'Reports',
        items: [
          { label: 'Leads', screen: 'ReportsLeads' },
          { label: 'Sales Visit', screen: 'ReportsSalesVisit' },
          { label: 'Employee Track', screen: 'ReportsEmployeeTrack' },
          { label: 'All Expenses', screen: 'ReportsExpenses' },
        ],
      },
      {
        title: 'Leave Management',
        items: [
          { label: 'Pending Leaves', screen: 'LeavesPending' },
          { label: 'Leave Request', screen: 'LeaveRequest' },
          { label: 'My Leaves', screen: 'LeavesApproved' },
        ],
      },
      {
        title: 'Settings',
        items: [{ label: 'Change Password', screen: 'SettingsPassword' }],
      },
    ];
  }

  if (isWarehouseExecutive || isWarehouseManager) {
    return [
      {
        title: 'Warehouse',
        items: [
          { label: 'Inventory Items', screen: 'WarehouseInventoryItems' },
          { label: 'Stock', screen: 'WarehouseStock' },
          { label: 'Pending Stock Approvals', screen: 'WarehouseStockApprovals' },
          { label: 'DC @ Warehouse', screen: 'WarehouseDCAtWarehouse' },
          { label: 'Hold DC', screen: 'WarehouseHoldDC' },
          { label: 'Returns', screen: isWarehouseManager ? 'ReturnsWarehouseManager' : 'ReturnsWarehouseExecutive' },
        ],
      },
    ];
  }

  if (isFinanceManager) {
    return [
      {
        title: 'Finance',
        items: [
          { label: 'Finance Approved Exp List', screen: 'ExpenseFinancePending' },
          { label: 'Expense Approvers', screen: 'ExpenseApprovers' },
          { label: 'Payments', screen: 'PaymentList' },
        ],
      },
    ];
  }

  // Admin / default — aligned with web Sidebar
  const sections: NavSection[] = [
    {
      title: 'Leads',
      icon: I.leads,
      items: [
        { label: 'All Leads', screen: 'LeadsList', icon: '📋' },
        { label: 'Add Lead', screen: 'LeadAdd', icon: '➕' },
        { label: 'Followup Leads', screen: 'LeadFollowup', icon: '📞' },
        { label: 'Cross-Sale Leads', screen: 'CrossSaleLeads', icon: '🔁' },
        { label: 'School Visits', screen: 'SchoolVisits', icon: '📍' },
      ],
    },
    {
      title: 'Clients & DC',
      icon: I.clients,
      items: [
        { label: 'Create Sale', screen: 'DCCreateSale', icon: '➕' },
        { label: 'All Created DCs', screen: 'DCAdminMy', icon: '📋' },
        { label: 'Closed Sales', screen: 'DCClosed', icon: '✅' },
        { label: 'Saved DC', screen: 'DCSaved', icon: '💾' },
        ...(isSuperAdmin ? [{ label: 'Pending DC', screen: 'DCPending', icon: '⏳' }] : []),
        { label: 'EMP DC', screen: 'DCEmp', icon: '👤' },
      ],
    },
    {
      title: 'Employees',
      icon: I.employees,
      items: [
        ...(isSuperAdmin
          ? [{ label: 'Assign Managers', screen: 'ExecutiveManagers', icon: '🛡️' }]
          : []),
        { label: 'New Employee', screen: 'EmployeeNew', icon: '➕' },
        { label: 'Employee Verification', screen: 'EmployeeVerification', icon: '✅' },
        { label: 'Active Employees', screen: 'EmployeesActive', icon: '👥' },
        { label: 'Team Attendance', screen: 'AttendanceRoster', icon: '🕒' },
        { label: 'Inactive Employees', screen: 'EmployeesInactive', icon: '🚫' },
        ...(isSuperAdmin
          ? [
              { label: 'Assign Areas', screen: 'ExecutivesAssignAreas', icon: '📍' },
              { label: 'Zones', screen: 'EmployeesZones', icon: '🗺️' },
              { label: 'Clusters', screen: 'EmployeesClusters', icon: '🔗' },
            ]
          : []),
      ],
    },
    {
      title: 'Leave Management',
      icon: I.leaves,
      items: [
        { label: 'Pending Leaves', screen: 'LeavesPending', icon: '⏳' },
        { label: 'Leaves Report', screen: 'LeavesReport', icon: '📊' },
        { label: 'Leave Request', screen: 'LeaveRequest', icon: '➕' },
        { label: 'My Leaves', screen: 'LeavesApproved', icon: '📅' },
      ],
    },
    {
      title: 'Training & Services',
      icon: I.training,
      items: [
        { label: 'Assign Training/Service', screen: 'TrainingAssign', icon: '📋' },
        { label: 'Trainings List', screen: 'TrainingList', icon: '📚' },
        { label: 'Services List', screen: 'ServicesList', icon: '🔧' },
        { label: 'My Training & Services', screen: 'TrainingTrainerMy', icon: '🎓' },
        { label: 'Completed Training & Services', screen: 'TrainingTrainerCompleted', icon: '✅' },
      ],
    },
    {
      title: 'Warehouse',
      icon: I.warehouse,
      items: [
        { label: 'Inventory Items', screen: 'WarehouseInventoryItems', icon: '📋' },
        { label: 'Stock', screen: 'WarehouseStock', icon: '📦' },
        { label: 'Pending Stock Approvals', screen: 'WarehouseStockApprovals', icon: '✅' },
        { label: 'DC @ Warehouse', screen: 'WarehouseDCAtWarehouse', icon: '🏭' },
        { label: 'Completed DC', screen: 'WarehouseCompletedDC', icon: '✅' },
        { label: 'Hold DC', screen: 'WarehouseHoldDC', icon: '⏸️' },
        { label: 'DC Listed', screen: 'WarehouseDCListed', icon: '📝' },
        { label: 'Search DC', screen: 'WarehouseSearchDC', icon: '🔍' },
      ],
    },
    {
      title: 'Stock Returns',
      icon: I.returns,
      items: [
        { label: 'Employee Returns List', screen: 'ReturnsEmployee', icon: '👤' },
        { label: 'Executive Stock Returns', screen: 'ReturnsExecutive', icon: '📋' },
        { label: 'Warehouse Executive Returns', screen: 'ReturnsWarehouseExecutive', icon: '🏭' },
        { label: 'Warehouse Manager Returns', screen: 'ReturnsWarehouseManager', icon: '✅' },
        { label: 'Warehouse Returns List', screen: 'ReturnsWarehouse', icon: '🏢' },
      ],
    },
    {
      title: 'Payments',
      icon: I.payments,
      items: [
        { label: 'Pending Payments', screen: 'PaymentList', icon: '⏳' },
        { label: 'Add Payment', screen: 'PaymentAdd', icon: '➕' },
        { label: 'Payments Done', screen: 'PaymentDone', icon: '✅' },
        { label: 'Transaction Report', screen: 'PaymentTransactionReport', icon: '📊' },
        { label: 'Approval Pending Cash', screen: 'PaymentApprovalPendingCash', icon: '💵' },
        { label: 'Approval Pending Cheques', screen: 'PaymentApprovalPendingCheques', icon: '🏦' },
        { label: 'Approved Payments', screen: 'PaymentApproved', icon: '✔️' },
        { label: 'HOLD Payments', screen: 'PaymentHold', icon: '⏸️' },
      ],
    },
    {
      title: 'Expenses',
      icon: I.expenses,
      items: [
        { label: 'Pending Expenses List', screen: 'ExpensePending', icon: '⏳' },
        { label: 'Finance Approved Exp List', screen: 'ExpenseFinancePending', icon: '🏦' },
        { label: 'Expense Approvers', screen: 'ExpenseApprovers', icon: '🏷️' },
        { label: 'Create Expense', screen: 'ExpenseCreate', icon: '➕' },
        { label: 'My Expenses', screen: 'ExpenseMy', icon: '📄' },
      ],
    },
    {
      title: 'Reports',
      icon: I.reports,
      items: [
        { label: 'Leads Report', screen: 'ReportsLeads', icon: '📋' },
        { label: 'Sales Visit Report', screen: 'ReportsSalesVisit', icon: '🚗' },
        { label: 'Employee Track Report', screen: 'ReportsEmployeeTrack', icon: '📍' },
        { label: 'Contact Enquiries Report', screen: 'ReportsContactQueries', icon: '📞' },
        { label: 'Change Logs Report', screen: 'ReportsChangeLogs', icon: '📝' },
        { label: 'Stock Report', screen: 'ReportsStock', icon: '📊' },
        { label: 'DC Report', screen: 'ReportsDC', icon: '📦' },
        { label: 'Returns Report', screen: 'ReportsReturns', icon: '🔄' },
        { label: 'All Expenses Report', screen: 'ReportsExpenses', icon: '💸' },
        { label: 'Training & Service Report', screen: 'ReportsTrainingService', icon: '🎓' },
      ],
    },
  ];

  const settingsSection: NavSection = {
    title: 'Settings',
    icon: I.settings,
    items: [
      { label: 'Change Password', screen: 'SettingsPassword', icon: '🔐' },
      { label: 'App Dashboard Data Upload', screen: 'SettingsUpload', icon: '📤' },
      { label: 'SMS', screen: 'SettingsSMS', icon: '💬' },
      { label: 'DB Backup', screen: 'SettingsBackup', icon: '💾' },
      { label: 'Expense policy', screen: 'SettingsExpenses', icon: '⚙️' },
    ],
  };

  if (isAdmin) {
    sections.push({
      title: 'Products',
      icon: I.products,
      items: [
        { label: 'All Products', screen: 'ProductsList', icon: '📦' },
        { label: 'Add Product', screen: 'ProductNew', icon: '➕' },
      ],
    });
    sections.push({
      title: 'Vendor',
      icon: I.partner,
      items: [
        { label: 'Vendors', screen: 'VendorsList', icon: '🤝' },
        { label: 'Stocks', screen: 'PartnerStocks', icon: '📦' },
        { label: 'My DCs', screen: 'PartnerDCs', icon: '🚚' },
      ],
    });
  }

  sections.push(settingsSection);

  // Super Admin has no operational Leads module; privileged menus are Super Admin only.
  if (isSuperAdmin) {
    sections.splice(1, 0, {
      title: 'Hierarchy',
      icon: I.managers,
      items: [
        { label: 'Assign Hierarchy', screen: 'HierarchyAssign', icon: '🛡️' },
        { label: 'Assign Products', screen: 'ProductManagerAssign', icon: '📦' },
      ],
    });
    return sections.filter((s) => s.title !== 'Leads');
  }

  return sections.filter(
    (s) =>
      s.title !== 'Stock Returns' &&
      s.title !== 'Payments' &&
      s.title !== 'Expenses' &&
      s.title !== 'Reports' &&
      s.title !== 'Settings'
  );
}

const NON_EMPLOYEE_ROLES = new Set(['Vendor', 'Partner', 'Franchise']);
const TEAM_ATTENDANCE_ROLES = new Set([
  'Admin', 'Super Admin', 'HR Manager', 'HR Executive', 'Executive Manager', 'Coordinator',
  'Senior Coordinator', 'Regional Manager', 'Regional Head', 'National Head',
]);

const TICKET_INBOX_ROLES = new Set(['Admin', 'Super Admin', 'Coordinator', 'Senior Coordinator']);

const hasScreen = (sections: NavSection[], screen: string) =>
  sections.some((section) => section.items.some((item) => item.screen === screen));

/** Screens ported from the web, added to a role's menu in the section the web shows them under. */
const BDE_ROLES = new Set(['Executive', 'Sales BDE', 'Employee', 'BDE']);
const COORDINATOR_ROLES = new Set(['Coordinator', 'Senior Coordinator']);
const WEB_PORTED_LINKS: { section: string; link: NavLink; allowed: (role: string, superAdmin: boolean) => boolean }[] = [
  { section: 'Employees', link: { label: 'Payroll', screen: 'EmployeesPayroll', icon: '💰' }, allowed: (r, sa) => sa || r === 'HR Manager' },
  { section: 'Employees', link: { label: 'Salary', screen: 'EmployeesSalary', icon: '💵' }, allowed: (r, sa) => sa || r === 'Admin' || r === 'HR Manager' },
  {
    section: 'Employees',
    link: { label: 'Employee History', screen: 'EmployeesHistory', icon: '🗂️' },
    allowed: (r, sa) => sa || ['Admin', 'HR Manager', 'HR Executive'].includes(r),
  },
  { section: 'Employees', link: { label: 'Move Schools', screen: 'EmployeesMoveSchools', icon: '🔀' }, allowed: (r, sa) => sa || r === 'Admin' },
  { section: 'Employees', link: { label: 'Cluster Schools', screen: 'EmployeesClusterSchools', icon: '🏫' }, allowed: (_r, sa) => sa },
  { section: 'Employees', link: { label: 'Chain', screen: 'EmployeesChain', icon: '🔗' }, allowed: (r, sa) => sa || r === 'Admin' },
  {
    section: 'Training & Services',
    link: { label: 'Training Request', screen: 'TrainingRequest', icon: '📝' },
    allowed: (r) => BDE_ROLES.has(r) || r === 'Trainer',
  },
  {
    section: 'Training & Services',
    link: { label: 'Training Requests', screen: 'TrainingRequests', icon: '📋' },
    allowed: (r, sa) => sa || r === 'Admin' || COORDINATOR_ROLES.has(r),
  },
  { section: 'Leads', link: { label: 'Sales Collateral', screen: 'SalesCollateral', icon: '📁' }, allowed: (r, sa) => sa || BDE_ROLES.has(r) },
  {
    section: 'Reports',
    link: { label: 'Operational Reports', screen: 'ReportsOperational', icon: '📊' },
    allowed: (r, sa) => sa || r === 'Admin' || r === 'Finance Manager' || COORDINATOR_ROLES.has(r),
  },
  { section: 'Settings', link: { label: 'Roles & Permissions', screen: 'SettingsRoles', icon: '🔐' }, allowed: (_r, sa) => sa },
  { section: 'Expenses', link: { label: 'My Trips (GPS km)', screen: 'MyTrips', icon: '🛵' }, allowed: () => true },
];

function addWebPortedLinks(sections: NavSection[], role: string, superAdmin: boolean): NavSection[] {
  let out = sections;
  // Grid DC sits right after Create Sale, as on the web.
  if ((superAdmin || role === 'Admin' || COORDINATOR_ROLES.has(role)) && !hasScreen(out, 'DCGrid')) {
    const grid: NavLink = { label: 'Create DC / Main DCs', screen: 'DCGrid', icon: '🧮' };
    const at = out.findIndex((s) => s.items.some((item) => item.screen === 'DCCreateSale'));
    const target = at >= 0 ? at : out.findIndex((s) => s.title === 'Clients' || s.title === 'Clients & DC' || s.title === 'DC');
    if (target >= 0) {
      out = out.map((s, i) => {
        if (i !== target) return s;
        const after = s.items.findIndex((item) => item.screen === 'DCCreateSale');
        const items = [...s.items];
        items.splice(after >= 0 ? after + 1 : items.length, 0, grid);
        return { ...s, items };
      });
    }
  }
  for (const { section, link, allowed } of WEB_PORTED_LINKS) {
    if (!allowed(role, superAdmin) || hasScreen(out, link.screen)) continue;
    const at = out.findIndex((s) => s.title === section);
    if (at >= 0) {
      out = out.map((s, i) => (i === at ? { ...s, items: [...s.items, link] } : s));
    } else {
      const settingsAt = out.findIndex((s) => s.title === 'Settings');
      const added: NavSection = { title: section, icon: I.employees, items: [link] };
      out = settingsAt >= 0 && section !== 'Settings'
        ? [...out.slice(0, settingsAt), added, ...out.slice(settingsAt)]
        : [...out, added];
    }
  }
  return out;
}

/**
 * Menu per role, plus what every employee login gets (as on the web): Create / Pending /
 * Completed expenses instead of "My Expenses", own Attendance, Team Attendance for managers,
 * and My Pay Slips.
 */
export function getNavSections(user: CrmUser | null | undefined): NavSection[] {
  const role = String((user as { role?: string } | null | undefined)?.role || '');
  let sections = roleNavSections(user).map((section) => ({
    ...section,
    items: section.items.flatMap((item): NavLink[] => {
      if (item.screen === 'ExpenseMy' && !item.params) {
        return [
          { label: 'Pending Expenses', screen: 'ExpenseMy', params: { view: 'pending' }, icon: '⏳' },
          { label: 'Completed Expenses', screen: 'ExpenseMy', params: { view: 'completed' }, icon: '✅' },
        ];
      }
      if (item.screen === 'ExpenseCreate' && item.label === 'Create Expense') return [{ ...item, label: 'Create Expenses' }];
      return [item];
    }),
  }));
  // Tickets: everyone can raise one; Admin / Coordinators also work the ticket inbox.
  const tickets: NavLink[] = [{ label: 'Raise Ticket', screen: 'RaiseTicket', icon: '🎫' }];
  if (TICKET_INBOX_ROLES.has(role)) {
    tickets.push(
      { label: 'All Tickets', screen: 'ViewTickets', params: { view: 'all' }, icon: '📥' },
      { label: 'Pending Tickets', screen: 'ViewTickets', params: { view: 'pending' }, icon: '⏳' },
      { label: 'Solved Tickets', screen: 'ViewTickets', params: { view: 'solved' }, icon: '✅' },
    );
  }
  const ticketsAt = sections.findIndex((section) => section.title === 'Settings');
  const ticketSection: NavSection = { title: 'Tickets', icon: '🎫', items: tickets };
  sections = ticketsAt >= 0
    ? [...sections.slice(0, ticketsAt), ticketSection, ...sections.slice(ticketsAt)]
    : [...sections, ticketSection];
  if (!role || NON_EMPLOYEE_ROLES.has(role)) return sections;
  const advanceLinks: NavLink[] = [
    { label: 'Request Advance', screen: 'AdvanceRequest' },
    { label: 'Advance Status', screen: 'AdvanceStatus' },
    { label: 'Advance History', screen: 'AdvanceHistory' },
    { label: 'Advance Approvals', screen: 'AdvanceApprovals' },
  ];
  const advanceKeys = ['advance.request.page.view', 'advance.status.page.view', 'advance.history.page.view', 'advance.approvals.page.view'];
  const permittedAdvanceLinks = advanceLinks.filter((_, index) => user?.isSuperAdmin || role === 'Super Admin'
    || user?.rbacEnabled === false || user?.permissions?.includes(advanceKeys[index]));
  if (permittedAdvanceLinks.length) sections.push({ title: 'Advance', icon: '💳', items: permittedAdvanceLinks });

  // Every employee login can raise its own expenses.
  if (!hasScreen(sections, 'ExpenseCreate')) {
    const expenses: NavSection = {
      title: 'Expenses',
      icon: I.expenses,
      items: [
        { label: 'Create Expenses', screen: 'ExpenseCreate', icon: '➕' },
        { label: 'Pending Expenses', screen: 'ExpenseMy', params: { view: 'pending' }, icon: '⏳' },
        { label: 'Completed Expenses', screen: 'ExpenseMy', params: { view: 'completed' }, icon: '✅' },
      ],
    };
    const at = sections.findIndex((section) => section.title === 'Expenses');
    if (at >= 0) sections[at] = { ...sections[at], items: [...expenses.items, ...sections[at].items] };
    else {
      const settingsAt = sections.findIndex((section) => section.title === 'Settings');
      sections = settingsAt >= 0 ? [...sections.slice(0, settingsAt), expenses, ...sections.slice(settingsAt)] : [...sections, expenses];
    }
  }

  const extra: NavLink[] = [];
  if (!hasScreen(sections, 'MyAttendance')) extra.push({ label: 'Attendance', screen: 'MyAttendance', icon: '🕒' });
  if (TEAM_ATTENDANCE_ROLES.has(role) && !hasScreen(sections, 'AttendanceRoster')) {
    extra.push({ label: 'Team Attendance', screen: 'AttendanceRoster', icon: '👥' });
  }
  if (!hasScreen(sections, 'MyPayslips')) extra.push({ label: 'My Pay Slips', screen: 'MyPayslips', icon: '🧾' });
  if (extra.length) {
    const settingsAt = sections.findIndex((section) => section.title === 'Settings');
    const mine: NavSection = { title: 'My Work', icon: I.employees, items: extra };
    sections = settingsAt >= 0
      ? [...sections.slice(0, settingsAt), mine, ...sections.slice(settingsAt)]
      : [...sections, mine];
  }
  const superAdmin = role === 'Super Admin' || !!(user as { isSuperAdmin?: boolean } | null | undefined)?.isSuperAdmin;
  return addWebPortedLinks(sections, role, superAdmin);
}
