'use client'

import { useEffect, useState } from 'react'
import { Cake } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { displayRoleName } from '@/lib/roleLabels'
import { formatEmployeeCode } from '@/lib/employeeCode'

type BirthdayRow = {
  _id: string
  name: string
  empCode?: string
  role?: string
  department?: string
  daysUntil: number
  birthday: string
  turningAge?: number | null
}
type BirthdaysResponse = { date: string; days: number; today: BirthdayRow[]; upcoming: BirthdayRow[] }

function whenText(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function Row({ row }: { row: BirthdayRow }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-neutral-900">{row.name}</div>
        <div className="truncate text-xs text-neutral-500">
          {[formatEmployeeCode(row.empCode, ''), displayRoleName(row.role), row.department].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-neutral-600">
        <div className="font-medium">{row.birthday}</div>
        <div>{row.daysUntil === 0 && row.turningAge ? `Turns ${row.turningAge}` : whenText(row.daysUntil)}</div>
      </div>
    </li>
  )
}

/** HR dashboard: employees whose birthday is today (India date) and in the next week. */
export function BirthdaysCard({ days = 7 }: { days?: number }) {
  const [data, setData] = useState<BirthdaysResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiRequest<BirthdaysResponse>(`/employees/birthdays?days=${days}`)
      .then(setData)
      .catch((e: any) => setError(e?.message || 'Could not load birthdays'))
  }, [days])

  return (
    <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <Cake className="h-5 w-5 text-pink-600" />
        <div className="text-xs font-semibold uppercase text-pink-700">Birthdays</div>
      </div>
      {error ? (
        <p className="text-sm text-neutral-500">{error}</p>
      ) : !data ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Today 🎂</div>
            {data.today.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No birthdays today.</p>
            ) : (
              <ul className="divide-y divide-pink-100">
                {data.today.map((row) => <Row key={row._id} row={row} />)}
              </ul>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900">Next {data.days} days</div>
            {data.upcoming.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No upcoming birthdays.</p>
            ) : (
              <ul className="divide-y divide-pink-100">
                {data.upcoming.map((row) => <Row key={row._id} row={row} />)}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
