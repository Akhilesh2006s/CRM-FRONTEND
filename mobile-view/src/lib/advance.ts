export type AdvancePerson = { _id: string; name: string; empCode?: string; role?: string }
export type AdvanceApproval = {
  stage: 'zonal_manager' | 'product_head' | 'admin' | 'tagged' | 'finance' | 'super_admin'
  approverId?: AdvancePerson
  status: 'Pending' | 'Approved' | 'Rejected'
  decidedBy?: AdvancePerson
  decidedAt?: string
  remarks?: string
  /** Amount this step approved. */
  amount?: number
}
export type Advance = {
  _id: string
  __v: number
  employeeId: AdvancePerson
  advanceType: 'Employee Request' | 'Special Advance (Incentives)'
  /** Amount the employee requested. */
  amount: number
  /** Amount as last set by an approver; absent until the first approval. */
  approvedAmount?: number
  reason: string
  scheduleDetails: string
  date: string
  remark: string
  status: 'Pending' | 'Approved' | 'Rejected'
  approvals: AdvanceApproval[]
  pendingWith: string[]
  canDecide: boolean
  /** The viewer's approval step may change the amount (remark required if changed). */
  canEditAmount?: boolean
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
/** The amount as it stands: the last approver's amount, else the requested one. */
export const advanceCurrentAmount = (advance: Pick<Advance, 'amount' | 'approvedAmount'>) => advance.approvedAmount ?? advance.amount
/** "₹5,000.00" or, when an approver changed it, "₹5,000.00 → ₹4,000.00". */
export function advanceAmountLabel(advance: Pick<Advance, 'amount' | 'approvedAmount'>): string {
  const current = advanceCurrentAmount(advance)
  return Math.abs(current - advance.amount) > 0.001 ? `${advanceMoney(advance.amount)} → ${advanceMoney(current)}` : advanceMoney(advance.amount)
}
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
