export type AdvancePerson = { _id: string; name: string; empCode?: string; role?: string }
export type AdvanceApproval = {
  stage: 'zonal_manager' | 'product_head' | 'admin' | 'tagged' | 'finance' | 'super_admin'
  approverId?: AdvancePerson
  status: 'Pending' | 'Approved' | 'Rejected'
  decidedBy?: AdvancePerson
  decidedAt?: string
  remarks?: string
}
export type Advance = {
  _id: string
  __v: number
  employeeId: AdvancePerson
  advanceType: 'Employee Request' | 'Special Advance (Incentives)'
  amount: number
  reason: string
  scheduleDetails: string
  date: string
  remark: string
  status: 'Pending' | 'Approved' | 'Rejected'
  approvals: AdvanceApproval[]
  pendingWith: string[]
  canDecide: boolean
  canTagApprovers: boolean
  createdAt: string
}
export type AdvanceHistory = {
  employeeId: string
  totalAdvance: number
  totalApprovedExpenses: number
  remainingBalance: number
  totalIncentives: number
  requests: Advance[]
  ledger: { id: string; recordId: string; kind: 'advance' | 'incentive' | 'expense'; date: string; description: string; amount: number; balance: number }[]
}
export const advanceMoney = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
export const advanceDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
export function advanceApprovalLabel(approval: AdvanceApproval): string {
  const label = { zonal_manager: 'Zonal Manager', product_head: 'Product Head', admin: 'Admin', finance: 'Finance Manager', super_admin: 'Super Admin', tagged: approval.approverId?.name || 'Tagged employee' }[approval.stage]
  return ['zonal_manager', 'product_head'].includes(approval.stage) && approval.approverId?.name ? `${label} (${approval.approverId.name})` : label
}
export function advanceRequestApprovalDescription(role?: string): string {
  if (['Executive', 'Sales BDE', 'Employee', 'BDE'].includes(role || '')) return 'Requires approval from your assigned Zonal Manager, followed by the Finance Manager.'
  if (role === 'Trainer') return 'Requires approval from your assigned Product Head, followed by the Finance Manager.'
  return 'Requires Admin approval, approval from any employees tagged by Admin, and final Finance Manager approval.'
}
