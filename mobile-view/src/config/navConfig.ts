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

export function getNavSections(user: CrmUser | null | undefined): NavSection[] {
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
  } = flags;

  if (isPartner || role === 'Vendor') {
    return [
      {
        title: 'Vendor',
        icon: I.partner,
        items: [
          { label: 'Stocks', screen: 'PartnerStocks' },
          { label: 'My DCs', screen: 'PartnerDCs' },
        ],
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
        title: 'Leads',
        items: [
          { label: 'Add Lead', screen: 'LeadAdd' },
          { label: 'Followup Leads', screen: 'LeadFollowup' },
          { label: 'My Leads', screen: 'LeadsList' },
          { label: 'School Visits', screen: 'SchoolVisits' },
        ],
      },
      {
        title: 'Clients',
        items: [
          { label: 'My Clients', screen: 'DCClient' },
          { label: 'Term-Wise DC', screen: 'DCTermWise' },
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
        items: [{ label: 'Pending Expenses', screen: 'ExpenseExecutiveManagerPending' }],
      },
      {
        title: 'Leave Management',
        items: [{ label: 'Leave Management', screen: 'ExecutiveManagerLeaves', params: { managerId } }],
      },
    ];
  }

  if (isManager || isCoordinator || isSeniorCoordinator) {
    const clientsChildren: NavLink[] = [
      { label: 'Closed Sales', screen: 'DCClosed' },
      { label: 'Saved DC', screen: 'DCSaved' },
      { label: 'Pending DC', screen: 'DCPending' },
      { label: 'EMP DC', screen: 'DCEmp' },
    ];
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
        { label: 'Pending DC', screen: 'DCPending', icon: '⏳' },
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
        { label: 'Active Employees', screen: 'EmployeesActive', icon: '👥' },
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
        { label: 'Deliverables', screen: 'DeliverablesList', icon: '📋' },
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
