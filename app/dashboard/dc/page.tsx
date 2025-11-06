'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Stats = { total: number; byStatus: { Pending: number; Processing: number; Saved: number; Closed: number } }

export default function DCPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Stats>('/dc/stats/employee')
        setStats(data)
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Deal Conversion</h1>
        <Link href="/dashboard/dc/create"><Button>Create Sale</Button></Link>
      </div>
      <Card className="p-4">
        {loading && 'Loading...'}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Link href="/dashboard/dc/pending"><Card className="p-3 cursor-pointer"><div className="text-xs text-neutral-600">Processing</div><div className="text-xl font-semibold">{stats.byStatus.Processing}</div></Card></Link>
            <Link href="/dashboard/dc/saved"><Card className="p-3 cursor-pointer"><div className="text-xs text-neutral-600">Saved</div><div className="text-xl font-semibold">{stats.byStatus.Saved}</div></Card></Link>
            <Link href="/dashboard/dc/closed"><Card className="p-3 cursor-pointer"><div className="text-xs text-neutral-600">Closed</div><div className="text-xl font-semibold">{stats.byStatus.Closed}</div></Card></Link>
            <Card className="p-3"><div className="text-xs text-neutral-600">Pending</div><div className="text-xl font-semibold">{stats.byStatus.Pending}</div></Card>
            <Card className="p-3"><div className="text-xs text-neutral-600">Total</div><div className="text-xl font-semibold">{stats.total}</div></Card>
          </div>
        )}
      </Card>
    </div>
  )
}


