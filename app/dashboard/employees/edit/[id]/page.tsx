'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import {
  filterTagOptions,
  getTaggingSectionLabel,
  supportsEmployeeTagging,
} from '@/lib/employeeTagging'

type EmployeeOption = { _id: string; name: string; role: string }

export default function EditEmployeePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    phone: '',
    mobile: '',
    address1: '',
    state: '',
    zone: '',
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    taggedEmployeeIds: [] as string[],
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})
  const [tagOptions, setTagOptions] = useState<EmployeeOption[]>([])

  const filteredTagOptions = useMemo(
    () => filterTagOptions(tagOptions, form.role),
    [tagOptions, form.role]
  )

  const loadZones = async () => {
    const [pairsRaw, zonesRaw] = await Promise.all([
      apiRequest<{ zone?: string; cluster?: string }[]>('/zones-clusters').catch(() => []),
      apiRequest<{ name?: string }[]>('/zones').catch(() => []),
    ])
    const pairs = Array.isArray(pairsRaw) ? pairsRaw : []
    const zoneDocs = Array.isArray(zonesRaw) ? zonesRaw : []
    const zoneMap: Record<string, string[]> = {}
    pairs.forEach((zc) => {
      const zone = (zc.zone || '').trim()
      if (!zone) return
      if (!zoneMap[zone]) zoneMap[zone] = []
      const cl = (zc.cluster || '').trim()
      if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl)
    })
    const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean)
    setZones([...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort())
    setClustersByZone(zoneMap)
  }

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        await loadZones()
        const [emp, employees] = await Promise.all([
          apiRequest<any>(`/employees/${id}`),
          apiRequest<EmployeeOption[]>('/employees?isActive=true').catch(() => []),
        ])
        const parts = (emp.name || '').trim().split(/\s+/)
        const firstName = emp.firstName || parts[0] || ''
        const lastName = emp.lastName || parts.slice(1).join(' ') || ''
        setForm({
          firstName,
          lastName,
          empCode: emp.empCode || '',
          email: emp.email || '',
          phone: emp.phone && emp.phone !== '0' ? emp.phone : '',
          mobile: emp.mobile || emp.phone || '',
          address1: emp.address1 || '',
          state: emp.state || '',
          zone: emp.zone || '',
          cluster: emp.cluster || '',
          district: emp.district || '',
          city: emp.city || '',
          pincode: emp.pincode || '',
          role: emp.role || 'Executive',
          taggedEmployeeIds: (emp.taggedEmployeeIds || []).map((x: any) => String(x._id || x)),
        })
        setTagOptions(Array.isArray(employees) ? employees.filter((e) => e._id !== id) : [])
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load employee')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const toggleTagged = (empId: string) => {
    setForm((f) => ({
      ...f,
      taggedEmployeeIds: f.taggedEmployeeIds.includes(empId)
        ? f.taggedEmployeeIds.filter((x) => x !== empId)
        : [...f.taggedEmployeeIds, empId],
    }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (form.role === 'Executive' && !form.cluster?.trim()) {
        setError('Cluster is required for Executive role')
        setSubmitting(false)
        return
      }
      const payload: Record<string, unknown> = {
        ...form,
        name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone || form.mobile,
        mobile: form.mobile,
      }
      if (form.role !== 'Executive') delete payload.cluster
      if (!supportsEmployeeTagging(form.role)) payload.taggedEmployeeIds = []
      await apiRequest(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      toast.success('Employee updated')
      router.push('/dashboard/employees/active')
    } catch (err: any) {
      setError(err?.message || 'Failed to update employee')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/employees/active">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
          Edit {form.role}
        </h1>
      </div>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-lg font-semibold mb-2">Personal Data</div>
          <div>
            <Label>First Name *</Label>
            <Input className="bg-white text-neutral-900" name="firstName" value={form.firstName} onChange={onChange} required />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input className="bg-white text-neutral-900" name="lastName" value={form.lastName} onChange={onChange} />
          </div>
          <div>
            <Label>Emp ID / Code</Label>
            <Input className="bg-white text-neutral-900" name="empCode" value={form.empCode} onChange={onChange} />
          </div>
          <div>
            <Label>Email Id *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} required />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input className="bg-white text-neutral-900" name="phone" value={form.phone} onChange={onChange} />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input className="bg-white text-neutral-900" name="mobile" value={form.mobile} onChange={onChange} required />
          </div>
          <div className="md:col-span-2">
            <Label>Address 1</Label>
            <Textarea className="bg-white text-neutral-900" name="address1" value={form.address1} onChange={onChange} />
          </div>

          <div className="md:col-span-2 text-lg font-semibold mb-2 mt-4">Location & User Type</div>
          <div>
            <Label>PinCode</Label>
            <Input className="bg-white text-neutral-900" name="pincode" value={form.pincode} onChange={onChange} />
          </div>
          <div>
            <Label>Zone *</Label>
            <Select value={form.zone} onValueChange={(zone) => setForm((f) => ({ ...f, zone, cluster: '' }))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Zone" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.role === 'Executive' && (
            <div>
              <Label>Cluster *</Label>
              <Select value={form.cluster} onValueChange={(cluster) => setForm((f) => ({ ...f, cluster }))}>
                <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Cluster" /></SelectTrigger>
                <SelectContent>
                  {(clustersByZone[form.zone] || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>District</Label>
            <Input className="bg-white text-neutral-900" name="district" value={form.district} onChange={onChange} />
          </div>
          <div>
            <Label>City</Label>
            <Input className="bg-white text-neutral-900" name="city" value={form.city} onChange={onChange} />
          </div>
          <div>
            <Label>State *</Label>
            <Input className="bg-white text-neutral-900" name="state" value={form.state} onChange={onChange} required />
          </div>
          <div>
            <Label>User Type *</Label>
            <Select
              value={form.role}
              onValueChange={(v) =>
                setForm((f) => {
                  const allowed = new Set(filterTagOptions(tagOptions, v).map((e) => e._id))
                  return {
                    ...f,
                    role: v,
                    cluster: v === 'Executive' ? f.cluster : '',
                    taggedEmployeeIds: supportsEmployeeTagging(v)
                      ? f.taggedEmployeeIds.filter((id) => allowed.has(id))
                      : [],
                  }
                })
              }
            >
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Executive', 'Trainer', 'Finance Manager', 'Coordinator', 'Senior Coordinator', 'Manager', 'Executive Manager', 'Warehouse Executive', 'Warehouse Manager', 'Admin', 'Super Admin'].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {supportsEmployeeTagging(form.role) && (
            <div className="md:col-span-2">
              <Label className="mb-2 block">{getTaggingSectionLabel(form.role)}</Label>
              <p className="text-xs text-neutral-500 mb-2">
                {form.role === 'Executive Manager' || form.role === 'Manager'
                  ? 'Select executives assigned to this role.'
                  : 'Select employees to tag under this role.'}
              </p>
              <div className="max-h-48 overflow-y-auto border rounded p-3 bg-white space-y-2">
                {filteredTagOptions.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    {form.role === 'Executive Manager' || form.role === 'Manager'
                      ? 'No active executives available to tag'
                      : 'No employees available to tag'}
                  </p>
                ) : (
                  filteredTagOptions.map((e) => (
                    <label key={e._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.taggedEmployeeIds.includes(e._id)}
                        onChange={() => toggleTagged(e._id)}
                      />
                      {e.name} ({e.role})
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
