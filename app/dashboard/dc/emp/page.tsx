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

type Emp = { _id: string; name: string }
type EmpDC = { _id: string; emp_dc_code: string; employee_id: Emp | string; kit_type: string; distribution_date: string; status: string }

type SampleRequest = {
  _id: string
  request_code: string
  employee_id: Emp | string
  products: Array<{ product_name: string; quantity: number }>
  purpose: string
  status: 'Pending' | 'Accepted' | 'Rejected'
  createdAt: string
}

export default function EmployeeDCPage() {
  const [list, setList] = useState<EmpDC[]>([])
  const [loading, setLoading] = useState(true)
  const [sampleRequests, setSampleRequests] = useState<SampleRequest[]>([])
  const [loadingSamples, setLoadingSamples] = useState(true)
  const [form, setForm] = useState({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' })
  const [submitting, setSubmitting] = useState(false)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<EmpDC[]>(`/emp-dc/list`)
      setList(data)
    } finally {
      setLoading(false)
    }
  }

  const loadSampleRequests = async () => {
    setLoadingSamples(true)
    try {
      const data = await apiRequest<SampleRequest[]>(`/sample-requests/pending`)
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
  }, [])

  const handleAccept = async (requestId: string) => {
    setProcessingRequest(requestId)
    try {
      await apiRequest(`/sample-requests/${requestId}/accept`, { method: 'PUT' })
      toast.success('Sample request accepted and EmpDC created')
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
    setSubmitting(true)
    try {
      await apiRequest(`/emp-dc/create`, { method: 'POST', body: JSON.stringify(form) })
      setForm({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' })
      load()
    } catch (e) {
      alert('Failed to create EMP DC. Ensure you are logged in.')
    } finally {
      setSubmitting(false)
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
          <Card className="p-0 overflow-x-auto">
            {loadingSamples && <div className="p-4">Loading sample requests…</div>}
            {!loadingSamples && sampleRequests.length === 0 && (
              <div className="p-8 text-center text-neutral-500">
                No pending sample requests
              </div>
            )}
            {!loadingSamples && sampleRequests.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-50/70 border-b text-neutral-700">
                    <th className="py-2 px-3 text-left">Request Code</th>
                    <th className="py-2 px-3 text-left">Employee</th>
                    <th className="py-2 px-3 text-left">Products</th>
                    <th className="py-2 px-3 text-left">Purpose</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRequests.map((request) => (
                    <tr key={request._id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium">{request.request_code}</td>
                      <td className="py-2 px-3">
                        {typeof request.employee_id === 'string' ? request.employee_id : request.employee_id?.name}
                      </td>
                      <td className="py-2 px-3">
                        <ul className="list-disc list-inside text-xs">
                          {request.products.map((p, idx) => (
                            <li key={idx}>{p.product_name} (Qty: {p.quantity})</li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-2 px-3 text-xs">{request.purpose}</td>
                      <td className="py-2 px-3 text-center text-xs">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kits">
          <Card className="p-4 space-y-4 text-neutral-900">
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Employee ID</Label>
                <Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="User ObjectId" required />
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
                <Label>Distribution Date</Label>
                <Input type="date" value={form.distribution_date} onChange={(e) => setForm({ ...form, distribution_date: e.target.value })} required />
              </div>
              <div>
                <Label>Expected Return</Label>
                <Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Kit'}</Button>
              </div>
            </form>
          </Card>

          <Card className="p-0 overflow-x-auto">
            {loading && <div className="p-4">Loading…</div>}
            {!loading && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-50/70 border-b text-neutral-700">
                    <th className="py-2 px-3 text-left">Code</th>
                    <th className="py-2 px-3 text-left">Employee</th>
                    <th className="py-2 px-3">Kit</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((k) => (
                    <tr key={k._id} className="border-b last:border-0">
                      <td className="py-2 px-3">{k.emp_dc_code}</td>
                      <td className="py-2 px-3">{typeof k.employee_id === 'string' ? k.employee_id : k.employee_id?.name}</td>
                      <td className="py-2 px-3 text-center">{k.kit_type}</td>
                      <td className="py-2 px-3 text-center">{k.distribution_date ? new Date(k.distribution_date).toLocaleDateString() : '-'}</td>
                      <td className="py-2 px-3 text-center">{k.status}</td>
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

