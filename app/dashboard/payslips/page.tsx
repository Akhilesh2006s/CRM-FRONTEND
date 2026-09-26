'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Slip = {
  month: string
  yearlySalary: number
  monthlyTakeHome: number
  name?: string
}

export default function MyPaySlipsPage() {
  const [rows, setRows] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)
  const userId = getCurrentUser()?._id || ''

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Slip[]>('/hr/payslips/mine')
        setRows(Array.isArray(data) ? data : [])
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load pay slips')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const download = async (month: string) => {
    const file = await apiRequest<{ filename: string; html: string }>(`/hr/payslips/${userId}/${month}/download`)
    const blob = new Blob([file.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Pay Slips</h1>
        <p className="text-sm text-neutral-600 mt-1">Download the pay slips generated for your login.</p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-4 text-sm text-neutral-600">No pay slips yet.</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Month</th>
                <th className="py-2 px-3 text-left">Yearly salary</th>
                <th className="py-2 px-3 text-left">Monthly take-home</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className="border-t">
                  <td className="py-2 px-3">{row.month}</td>
                  <td className="py-2 px-3">{row.yearlySalary}</td>
                  <td className="py-2 px-3">{row.monthlyTakeHome}</td>
                  <td className="py-2 px-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => void download(row.month).catch((err) => toast.error(err.message))}>
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
