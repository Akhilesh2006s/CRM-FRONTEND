'use client'

import { usePathname } from 'next/navigation'
import { ModulePageShell, type BreadcrumbSegment } from '@/components/dashboard/ModulePageShell'

const EXPENSE_LABELS: Record<string, string> = {
  pending: 'Pending Expenses List',
  'finance-pending': 'Finance Pending Expenses',
  'executive-manager-pending': 'Executive Manager Pending',
}

function getExpensePageLabel(pathname: string): string {
  if (pathname.includes('/manager-update/')) return 'Manager Expense Update'
  if (pathname.includes('/edit/')) return 'Edit Expense'
  const segment = pathname.split('/').filter(Boolean).pop() || ''
  return EXPENSE_LABELS[segment] || 'Expenses'
}

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageLabel = getExpensePageLabel(pathname)

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Expenses', href: '/dashboard/expenses/pending' },
    { label: pageLabel },
  ]

  return (
    <ModulePageShell title={pageLabel} breadcrumbs={breadcrumbs}>
      {children}
    </ModulePageShell>
  )
}
