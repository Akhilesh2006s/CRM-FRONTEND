/**
 * Mobile nav items — aligned with navbar-landing/components/dashboard/Sidebar.tsx
 * (non-DMS, AI excluded)
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
        title: 'Partner',
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
          { label: 'Apply for Leave', screen: 'LeaveRequest' },
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
          { label: 'Renewal Leads', screen: 'LeadsRenewalList' },
          { label: 'Followup Leads', screen: 'LeadFollowup' },
          { label: 'My Leads', screen: 'LeadsList' },
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
          { label: 'Apply for Leave', screen: 'LeaveRequest' },
          { label: 'My Leaves', screen: 'LeavesApproved' },
        ],
      },
    ];
  }

  if (isExecutiveManager) {
    return [
      {
        title: 'Executive Manager',
        items: [
          { label: 'Dashboard', screen: 'ExecutiveManagerDashboard', params: { managerId: (user as any)?._id } },
          { label: 'Executives', screen: 'ExecutiveManagerExecutives' },
          { label: 'Closed Sales', screen: 'ClientsClosedSales' },
          { label: 'Pending Expenses', screen: 'ExpenseExecutiveManagerPending' as const },
          { label: 'My Leaves', screen: 'ExecutiveManagerLeaves', params: { managerId: (user as any)?._id } },
        ],
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
      clientsChildren.unshift({ label: 'Create Sale', screen: 'DCCreate' });
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
        title: 'Leaves',
        items: [
          { label: 'Pending Leaves', screen: 'LeavesPending' },
          { label: 'Apply for Leave', screen: 'LeaveRequest' },
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
          { label: 'Finance Pending Expenses', screen: 'ExpenseFinancePending' },
          { label: 'Payments', screen: 'PaymentList' },
        ],
      },
    ];
  }

  // Admin / default — aligned with web Sidebar (non-DMS, non-AI)
  const sections: NavSection[] = [
    {
      title: 'Leads',
      icon: I.leads,
      items: [
        { label: 'All Leads', screen: 'LeadsList', icon: '📋' },
        { label: 'Add Lead', screen: 'LeadAdd', icon: '➕' },
        { label: 'Renewal Leads', screen: 'LeadsRenewalList', icon: '🔄' },
        { label: 'Followup Leads', screen: 'LeadFollowup', icon: '📞' },
      ],
    },
    {
      title: 'Clients & DC',
      icon: I.clients,
      items: [
        { label: 'Create Sale', screen: 'DCCreate', icon: '➕' },
        { label: 'Closed Sales', screen: 'DCClosed', icon: '✅' },
        { label: 'Saved DC', screen: 'DCSaved', icon: '💾' },
        { label: 'Pending DC', screen: 'DCPending', icon: '⏳' },
        { label: 'EMP DC', screen: 'DCEmp', icon: '👤' },
        { label: 'Term-Wise DC', screen: 'DCTermWise', icon: '📄' },
        { label: 'Admin DC', screen: 'DCAdmin', icon: '🛡️' },
        { label: 'Completed DC', screen: 'DCCompleted', icon: '📦' },
      ],
    },
    {
      title: 'Employees',
      icon: I.employees,
      items: [
        { label: 'New Employee', screen: 'EmployeeNew', icon: '➕' },
        { label: 'Active Employees', screen: 'EmployeesActive', icon: '👥' },
        { label: 'Inactive Employees', screen: 'EmployeesInactive', icon: '🚫' },
        { label: 'Zones', screen: 'EmployeesZones', icon: '🗺️' },
        { label: 'Clusters', screen: 'EmployeesClusters', icon: '🔗' },
      ],
    },
    {
      title: 'Leaves',
      icon: I.leaves,
      items: [
        { label: 'Pending Leaves', screen: 'LeavesPending', icon: '⏳' },
        { label: 'Leaves Report', screen: 'LeavesReport', icon: '📊' },
        { label: 'Apply for Leave', screen: 'LeaveRequest', icon: '➕' },
        { label: 'My Leaves', screen: 'LeavesApproved', icon: '📅' },
      ],
    },
    {
      title: 'Training & Services',
      icon: I.training,
      items: [
        { label: 'Trainers Dashboard', screen: 'TrainingDashboard', icon: '📊' },
        { label: 'Assign Training', screen: 'TrainingAssign', icon: '📋' },
        { label: 'Trainings List', screen: 'TrainingList', icon: '📚' },
        { label: 'Services List', screen: 'ServicesList', icon: '🔧' },
        { label: 'New Trainer', screen: 'TrainersNew', icon: '➕' },
        { label: 'Active Trainers', screen: 'TrainersActive', icon: '✅' },
        { label: 'Inactive Trainers', screen: 'TrainersInactive', icon: '🚫' },
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
        { label: 'Employee Returns', screen: 'ReturnsEmployee', icon: '👤' },
        { label: 'Warehouse Returns', screen: 'ReturnsWarehouse', icon: '🏢' },
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
        { label: 'Pending Cash Approval', screen: 'PaymentApprovalPendingCash', icon: '💵' },
        { label: 'Pending Cheques', screen: 'PaymentApprovalPendingCheques', icon: '🏦' },
      ],
    },
    {
      title: 'Expenses',
      icon: I.expenses,
      items: [
        { label: 'Pending Expenses', screen: 'ExpensePending', icon: '⏳' },
        { label: 'Finance Pending', screen: 'ExpenseFinancePending', icon: '🏦' },
        { label: 'Create Expense', screen: 'ExpenseCreate', icon: '➕' },
      ],
    },
    {
      title: 'Reports',
      icon: I.reports,
      items: [
        { label: 'Leads Reports', screen: 'ReportsLeads', icon: '📋' },
        { label: 'Sales Visit', screen: 'ReportsSalesVisit', icon: '🚗' },
        { label: 'Employee Track', screen: 'ReportsEmployeeTrack', icon: '📍' },
        { label: 'DC Report', screen: 'ReportsDC', icon: '📦' },
        { label: 'Stock Report', screen: 'ReportsStock', icon: '📊' },
        { label: 'Returns Report', screen: 'ReportsReturns', icon: '🔄' },
        { label: 'All Expenses', screen: 'ReportsExpenses', icon: '💸' },
      ],
    },
  ];

  if (isAdmin) {
    const leavesIdx = sections.findIndex((s) => s.title === 'Leaves');
    if (leavesIdx >= 0) {
      sections[leavesIdx] = {
        ...sections[leavesIdx],
        items: sections[leavesIdx].items.filter(
          (i) => i.screen !== 'LeaveRequest' && i.screen !== 'LeavesApproved'
        ),
      };
    }
    sections.push({
      title: 'Products',
      icon: I.products,
      items: [
        { label: 'All Products', screen: 'ProductsList', icon: '📦' },
        { label: 'Add Product', screen: 'ProductNew', icon: '➕' },
        { label: 'Partners / Vendors', screen: 'VendorsList', icon: '🤝' },
        { label: 'Deliverables', screen: 'DeliverablesList', icon: '📋' },
      ],
    });
    sections.push({
      title: 'Settings',
      icon: I.settings,
      items: [
        { label: 'Change Password', screen: 'SettingsPassword', icon: '🔐' },
        { label: 'Data Upload', screen: 'SettingsUpload', icon: '📤' },
        { label: 'SMS Settings', screen: 'SettingsSMS', icon: '💬' },
        { label: 'DB Backup', screen: 'SettingsBackup', icon: '💾' },
        { label: 'Expense Policy', screen: 'SettingsExpenses', icon: '⚙️' },
      ],
    });
  }

  return sections;
}
