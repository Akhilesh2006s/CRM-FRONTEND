'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { toast } from 'sonner'

type RequestRow = {
  _id: string
  name?: string
  email?: string
  role?: string
  mobile?: string
  createdAt?: string
}

export default function EmployeeRequestsPage() {
  const { user } = usePermissions()
  const canDecide = user?.role === 'HR Manager' || user?.role === 'Super Admin' || user?.role === 'Admin' || Boolean(user?.isSuperAdmin)
  const [rows, setRows] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<RequestRow[]>('/employees?hrQueue=pending')
      setRows(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setRows([])
      toast.error(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    const note = decision === 'reject' ? window.prompt('Rejection note') || '' : ''
    if (decision === 'reject' && !note.trim()) {
      toast.error('A rejection note is required')
      return
    }
    setActing(id)
    try {
      await apiRequest(`/hr/employees/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      })
      toast.success(decision === 'approve' ? 'Employee added to the HR module' : 'Request rejected')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setActing('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Employee Requests</h1>
        <p className="text-sm text-neutral-600 mt-1">
          HR Executive additions stay here until the HR Manager approves them. Super Admin can also approve.
        </p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-4 text-sm text-neutral-600">No employee requests waiting.</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Name</th>
                <th className="py-2 px-3 text-left">Email</th>
                <th className="py-2 px-3 text-left">Role</th>
                <th className="py-2 px-3 text-left">Mobile</th>
                {canDecide && <th className="py-2 px-3 text-left">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="py-2 px-3">{row.name || '—'}</td>
                  <td className="py-2 px-3">{row.email || '—'}</td>
                  <td className="py-2 px-3">{row.role || '—'}</td>
                  <td className="py-2 px-3">{row.mobile || '—'}</td>
                  {canDecide && (
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        <Button size="sm" disabled={acting === row._id} onClick={() => void decide(row._id, 'approve')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={acting === row._id} onClick={() => void decide(row._id, 'reject')}>
                          Reject
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
