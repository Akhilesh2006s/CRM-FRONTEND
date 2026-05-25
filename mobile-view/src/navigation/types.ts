export type RootStackParamList = {
  Login: undefined;
  FirstTimeAttendance: undefined;
  Dashboard: undefined;
  
  // Leads
  LeadsList: undefined;
  LeadAdd: undefined;
  LeadAddNewSchool: undefined;
  LeadAddRenewal: undefined;
  LeadEdit: { id: string };
  LeadFollowup: undefined;
  LeadClose: { id: string };
  
  // DC Management
  DCCreate: undefined;
  DCClosed: undefined;
  DCSaved: undefined;
  DCPending: undefined;
  DCAdminMy: undefined;
  DCEdit: { id: string };
  DCManager: undefined;
  DCClient: undefined;
  DCRequestSummary: { orderId: string; client?: any };
  ClientEditPO: { orderId: string };
  DCEmp: undefined;
  DCAdmin: undefined;
  DCList: { type?: string };
  DCCapture: { type?: string };
  
  // Employees
  EmployeeNew: undefined;
  EmployeeEdit: { id: string };
  EmployeesActive: undefined;
  EmployeesInactive: undefined;
  EmployeesLeaves: undefined;
  
  // Executive Managers
  ExecutiveManagers: undefined;
  ExecutiveManagerDashboard: { managerId: string };
  ExecutiveManagerLeaves: { managerId: string };
  POChangeRequests: undefined;
  POChangeRequestDetail: { orderId: string };
  
  // Leave Management
  LeavesPending: undefined;
  LeavesReport: undefined;
  LeaveRequest: undefined;
  LeavesApproved: undefined;
  
  // Training & Services
  TrainingAssign: undefined;
  TrainingList: undefined;
  TrainingDashboard: undefined;
  TrainingEdit: { id: string };
  TrainersNew: undefined;
  TrainersEdit: { id: string };
  TrainersActive: undefined;
  TrainersInactive: undefined;
  ServicesList: undefined;
  ServiceEdit: { id: string };
  
  // Warehouse
  WarehouseInventoryItems: undefined;
  WarehouseInventoryItemNew: undefined;
  WarehouseInventoryItemEdit: { id: string };
  WarehouseStock: undefined;
  WarehouseStockAdd: undefined;
  WarehouseDCAtWarehouse: undefined;
  WarehouseDCAtWarehouseDetail: { id: string };
  WarehouseCompletedDC: undefined;
  WarehouseHoldDC: undefined;
  WarehouseDCListed: undefined;
  
  // Stock Returns
  ReturnsEmployee: undefined;
  ReturnsWarehouse: undefined;
  
  // Payments
  PaymentList: undefined;
  PaymentAdd: undefined;
  PaymentTransactionReport: undefined;
  PaymentApprovalPendingCash: undefined;
  PaymentApprovalPendingCashDetail: { id: string };
  PaymentApprovalPendingCheques: undefined;
  PaymentApprovalPendingChequesDetail: { id: string };
  PaymentApproved: undefined;
  PaymentDone: undefined;
  PaymentHold: undefined;
  
  // Expenses
  ExpenseList: { myExpenses?: boolean };
  ExpenseCreate: undefined;
  ExpenseEdit: { id: string };
  ExpensePending: undefined;
  ExpenseFinancePending: undefined;
  ExpenseMy: undefined;
  ExpenseManagerUpdate: { employeeId: string };
  
  // Reports
  ReportsLeads: undefined;
  ReportsLeadsOpen: undefined;
  ReportsLeadsFollowup: undefined;
  ReportsLeadsClosed: undefined;
  ReportsSalesVisit: undefined;
  ReportsEmployeeTrack: undefined;
  ReportsContactQueries: undefined;
  ReportsChangeLogs: undefined;
  ReportsStock: undefined;
  ReportsDC: undefined;
  ReportsReturns: undefined;
  ReportsExpenses: undefined;
  ReportsTrainingService: undefined;
  
  // Products
  ProductsList: undefined;
  ProductNew: undefined;
  ProductEdit: { id: string };
  
  // Sales
  Sales: undefined;
  
  // Inventory
  Inventory: undefined;
  
  // Samples
  SamplesRequest: undefined;
  
  // Executives
  ExecutivesAssignAreas: undefined;
  
  // Settings
  SettingsPassword: undefined;
  SettingsUpload: undefined;
  SettingsSMS: undefined;
  SettingsBackup: undefined;
};

