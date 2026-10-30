/**
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
  /** Bank transfer status, set by the Finance Executive after Finance approval */
  payout?: { status?: string; remark?: string; updatedAt?: string | null; bankSheetAt?: string | null } | null
}

export const CREDITED_TO_BANK = 'Amount Credited to Bank'

const indianDate = (value?: string | null) => {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

/**
 * Done from the employee's side: rejected, or approved by Finance and credited to their bank.
 * Finance-approved expenses not yet credited are still pending for the employee.
 */
export function isExpenseCompleted(expense: ApprovalExpense): boolean {
  if (expense.status === 'Rejected') return true
  return expense.status === 'Approved' && expense.payout?.status === CREDITED_TO_BANK
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
      return by ? `Approved by ${by}, Pending at Finance Manager` : 'Pending at Finance Manager'
    }
    case 'Approved': {
      const payout = expense.payout || {}
      if (payout.status === CREDITED_TO_BANK) {
        const on = indianDate(payout.updatedAt)
        return `Amount Credited to Bank${on ? ` on ${on}` : ''}`
      }
      if (payout.status === 'Not Credited') {
        return `Approved by Finance Manager, not credited to bank${payout.remark ? `: ${payout.remark}` : ''}`
      }
      return 'Approved by Finance Manager, Pending bank credit'
    }
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

export function expenseStatusColor(status: string): string {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-700'
    case 'Executive Manager Approved':
    case 'Manager Approved':
      return 'bg-purple-100 text-purple-700'
    case 'Pending':
      return 'bg-amber-100 text-amber-700'
    case 'Rejected':
      return 'bg-red-100 text-red-700'
    case 'Needs Correction':
      return 'bg-orange-100 text-orange-700'
    default:
      return 'bg-gray-100 text-gray-700'
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
  if (expense.status === 'Approved' && expense.payout?.status === CREDITED_TO_BANK) {
    entries.push({ step: 'Amount Credited to Bank', at: expense.payout.updatedAt || undefined, amount: expense.approvedAmount })
  } else if (expense.status === 'Approved' && expense.payout?.status === 'Not Credited') {
    entries.push({ step: 'Not credited to bank', at: expense.payout.updatedAt || undefined, remarks: expense.payout.remark })
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
