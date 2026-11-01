'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Row = {
  _id: string
  name: string
  empCode?: string
  role: string
  zone?: string
  approver: { _id: string; name: string; role?: string } | null
  defaultApprover: string
}

const DEFAULT = '__default__'

/**
 * Who approves each employee's field visit requests and office / field check-out reviews.
 * Left on default: the BDE's Zonal Manager or the trainer's Product Manager, otherwise Admin / Super Admin.
 */
export default function FieldApproversPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState('')

  useEffect(() => {
    apiRequest<Row[]>('/field-day/approvers')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not load approvers'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (row: Row, approverId: string) => {
    setSaving(row._id)
    try {
      const res = await apiRequest<{ attendanceApproverId: { _id: string; name: string; role?: string } | null }>(
        `/field-day/approvers/${row._id}`,
        { method: 'PUT', body: JSON.stringify({ approverId: approverId === DEFAULT ? null : approverId }) }
      )
      setRows((list) => list.map((r) => (r._id === row._id ? { ...r, approver: res?.attendanceApproverId || null } : r)))
      toast.success(`Approver saved for ${row.name}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving('')
    }
  }

  const people = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows])
  const q = search.trim().toLowerCase()
  const shown = rows.filter((r) => !q || [r.name, r.empCode, r.role, r.zone].some((v) => String(v || '').toLowerCase().includes(q)))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Field Approvers</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Choose who approves each employee&apos;s field visit requests and office / field check-out reviews. Admin and Super
          Admin can always approve. To give someone access to Field Tracking, use Settings → Roles &amp; Permissions.
        </p>
      </div>
      <Input className="max-w-sm bg-white" placeholder="Search name, Emp ID, role or zone" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 text-left">
                <th className="py-2 px-3">Employee</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Approver</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 px-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">{[r.empCode, r.zone].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="py-2 px-3">{r.role}</td>
                  <td className="py-2 px-3">
                    <select
                      aria-label={`Approver for ${r.name}`}
                      className="h-9 w-full max-w-xs rounded-md border bg-white px-2"
                      value={r.approver?._id || DEFAULT}
                      disabled={saving === r._id}
                      onChange={(e) => save(r, e.target.value)}
                    >
                      <option value={DEFAULT}>Default ({r.defaultApprover})</option>
                      {people
                        .filter((p) => p._id !== r._id)
                        .map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} · {p.role}
                          </option>
                        ))}
                    </select>
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
