'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PjpList } from '@/components/pjp/PjpList'
import type { Pjp } from '@/lib/pjp'

/** My PJP: my weekly / monthly plans with planned vs actual counts. */
export default function MyPjpPage() {
  const [rows, setRows] = useState<Pjp[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    apiRequest<Pjp[]>('/pjp?scope=mine')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your plans'))
  }, [])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My PJP</h1>
          <p className="text-sm text-neutral-600">Plan your school visits for the week or month. Your reporting manager approves the plan.</p>
        </div>
        <Link href="/dashboard/pjp/new">
          <Button>New plan</Button>
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows ? <PjpList rows={rows} /> : !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
    </div>
  )
}
