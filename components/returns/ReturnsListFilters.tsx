'use client'

import { FormEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  EMPTY_RETURNS_FILTERS,
  type ReturnsListFilterState,
} from '@/lib/returnsListFilter'

type Props = {
  filters: ReturnsListFilterState
  onChange: (next: ReturnsListFilterState) => void
  onSearch?: () => void
  statuses: string[]
  finYears: string[]
  executives?: string[]
  showExecutive?: boolean
}

export function ReturnsListFilters({
  filters,
  onChange,
  onSearch,
  statuses,
  finYears,
  executives = [],
  showExecutive = true,
}: Props) {
  const set = (patch: Partial<ReturnsListFilterState>) => onChange({ ...filters, ...patch })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSearch?.()
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger className="bg-white text-neutral-900">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.finYear} onValueChange={(v) => set({ finYear: v })}>
          <SelectTrigger className="bg-white text-neutral-900">
            <SelectValue placeholder="All Fin Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fin Years</SelectItem>
            {finYears.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showExecutive && (
          <Select value={filters.executive} onValueChange={(v) => set({ executive: v })}>
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {executives.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          className="bg-white text-neutral-900"
          placeholder="By School Name"
          value={filters.schoolName}
          onChange={(e) => set({ schoolName: e.target.value })}
        />
        <Input
          className="bg-white text-neutral-900"
          placeholder="By School Code"
          value={filters.schoolCode}
          onChange={(e) => set({ schoolCode: e.target.value })}
        />
        <Input
          className="bg-white text-neutral-900"
          placeholder="Search LR No, Return #, remarks..."
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />

        <div>
          <Label htmlFor="returns-from-date" className="text-xs text-neutral-600">
            From Date
          </Label>
          <Input
            id="returns-from-date"
            className="bg-white text-neutral-900 mt-1"
            type="date"
            value={filters.fromDate}
            onChange={(e) => set({ fromDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="returns-to-date" className="text-xs text-neutral-600">
            To Date
          </Label>
          <Input
            id="returns-to-date"
            className="bg-white text-neutral-900 mt-1"
            type="date"
            value={filters.toDate}
            onChange={(e) => set({ toDate: e.target.value })}
          />
        </div>

        <div className="col-span-2 md:col-span-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={() => onChange({ ...EMPTY_RETURNS_FILTERS })}>
            Clear
          </Button>
        </div>
      </form>
    </Card>
  )
}
