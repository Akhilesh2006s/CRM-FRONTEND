import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IonName = ComponentProps<typeof Ionicons>['name'];

export const SECTION_ICONS: Record<string, IonName> = {
  Advance: 'cash-outline',
  Leads: 'people-outline',
  'Clients & DC': 'business-outline',
  Clients: 'business-outline',
  Employees: 'id-card-outline',
  'Executive Managers': 'shield-checkmark-outline',
  Leaves: 'calendar-outline',
  'Training & Services': 'school-outline',
  Training: 'school-outline',
  Warehouse: 'cube-outline',
  'Stock Returns': 'return-down-back-outline',
  Payments: 'card-outline',
  Expenses: 'wallet-outline',
  Reports: 'bar-chart-outline',
  Products: 'grid-outline',
  Settings: 'settings-outline',
  Partner: 'hand-left-outline',
  Finance: 'cash-outline',
  More: 'ellipsis-horizontal-circle-outline',
};

/** Per stack screen — premium Ionicons + brand accent */
export const SCREEN_ICONS: Record<string, { name: IonName; color: string }> = {
  AdvanceRequest: { name: 'cash-outline', color: '#2563EB' },
  AdvanceStatus: { name: 'time-outline', color: '#D97706' },
  AdvanceHistory: { name: 'receipt-outline', color: '#059669' },
  AdvanceApprovals: { name: 'checkmark-done-outline', color: '#7C3AED' },
  LeadsList: { name: 'list-outline', color: '#2563EB' },
  LeadAdd: { name: 'person-add-outline', color: '#16A34A' },
  LeadAddNewSchool: { name: 'school-outline', color: '#2563EB' },
  LeadAddRenewal: { name: 'refresh-outline', color: '#059669' },
  LeadFollowup: { name: 'call-outline', color: '#EA580C' },
  LeadsRenewalList: { name: 'repeat-outline', color: '#7C3AED' },
  DCCreate: { name: 'add-circle-outline', color: '#16A34A' },
  DCCreateSale: { name: 'add-circle-outline', color: '#16A34A' },
  DCClosed: { name: 'checkmark-done-outline', color: '#059669' },
  DCSaved: { name: 'bookmark-outline', color: '#6366F1' },
  DCPending: { name: 'time-outline', color: '#D97706' },
  DCEmp: { name: 'person-outline', color: '#0D9488' },
  DCTermWise: { name: 'document-text-outline', color: '#4F46E5' },
  DCAdmin: { name: 'shield-outline', color: '#DC2626' },
  DCCompleted: { name: 'checkbox-outline', color: '#16A34A' },
  EmployeeNew: { name: 'person-add-outline', color: '#16A34A' },
  EmployeesActive: { name: 'people-outline', color: '#2563EB' },
  EmployeesInactive: { name: 'person-remove-outline', color: '#6B7280' },
  EmployeesLeaves: { name: 'calendar-outline', color: '#7C3AED' },
  EmployeesZones: { name: 'map-outline', color: '#0D9488' },
  EmployeesClusters: { name: 'git-network-outline', color: '#4F46E5' },
  ExecutiveManagers: { name: 'ribbon-outline', color: '#6366F1' },
  ExecutiveManagerNew: { name: 'add-outline', color: '#16A34A' },
  LeavesPending: { name: 'hourglass-outline', color: '#D97706' },
  LeavesReport: { name: 'stats-chart-outline', color: '#2563EB' },
  LeaveRequest: { name: 'paper-plane-outline', color: '#16A34A' },
  LeavesApproved: { name: 'calendar-clear-outline', color: '#059669' },
  TrainingDashboard: { name: 'analytics-outline', color: '#7C3AED' },
  TrainingAssign: { name: 'clipboard-outline', color: '#2563EB' },
  TrainingList: { name: 'library-outline', color: '#0D9488' },
  ServicesList: { name: 'construct-outline', color: '#EA580C' },
  TrainersNew: { name: 'add-circle-outline', color: '#16A34A' },
  TrainersActive: { name: 'checkmark-circle-outline', color: '#059669' },
  TrainersInactive: { name: 'close-circle-outline', color: '#6B7280' },
  WarehouseInventoryItems: { name: 'layers-outline', color: '#4F46E5' },
  WarehouseStock: { name: 'cube-outline', color: '#0D9488' },
  WarehouseDCAtWarehouse: { name: 'home-outline', color: '#2563EB' },
  WarehouseCompletedDC: { name: 'checkmark-done-outline', color: '#16A34A' },
  WarehouseHoldDC: { name: 'pause-circle-outline', color: '#D97706' },
  WarehouseDCListed: { name: 'list-circle-outline', color: '#6366F1' },
  WarehouseSearchDC: { name: 'search-outline', color: '#0284C7' },
  ReturnsEmployee: { name: 'arrow-undo-outline', color: '#EA580C' },
  ReturnsExecutive: { name: 'clipboard-outline', color: '#C2410C' },
  ReturnsWarehouse: { name: 'storefront-outline', color: '#7C3AED' },
  ReturnsWarehouseExecutive: { name: 'cube-outline', color: '#2563EB' },
  ReturnsWarehouseManager: { name: 'checkmark-done-outline', color: '#16A34A' },
  PaymentList: { name: 'card-outline', color: '#2563EB' },
  PaymentAdd: { name: 'add-outline', color: '#16A34A' },
  PaymentDone: { name: 'checkmark-outline', color: '#059669' },
  PaymentTransactionReport: { name: 'receipt-outline', color: '#4F46E5' },
  PaymentApprovalPendingCash: { name: 'cash-outline', color: '#16A34A' },
  PaymentApprovalPendingCheques: { name: 'document-outline', color: '#0D9488' },
  ExpensePending: { name: 'time-outline', color: '#D97706' },
  ExpenseFinancePending: { name: 'wallet-outline', color: '#7C3AED' },
  ExpenseCreate: { name: 'create-outline', color: '#16A34A' },
  ExpenseMy: { name: 'folder-open-outline', color: '#2563EB' },
  ReportsLeads: { name: 'bar-chart-outline', color: '#2563EB' },
  ReportsSalesVisit: { name: 'car-outline', color: '#EA580C' },
  ReportsEmployeeTrack: { name: 'navigate-outline', color: '#0D9488' },
  ReportsDC: { name: 'document-attach-outline', color: '#4F46E5' },
  ReportsStock: { name: 'stats-chart-outline', color: '#6366F1' },
  ReportsReturns: { name: 'return-up-back-outline', color: '#DC2626' },
  ReportsExpenses: { name: 'pie-chart-outline', color: '#D97706' },
  ProductsList: { name: 'pricetag-outline', color: '#16A34A' },
  ProductNew: { name: 'add-outline', color: '#16A34A' },
  VendorsList: { name: 'hand-left-outline', color: '#7C3AED' },
  DeliverablesList: { name: 'file-tray-full-outline', color: '#0D9488' },
  SettingsPassword: { name: 'lock-closed-outline', color: '#6B7280' },
  SettingsUpload: { name: 'cloud-upload-outline', color: '#2563EB' },
  SettingsSMS: { name: 'chatbubble-outline', color: '#16A34A' },
  SettingsBackup: { name: 'save-outline', color: '#4F46E5' },
  SettingsExpenses: { name: 'options-outline', color: '#D97706' },
  PartnerStocks: { name: 'stats-chart-outline', color: '#16A34A' },
  PartnerDCs: { name: 'file-tray-outline', color: '#2563EB' },
  DCClient: { name: 'people-circle-outline', color: '#2563EB' },
  SamplesRequest: { name: 'flask-outline', color: '#7C3AED' },
};

export function iconForScreen(screen: string): { name: IonName; color: string } {
  return SCREEN_ICONS[screen] ?? { name: 'chevron-forward-circle-outline', color: '#16A34A' };
}

export function iconForSection(title: string): IonName {
  return SECTION_ICONS[title] ?? 'folder-outline';
}

export const DASHBOARD_STAT_ICONS: {
  key: string;
  label: string;
  ion: IonName;
  color: string;
  bg: string;
}[] = [
  { key: 'activeLeads', label: 'Active Leads', ion: 'flash-outline', color: '#0284C7', bg: '#EFF6FF' },
  { key: 'totalSales', label: 'Total Sales', ion: 'trending-up-outline', color: '#E11D48', bg: '#FFF1F2' },
  { key: 'existingSchools', label: 'Existing Schools', ion: 'school-outline', color: '#EA580C', bg: '#FFF7ED' },
  { key: 'pendingTrainings', label: 'Pending Trainings', ion: 'hourglass-outline', color: '#D97706', bg: '#FFFBEB' },
  { key: 'completedTrainings', label: 'Completed Trainings', ion: 'checkmark-circle-outline', color: '#059669', bg: '#ECFDF5' },
  { key: 'pendingServices', label: 'Pending Services', ion: 'construct-outline', color: '#CA8A04', bg: '#FEFCE8' },
  { key: 'completedServices', label: 'Completed Services', ion: 'checkmark-done-outline', color: '#0D9488', bg: '#F0FDFA' },
];
