/** Roles that can submit reimbursement expenses. */
export const EXPENSE_SUBMIT_ROLES = [
  'Executive',
  'Sales BDE',
  'Employee',
  'Trainer',
  'Manager',
] as const

export const EXPENSE_EXECUTIVE_MANAGER_ROLES = ['Executive Manager'] as const

export const EXPENSE_MANAGER_APPROVE_ROLES = [
  'Manager',
  'Admin',
  'Super Admin',
] as const

export const EXPENSE_FINANCE_ROLES = ['Admin', 'Super Admin', 'Finance'] as const

const includesRole = (roles: readonly string[], role: string | undefined) =>
  !!role && roles.includes(role)

export function canSubmitExpense(role: string | undefined): boolean {
  return includesRole(EXPENSE_SUBMIT_ROLES, role)
}

export function canExecutiveManagerApproveExpenses(role: string | undefined): boolean {
  return includesRole(EXPENSE_EXECUTIVE_MANAGER_ROLES, role)
}

export function canManagerApproveExpenses(role: string | undefined): boolean {
  return includesRole(EXPENSE_MANAGER_APPROVE_ROLES, role)
}

export function canFinanceApproveExpenses(role: string | undefined): boolean {
  return includesRole(EXPENSE_FINANCE_ROLES, role)
}

export function showFinancePendingNav(
  role: string | undefined,
  skipFinanceStage: boolean
): boolean {
  if (skipFinanceStage) return false
  return canFinanceApproveExpenses(role) || includesRole(['Manager', 'Admin', 'Super Admin'], role)
}

export type ExpenseStatus =
  | 'Pending'
  | 'Executive Manager Approved'
  | 'Manager Approved'
  | 'Approved'
  | 'Rejected'
  | 'Needs Correction'

export function expenseStatusLabel(status: string): string {
  switch (status) {
    case 'Pending':
      return 'Pending (Executive Manager)'
    case 'Executive Manager Approved':
      return 'Pending (Manager)'
    case 'Needs Correction':
      return 'Needs correction'
    case 'Approved':
      return 'Approved'
    case 'Rejected':
      return 'Rejected'
    default:
      return status
  }
}
