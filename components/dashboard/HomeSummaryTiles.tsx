'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'

/**
 * Home figures for the login's department (GET /dashboard/my-summary), the same tiles the app
 * shows on Home: trainings and services for Trainers, sales for BDEs, team sales for managers.
 */
type Tile = { label: string; value: number; money?: boolean }
type Summary = { kind?: string; title?: string; tiles?: Tile[] }

const COLORS = ['text-teal-600', 'text-blue-600', 'text-orange-600', 'text-violet-600', 'text-green-600', 'text-amber-600', 'text-cyan-600', 'text-red-600']
const rupees = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export function HomeSummaryTiles() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    apiRequest<Summary>('/dashboard/my-summary')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'))
  }, [])
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">{data?.title || 'My Summary'}</h2>
      {!data && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {error && !data ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.tiles || []).map((t, i) => (
          <div key={t.label} className="rounded-xl bg-slate-50 p-4">
            <div className={`text-2xl font-extrabold ${COLORS[i % COLORS.length]}`}>{t.money ? rupees(t.value) : t.value ?? 0}</div>
            <div className="mt-1 text-sm text-neutral-600">{t.label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
