/**
 * Ported from web lib/expenseApproval.ts.
 * Two-stage expense approval, mirroring backend/utils/expenseApproval.js:
 *   first level – 'Pending': Zonal Manager (BDEs), Admin (everyone else), or an Admin-tagged approver
 *   finance     – 'Executive Manager Approved' / legacy 'Manager Approved': Finance Manager
 */

export type ExpensePerson = {
  _id: string
  name: string
  email?: string
  empCode?: string
  role?: string
}

export type FirstLevelApprover = {
  kind: 'tag' | 'zonal' | 'admin'
  _id?: string | null
  name?: string | null
  role?: string | null
  scope?: 'employee' | 'cluster' | 'zone' | 'all' | null
}

export type ApprovalExpense = {
  status: string
  createdAt?: string
  employeeAmount?: number
  amount?: number
  employeeRemarks?: string
  managerRemarks?: string
  financeRemarks?: string
  rejectionReason?: string
  firstLevelApprovedAmount?: number
  approvedAmount?: number
  approvalStage?: 'first' | 'finance' | null
  firstLevelApprover?: FirstLevelApprover | null
  createdBy?: ExpensePerson | null
  executiveManagerApprovedBy?: ExpensePerson | null
  executiveManagerApprovedAt?: string
  managerApprovedBy?: ExpensePerson | null
  managerApprovedAt?: string
  approvedBy?: ExpensePerson | null
  approvedAt?: string
  returnedBy?: ExpensePerson | null
  returnedAt?: string
  rejectedBy?: ExpensePerson | null
  rejectedAt?: string
  rejectedStage?: 'first' | 'finance'
}

export const FINANCE_STAGE_STATUSES = ['Executive Manager Approved', 'Manager Approved']

export function expenseStage(expense: ApprovalExpense): 'first' | 'finance' | null {
  if (expense.approvalStage !== undefined) return expense.approvalStage
  if (expense.status === 'Pending') return 'first'
  if (FINANCE_STAGE_STATUSES.includes(expense.status)) return 'finance'
  return null
}

export function firstLevelApproverLabel(approver?: FirstLevelApprover | null): string {
  if (!approver) return 'first-level approver'
  if (approver.kind === 'admin') return 'Admin'
  const who = approver.name || (approver.kind === 'zonal' ? 'Zonal Manager' : 'assigned approver')
  return approver.kind === 'zonal' ? `${who} (Zonal Manager)` : who
}

/** Name of whoever gave the first-level approval (legacy rows may only have the Product Manager). */
export function firstLevelApprovedBy(expense: ApprovalExpense): ExpensePerson | null {
  return expense.executiveManagerApprovedBy || expense.managerApprovedBy || null
}

/** Amount approved at first level (legacy rows stored it in approvedAmount). */
export function firstLevelAmount(expense: ApprovalExpense): number | undefined {
  if (typeof expense.firstLevelApprovedAmount === 'number') return expense.firstLevelApprovedAmount
  if (expenseStage(expense) === 'finance' && typeof expense.approvedAmount === 'number') return expense.approvedAmount
  return undefined
}

export function expenseStatusText(expense: ApprovalExpense): string {
  switch (expense.status) {
    case 'Pending':
      return `Pending at ${firstLevelApproverLabel(expense.firstLevelApprover)}`
    case 'Executive Manager Approved':
    case 'Manager Approved': {
      const by = firstLevelApprovedBy(expense)?.name
      return `Approved by ${by || 'first-level approver'}, Pending at Finance Manager`
    }
    case 'Approved':
      return expense.approvedBy?.name ? `Approved by Finance (${expense.approvedBy.name})` : 'Approved'
    case 'Rejected': {
      const by = expense.rejectedBy?.name
      const stage = expense.rejectedStage === 'finance' ? 'Finance' : expense.rejectedStage === 'first' ? 'first-level approver' : ''
      return `Rejected${by ? ` by ${by}` : stage ? ` by ${stage}` : ''}`
    }
    case 'Needs Correction':
      return `Sent back for correction${expense.returnedBy?.name ? ` by ${expense.returnedBy.name}` : ''}`
    default:
      return expense.status
  }
}

/** Badge colours for an expense status (React Native equivalent of the web Tailwind classes). */
export function expenseStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'Approved':
      return { bg: '#DCFCE7', text: '#15803D' }
    case 'Executive Manager Approved':
    case 'Manager Approved':
      return { bg: '#F3E8FF', text: '#7E22CE' }
    case 'Pending':
      return { bg: '#FEF3C7', text: '#B45309' }
    case 'Rejected':
      return { bg: '#FEE2E2', text: '#B91C1C' }
    case 'Needs Correction':
      return { bg: '#FFEDD5', text: '#C2410C' }
    default:
      return { bg: '#F3F4F6', text: '#374151' }
  }
}

export type ApprovalHistoryEntry = {
  step: string
  by?: ExpensePerson | null
  at?: string
  amount?: number
  remarks?: string
}

/** Every recorded approval stage, in order. */
export function approvalHistory(expense: ApprovalExpense): ApprovalHistoryEntry[] {
  const entries: ApprovalHistoryEntry[] = [
    {
      step: 'Submitted',
      by: expense.createdBy,
      at: expense.createdAt,
      amount: expense.employeeAmount ?? expense.amount,
      remarks: expense.employeeRemarks,
    },
  ]
  const firstBy = firstLevelApprovedBy(expense)
  if (firstBy || expense.executiveManagerApprovedAt || expense.managerApprovedAt) {
    entries.push({
      step: 'First-level approval',
      by: firstBy,
      at: expense.executiveManagerApprovedAt || expense.managerApprovedAt,
      amount: firstLevelAmount(expense),
      remarks: expense.rejectedStage === 'first' ? undefined : expense.managerRemarks,
    })
  }
  if (expense.returnedBy || expense.returnedAt) {
    entries.push({ step: 'Sent back for correction', by: expense.returnedBy, at: expense.returnedAt, remarks: expense.rejectionReason })
  }
  if (expense.status === 'Approved' && (expense.approvedBy || expense.approvedAt)) {
    entries.push({
      step: 'Final approval (Finance)',
      by: expense.approvedBy,
      at: expense.approvedAt,
      amount: expense.approvedAmount,
      remarks: expense.financeRemarks,
    })
  }
  if (expense.status === 'Rejected') {
    entries.push({
      step: expense.rejectedStage === 'finance' ? 'Rejected by Finance' : 'Rejected at first level',
      by: expense.rejectedBy,
      at: expense.rejectedAt,
      remarks: expense.rejectionReason,
    })
  }
  return entries
}
