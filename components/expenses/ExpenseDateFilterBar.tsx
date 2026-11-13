'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MONTH_OPTIONS, EMPTY_EXPENSE_FILTER, type ExpenseDateFilter } from '@/lib/expenseDateFilter'

const selectClass = 'h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm'

/** Search + Date + Month + Year, shown above every Expense list. */
export function ExpenseDateFilterBar({
  value,
  onChange,
  years,
  shown,
  total,
}: {
  value: ExpenseDateFilter
  onChange: (next: ExpenseDateFilter) => void
  years: string[]
  shown?: number
  total?: number
}) {
  const set = (patch: Partial<ExpenseDateFilter>) => onChange({ ...value, ...patch })
  const active = value.search || value.date || value.month || value.year
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-xs font-medium text-neutral-600">Search</label>
        <Input
          className="h-9"
          placeholder="Employee, code, type, description…"
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Date</label>
        <Input className="h-9" type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Month</label>
        <select className={selectClass} value={value.month} onChange={(e) => set({ month: e.target.value })}>
          <option value="">All months</option>
          {MONTH_OPTIONS.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Year</label>
        <select className={selectClass} value={value.year} onChange={(e) => set({ year: e.target.value })}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {active ? (
        <Button type="button" variant="outline" className="h-9" onClick={() => onChange(EMPTY_EXPENSE_FILTER)}>
          Clear
        </Button>
      ) : null}
      {active && total != null ? (
        <span className="pb-2 text-xs text-neutral-500">Showing {shown ?? 0} of {total}</span>
      ) : null}
    </div>
  )
}
