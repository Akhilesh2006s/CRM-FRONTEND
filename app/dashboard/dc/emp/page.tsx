'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useProducts } from '@/hooks/useProducts'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'

type Emp = { _id: string; name: string }
type EmpDC = {
  _id: string
  emp_dc_code: string
  employee_id: Emp | string
  kit_type: string
  distribution_date: string
  expected_return_date?: string
  products?: Array<{ product: string; quantity: number }>
  status: string
}
type KitProduct = { product: string; quantity: string }
type EmployeeOption = { _id: string; name?: string; email?: string; role?: string; empCode?: string }

type SampleRequest = {
  _id: string
  request_code: string
  employee_id: Emp | string
  school_name?: string
  products: Array<{
    product_name: string
    quantity: number
    class?: string
    level?: string
    specs?: string
  }>
  purpose: string
  status: 'Pending' | 'Accepted' | 'Rejected'
  createdAt: string
  transport_name?: string
  transport_location?: string
  pincode?: string
  area?: string
  city?: string
}

export default function EmployeeDCPage() {
  const [list, setList] = useState<EmpDC[]>([])
  const [loading, setLoading] = useState(true)
  const [sampleRequests, setSampleRequests] = useState<SampleRequest[]>([])
  const [loadingSamples, setLoadingSamples] = useState(true)
  const [form, setForm] = useState({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' })
  const [submitting, setSubmitting] = useState(false)
  const [kitProducts, setKitProducts] = useState<KitProduct[]>([{ product: '', quantity: '1' }])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [returningId, setReturningId] = useState<string | null>(null)
  const { productNames } = useProducts()
  /** BDEs request samples and see their own requests / kits; reviewers accept, reject and issue kits. */
  const isBde = ['Executive', 'Sales BDE', 'Employee'].includes(String(getCurrentUser()?.role || ''))
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<EmpDC[]>(`/emp-dc/list`)
      setList(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load employee kits')
    } finally {
      setLoading(false)
    }
  }

  const loadSampleRequests = async () => {
    setLoadingSamples(true)
    try {
      // A BDE sees all of their own requests with status; reviewers see the pending queue.
      const data = await apiRequest<SampleRequest[]>(isBde ? `/sample-requests/my` : `/sample-requests/pending`)
      setSampleRequests(data)
    } catch (err: any) {
      toast.error('Failed to load sample requests')
      console.error(err)
    } finally {
      setLoadingSamples(false)
    }
  }

  useEffect(() => { 
    load()
    loadSampleRequests()
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      const res = await apiRequest<any>('/employees?isActive=true')
      const rows: EmployeeOption[] = Array.isArray(res) ? res : res?.data || res?.employees || []
      setEmployees(rows.filter((e) => e && e._id).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))))
    } catch (err: any) {
      toast.error(err?.message || 'Could not load employees')
    }
  }

  const handleAccept = async (requestId: string) => {
    setProcessingRequest(requestId)
    try {
      await apiRequest(`/sample-requests/${requestId}/accept`, { method: 'PUT' })
      toast.success('Accepted — EmpDC created and sample DC sent to warehouse queue')
      loadSampleRequests()
      load() // Reload EmpDC list to show the new entry
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept sample request')
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setProcessingRequest(requestId)
    try {
      await apiRequest(`/sample-requests/${requestId}/reject`, { 
        method: 'PUT',
        body: JSON.stringify({ rejection_reason: 'Rejected by admin' })
      })
      toast.success('Sample request rejected')
      loadSampleRequests()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject sample request')
    } finally {
      setProcessingRequest(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id) {
      toast.error('Select the employee who receives the kit.')
      return
    }
    const products = kitProducts
      .filter((p) => p.product.trim())
      .map((p) => ({ product: p.product.trim(), quantity: Math.floor(Number(p.quantity)) || 0 }))
    const badQty = products.find((p) => p.quantity < 1)
    if (badQty) {
      toast.error(`Enter a quantity of at least 1 for ${badQty.product}.`)
      return
    }
    setSubmitting(true)
    try {
      await apiRequest(`/emp-dc/create`, { method: 'POST', body: JSON.stringify({ ...form, products }) })
      toast.success('Employee kit created')
      setForm({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' })
      setKitProducts([{ product: '', quantity: '1' }])
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create the employee kit.')
    } finally {
      setSubmitting(false)
    }
  }

  const markReturned = async (kit: EmpDC) => {
    setReturningId(kit._id)
    try {
      await apiRequest(`/emp-dc/${kit._id}/return`, { method: 'PUT' })
      toast.success(`${kit.emp_dc_code} marked returned`)
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark the kit returned.')
    } finally {
      setReturningId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">EMP DC (Employee Kits)</h1>
      
      <Tabs defaultValue="samples" className="w-full">
        <TabsList>
          <TabsTrigger value="samples">Sample Requests</TabsTrigger>
          <TabsTrigger value="kits">Employee Kits</TabsTrigger>
        </TabsList>

        <TabsContent value="samples">
          {isBde && (
            <div className="mb-3 flex justify-end">
              <Link href="/dashboard/samples/request">
                <Button type="button">+ Request samples</Button>
              </Link>
            </div>
          )}
          <Card className="p-0 overflow-x-auto">
            {loadingSamples && <div className="p-4">Loading sample requests…</div>}
            {!loadingSamples && sampleRequests.length === 0 && (
              <div className="p-8 text-center text-neutral-500">
                {isBde ? 'You have not requested any samples yet.' : 'No pending sample requests'}
              </div>
            )}
            {!loadingSamples && sampleRequests.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-50/70 border-b text-neutral-700">
                    <th className="py-2 px-3 text-left">Request Code</th>
                    <th className="py-2 px-3 text-left">School</th>
                    <th className="py-2 px-3 text-left">Employee</th>
                    <th className="py-2 px-3 text-left">Products</th>
                    <th className="py-2 px-3 text-left">Delivery / Transport</th>
                    <th className="py-2 px-3 text-left">Purpose</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">{isBde ? 'Status' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRequests.map((request) => (
                    <tr key={request._id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium">{request.request_code}</td>
                      <td className="py-2 px-3 text-xs font-medium">{request.school_name || '—'}</td>
                      <td className="py-2 px-3">
                        {typeof request.employee_id === 'string' ? request.employee_id : request.employee_id?.name}
                      </td>
                      <td className="py-2 px-3">
                        <ul className="list-disc list-inside text-xs">
                          {request.products.map((p, idx) => (
                            <li key={idx}>
                              {p.product_name}
                              {p.class ? ` · Cl ${p.class}` : ''}
                              {p.level ? ` · ${p.level}` : ''} (Qty: {p.quantity})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-2 px-3 text-xs max-w-[200px]">
                        <div>{[request.area, request.city].filter(Boolean).join(', ') || '—'}</div>
                        <div className="text-neutral-500">
                          {[request.transport_name, request.pincode].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs">{request.purpose}</td>
                      <td className="py-2 px-3 text-center text-xs">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        {isBde ? (
                          <div className="text-center">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${request.status === 'Accepted' ? 'bg-green-100 text-green-700' : request.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                              {request.status}
                            </span>
                          </div>
                        ) : (
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAccept(request._id)}
                            disabled={processingRequest === request._id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request._id)}
                            disabled={processingRequest === request._id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kits">
          {!isBde && (
          <Card className="p-4 space-y-4 text-neutral-900">
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employee_id || undefined} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger aria-label="Employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp._id} value={emp._id}>
                        {emp.name || emp.email || 'Employee'}{emp.empCode ? ` (${emp.empCode})` : ''}{emp.role ? ` · ${emp.role}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kit Type</Label>
                <Select value={form.kit_type} onValueChange={(v) => setForm({ ...form, kit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Field">Field</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Distribution Date *</Label>
                <Input type="date" value={form.distribution_date} onChange={(e) => setForm({ ...form, distribution_date: e.target.value })} required />
              </div>
              <div>
                <Label>Expected Return</Label>
                <Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
              </div>
              <div className="md:col-span-4 space-y-2">
                <Label>Kit products</Label>
                {kitProducts.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <Select
                      value={item.product || undefined}
                      onValueChange={(v) => setKitProducts((rows) => rows.map((r, i) => (i === idx ? { ...r, product: v } : r)))}
                    >
                      <SelectTrigger className="w-56" aria-label="Kit product"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {productNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-28"
                      type="number"
                      min={1}
                      step={1}
                      aria-label="Kit product quantity"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => setKitProducts((rows) => rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setKitProducts((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : [{ product: '', quantity: '1' }]))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setKitProducts((rows) => [...rows, { product: '', quantity: '1' }])}>
                  + Add product
                </Button>
              </div>
              <div className="md:col-span-4">
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Kit'}</Button>
              </div>
            </form>
          </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            {loading && <div className="p-4">Loading…</div>}
            {!loading && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-50/70 border-b text-neutral-700">
                    <th className="py-2 px-3 text-left">Code</th>
                    <th className="py-2 px-3 text-left">Employee</th>
                    <th className="py-2 px-3">Kit</th>
                    <th className="py-2 px-3 text-left">Products</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Expected Return</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((k) => (
                    <tr key={k._id} className="border-b last:border-0">
                      <td className="py-2 px-3">{k.emp_dc_code}</td>
                      <td className="py-2 px-3">{typeof k.employee_id === 'string' ? k.employee_id : k.employee_id?.name}</td>
                      <td className="py-2 px-3 text-center">{k.kit_type}</td>
                      <td className="py-2 px-3">
                        {k.products?.length ? k.products.map((p) => `${p.product} × ${p.quantity}`).join(', ') : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">{k.distribution_date ? new Date(k.distribution_date).toLocaleDateString() : '-'}</td>
                      <td className="py-2 px-3 text-center">{k.expected_return_date ? new Date(k.expected_return_date).toLocaleDateString() : '-'}</td>
                      <td className="py-2 px-3 text-center capitalize">{k.status}</td>
                      <td className="py-2 px-3 text-center">
                        {isBde ? (
                          <span className="text-xs text-neutral-500">{k.status === 'returned' ? 'Returned' : 'With you'}</span>
                        ) : k.status === 'returned' ? (
                          <span className="text-xs text-neutral-500">Returned</span>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled={returningId === k._id} onClick={() => markReturned(k)}>
                            {returningId === k._id ? 'Saving…' : 'Mark Returned'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

