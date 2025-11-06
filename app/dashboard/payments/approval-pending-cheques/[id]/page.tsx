'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type PaymentData = {
  _id: string
  schoolCode?: string
  customerName: string
  contactName?: string
  mobileNumber?: string
  location?: string
  paymentDate: string
  createdBy?: {
    name?: string
    email?: string
  }
  amount: number
  paymentMethod: string
  financialYear?: string
  referenceNumber?: string
  refNo?: string
  status: string
  description?: string
  town?: string
  zone?: string
  cluster?: string
}

const STATUS_OPTIONS = ['Pending', 'hold/duplicate', 'Approved']

export default function PaymentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PaymentData | null>(null)
  const [formData, setFormData] = useState({
    referenceNumber: '',
    remarks: '',
    status: 'Pending',
  })

  async function load() {
    try {
      const payment = await apiRequest<PaymentData>(`/payments/${id}`)
      setData(payment)
      setFormData({
        referenceNumber: payment.referenceNumber || payment.refNo || '',
        remarks: payment.description || '',
        status: payment.status || 'Pending',
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load payment')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) load()
  }, [id])

  async function handleUpdate() {
    setSaving(true)
    try {
      await apiRequest(`/payments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          referenceNumber: formData.referenceNumber,
          description: formData.remarks,
          status: formData.status,
        }),
      })
      toast.success('Payment updated successfully')
      router.back()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
        <Card className="p-6">
          <div className="text-center">Loading...</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold mb-6">DC Form Update</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* School Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">School Information</h2>
            <div>
              <label className="text-sm text-neutral-500">School Type</label>
              <Input value="Existing" readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">School Name</label>
              <Input value={data.customerName || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">School code</label>
              <Input value={data.schoolCode || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Contact Person Name</label>
              <Input value={data.contactName || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Contact Mobile</label>
              <Input value={data.mobileNumber || '-'} readOnly className="bg-neutral-50" />
            </div>
          </div>

          {/* More Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">More Information</h2>
            <div>
              <label className="text-sm text-neutral-500">Town</label>
              <Input value={data.town || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Address</label>
              <textarea
                value={data.location || '-'}
                readOnly
                className="w-full border rounded px-3 py-2 bg-neutral-900 text-white min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Zone</label>
              <Input value={data.zone || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Cluster</label>
              <Input value={data.cluster || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Remarks</label>
              <textarea
                value={data.description || '-'}
                readOnly
                className="w-full border rounded px-3 py-2 bg-neutral-900 text-white min-h-[80px]"
              />
            </div>
          </div>

          {/* Payment Information Update */}
          <div className="space-y-4 md:col-span-2">
            <h2 className="text-lg font-semibold border-b pb-2">Payment Information Update</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-neutral-500">Executive</label>
                <Input value={data.createdBy?.name || '-'} readOnly className="bg-neutral-50" />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Payment Mode</label>
                <Input value={data.paymentMethod || '-'} readOnly className="bg-neutral-50" />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Reference No *</label>
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  placeholder="Enter reference number"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Status *</label>
                <select
                  className="w-full border rounded px-2 py-2 bg-neutral-900 text-white"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-neutral-500">Executive Remarks</label>
                <Input value={data.description || '-'} readOnly className="bg-neutral-50" />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Amount</label>
                <Input value={data.amount?.toFixed(2) || '0.00'} readOnly className="bg-neutral-50" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-neutral-500">Remarks *</label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter remarks"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={handleUpdate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </Card>
    </div>
  )
}


