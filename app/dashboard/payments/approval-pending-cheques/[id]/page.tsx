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
  chqDate?: string
  chequeNumber?: string
  bankName?: string
  createdBy?: { name?: string; email?: string }
  amount: number
  paymentMethod: string
  financialYear?: string
  referenceNumber?: string
  refNo?: string
  status: string
  description?: string
  adminRemarks?: string
  rejectionReason?: string
  town?: string
  zone?: string
  cluster?: string
  approvedBy?: { name?: string; email?: string }
  rejectedBy?: { name?: string; email?: string }
  heldBy?: { name?: string; email?: string }
  approvedAt?: string
  rejectedAt?: string
  heldAt?: string
}

export default function ChequePaymentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<PaymentData | null>(null)
  const [formData, setFormData] = useState({
    referenceNumber: '',
    chequeNumber: '',
    bankName: '',
    adminRemarks: '',
    status: 'Pending',
  })

  async function load() {
    try {
      const payment = await apiRequest<PaymentData>(`/payments/${id}`)
      setData(payment)
      setFormData({
        referenceNumber: payment.referenceNumber || payment.refNo || payment.chequeNumber || '',
        chequeNumber: payment.chequeNumber || '',
        bankName: payment.bankName || '',
        adminRemarks: payment.adminRemarks || payment.rejectionReason || '',
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

  async function handleApprove(statusToSet?: string) {
    const status = statusToSet || formData.status
    if (!formData.adminRemarks?.trim() && (status === 'Hold' || status === 'Rejected')) {
      toast.error('Please add remarks for Hold or Reject actions')
      return
    }
    setSaving(true)
    try {
      await apiRequest(`/payments/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          adminRemarks: formData.adminRemarks || undefined,
          rejectionReason: status === 'Rejected' ? formData.adminRemarks : undefined,
          referenceNumber: formData.referenceNumber || formData.chequeNumber || undefined,
        }),
      })
      toast.success(`Payment ${status.toLowerCase()} successfully`)
      router.back()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateDetails() {
    setSaving(true)
    try {
      await apiRequest(`/payments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          referenceNumber: formData.referenceNumber || formData.chequeNumber,
          chequeNumber: formData.chequeNumber,
          bankName: formData.bankName || undefined,
        }),
      })
      toast.success('Payment details updated')
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment details')
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
        <h1 className="text-2xl font-semibold mb-6">Cheque Payment Review & Approval</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">School Information</h2>
            <div>
              <label className="text-sm text-neutral-500">School Name</label>
              <Input value={data.customerName || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">School Code</label>
              <Input value={data.schoolCode || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Contact Person</label>
              <Input value={data.contactName || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Contact Mobile</label>
              <Input value={data.mobileNumber || '-'} readOnly className="bg-neutral-50" />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">More Information</h2>
            <div>
              <label className="text-sm text-neutral-500">Zone</label>
              <Input value={data.zone || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Cluster</label>
              <Input value={data.cluster || '-'} readOnly className="bg-neutral-50" />
            </div>
            <div>
              <label className="text-sm text-neutral-500">Executive Remarks</label>
              <textarea
                value={data.description || '-'}
                readOnly
                className="w-full border rounded px-3 py-2 bg-neutral-50 min-h-[60px]"
              />
            </div>
          </div>

          <div className="space-y-4 md:col-span-2">
            <h2 className="text-lg font-semibold border-b pb-2">Cheque Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-neutral-500">Executive</label>
                <Input value={data.createdBy?.name || '-'} readOnly className="bg-neutral-50" />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Payment Date</label>
                <Input
                  value={data.paymentDate ? new Date(data.paymentDate).toLocaleDateString() : '-'}
                  readOnly
                  className="bg-neutral-50"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Cheque Date</label>
                <Input
                  value={data.chqDate ? new Date(data.chqDate).toLocaleDateString() : '-'}
                  readOnly
                  className="bg-neutral-50"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Cheque Number</label>
                <Input
                  value={formData.chequeNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      chequeNumber: e.target.value,
                      referenceNumber: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Bank Name</label>
                <Input
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Reference No</label>
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Current Status</label>
                <Input value={data.status || 'Pending'} readOnly className="bg-neutral-50 font-semibold" />
              </div>
              <div>
                <label className="text-sm text-neutral-500">Amount</label>
                <Input value={data.amount?.toFixed(2) || '0.00'} readOnly className="bg-neutral-50" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-neutral-500">Admin Remarks</label>
                <textarea
                  value={formData.adminRemarks}
                  onChange={(e) => setFormData({ ...formData, adminRemarks: e.target.value })}
                  placeholder="Required for Hold/Reject"
                  className="w-full border rounded px-3 py-2 bg-white text-neutral-900 min-h-[100px]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <Button onClick={() => handleApprove('Approved')} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? 'Processing...' : 'Approve'}
          </Button>
          <Button onClick={() => handleApprove('Hold')} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700">
            {saving ? 'Processing...' : 'Hold'}
          </Button>
          <Button onClick={() => handleApprove('Rejected')} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? 'Processing...' : 'Reject'}
          </Button>
          <Button onClick={handleUpdateDetails} disabled={saving} variant="outline">
            {saving ? 'Saving...' : 'Update Details'}
          </Button>
          <Button onClick={() => router.back()} variant="outline">
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  )
}
