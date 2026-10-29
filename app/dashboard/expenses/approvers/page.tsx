'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Trash2, UserCheck } from 'lucide-react'

type Scope = 'employee' | 'cluster' | 'zone' | 'all'

type User = {
  _id: string
  name: string
  empCode?: string
  role?: string
  zone?: string
  cluster?: string
  executiveManagerId?: string | { _id?: string } | null
}

type Zone = { _id: string; name: string }
type Cluster = { _id: string; name: string; zoneId?: { _id: string; name: string } | null }

type ApproverTag = {
  _id: string
  scope: Scope
  employeeId?: User | null
  cluster?: string
  zone?: string
  approverId?: User | null
  createdBy?: { name: string } | null
  createdAt: string
}

const SCOPE_LABELS: Record<Scope, string> = {
  employee: 'Single / selected employees',
  cluster: 'All employees in a cluster',
  zone: 'All employees in a zone',
  all: 'All employees',
}

const personLabel = (u?: User | null) =>
  u ? `${u.name}${u.empCode ? ` (${u.empCode})` : ''}${u.role ? ` · ${u.role}` : ''}` : 'Unknown'

const targetLabel = (tag: ApproverTag) => {
  switch (tag.scope) {
    case 'employee':
      return personLabel(tag.employeeId)
    case 'cluster':
      return `Cluster: ${tag.cluster}`
    case 'zone':
      return `Zone: ${tag.zone}`
    default:
      return 'All employees'
  }
}

export default function ExpenseApproversPage() {
  const [tags, setTags] = useState<ApproverTag[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [scope, setScope] = useState<Scope>('employee')
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [zone, setZone] = useState('')
  const [cluster, setCluster] = useState('')
  const [approverId, setApproverId] = useState('')

  const loadTags = async () => {
    try {
      setTags((await apiRequest<ApproverTag[]>('/expenses/approver-tags')) || [])
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load approver tags')
    }
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [userData, zoneData, clusterData] = await Promise.all([
        apiRequest<User[]>('/employees?isActive=true').catch(() => []),
        apiRequest<Zone[]>('/zones').catch(() => []),
        apiRequest<Cluster[]>('/clusters').catch(() => []),
        loadTags(),
      ])
      setUsers((userData || []).slice().sort((a, b) => a.name.localeCompare(b.name)))
      setZones(zoneData || [])
      setClusters(clusterData || [])
      setLoading(false)
    })()
  }, [])

  // A Zonal Manager assigns approvers only for the BDEs in their own team.
  const currentUser = getCurrentUser()
  const isZonalManager = currentUser?.role === 'Executive Manager'
  const assignableEmployees = useMemo(() => {
    if (!isZonalManager) return users
    const me = String(currentUser?._id || '')
    return users.filter((u) => {
      const zm = u.executiveManagerId
      return String(typeof zm === 'object' && zm ? zm._id : zm || '') === me
    })
  }, [users, isZonalManager, currentUser?._id])

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return assignableEmployees
    return assignableEmployees.filter((u) =>
      [u.name, u.empCode, u.role, u.zone, u.cluster].some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [assignableEmployees, employeeSearch])

  const toggleEmployee = (id: string) => {
    setEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const resetForm = () => {
    setEmployeeIds([])
    setEmployeeSearch('')
    setZone('')
    setCluster('')
    setApproverId('')
  }

  const handleSave = async () => {
    if (!approverId) return toast.error('Select the approver')
    if (scope === 'employee' && employeeIds.length === 0) return toast.error('Select at least one employee')
    if (scope === 'cluster' && !cluster) return toast.error('Select the cluster')
    if (scope === 'zone' && !zone) return toast.error('Select the zone')

    setSaving(true)
    try {
      await apiRequest('/expenses/approver-tags', {
        method: 'POST',
        body: JSON.stringify({ scope, approverId, employeeIds, cluster, zone }),
      })
      toast.success('Expense approver assigned')
      resetForm()
      loadTags()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to assign approver')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (tag: ApproverTag) => {
    if (!window.confirm(`Remove ${tag.approverId?.name || 'this approver'} for ${targetLabel(tag)}?`)) return
    try {
      await apiRequest(`/expenses/approver-tags/${tag._id}`, { method: 'DELETE' })
      toast.success('Approver tag removed')
      loadTags()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove tag')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Expense Approvers</h1>
        <p className="text-sm text-neutral-500 mt-1">
          By default, BDE expenses go to their Zonal Manager and everyone else&apos;s go to Admin for first-level approval,
          then to the Finance Manager for final approval. Tag any user to take over first-level approval for an employee,
          a cluster, a zone, or everyone. The most specific tag wins (employee, then cluster, then zone, then all
          employees); within the same level the newest tag wins. Tagged users see the Pending Expenses List after they
          next sign in.
        </p>
      </div>

      <Card className="p-4 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Route expenses of</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(isZonalManager ? (['employee'] as Scope[]) : (Object.keys(SCOPE_LABELS) as Scope[])).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>To approver</Label>
            <Select value={approverId} onValueChange={setApproverId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={loading ? 'Loading users...' : 'Select any user'} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {personLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {scope === 'cluster' && (
          <div className="space-y-1.5 md:w-1/2">
            <Label>Cluster</Label>
            <Select value={cluster} onValueChange={setCluster}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select cluster" />
              </SelectTrigger>
              <SelectContent>
                {clusters.map((c) => (
                  <SelectItem key={c._id} value={c.name}>
                    {c.name}{c.zoneId?.name ? ` (${c.zoneId.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {scope === 'zone' && (
          <div className="space-y-1.5 md:w-1/2">
            <Label>Zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z._id} value={z.name}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {scope === 'employee' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Employees ({employeeIds.length} selected)</Label>
              {employeeIds.length > 0 && (
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setEmployeeIds([])}>
                  Clear selection
                </button>
              )}
            </div>
            <Input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search by name, code, role, zone or cluster"
              className="bg-white"
            />
            <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-200 divide-y divide-neutral-100">
              {filteredEmployees.length === 0 ? (
                <p className="p-3 text-sm text-neutral-500">{loading ? 'Loading...' : 'No matching employees'}</p>
              ) : (
                filteredEmployees.map((u) => (
                  <label key={u._id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={employeeIds.includes(u._id)}
                      onChange={() => toggleEmployee(u._id)}
                      disabled={u._id === approverId}
                    />
                    <span className="flex-1">{personLabel(u)}</span>
                    {(u.zone || u.cluster) && (
                      <span className="text-xs text-neutral-500">{[u.cluster, u.zone].filter(Boolean).join(' · ')}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
            <UserCheck className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Assign approver'}
          </Button>
        </div>
      </Card>

      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">Applies to</TableHead>
                <TableHead className="font-semibold">First-level approver</TableHead>
                <TableHead className="font-semibold">Assigned by</TableHead>
                <TableHead className="font-semibold">Assigned on</TableHead>
                <TableHead className="font-semibold"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                    {loading ? 'Loading...' : 'No approver tags. Default routing applies to everyone.'}
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow key={tag._id}>
                    <TableCell className="font-medium">{targetLabel(tag)}</TableCell>
                    <TableCell>{personLabel(tag.approverId)}</TableCell>
                    <TableCell>{tag.createdBy?.name || '-'}</TableCell>
                    <TableCell>{new Date(tag.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleRemove(tag)}
                        className="text-red-600 hover:text-red-700"
                        aria-label={`Remove approver tag for ${targetLabel(tag)}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
