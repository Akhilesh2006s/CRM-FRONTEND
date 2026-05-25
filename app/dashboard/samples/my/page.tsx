'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Plus } from 'lucide-react'
import { formatSampleDeliveryAddress } from '@/lib/sampleRequestFields'

type SampleProduct = {
  product_name: string
  quantity: number
  class?: string
  level?: string
  specs?: string
}

type SampleRequest = {
  _id: string
  request_code: string
  school_name: string
  products: SampleProduct[]
  purpose: string
  status: 'Pending' | 'Accepted' | 'Rejected'
  createdAt: string
  accepted_at?: string
  rejected_at?: string
  rejection_reason?: string
  transport_name?: string
  transport_location?: string
  pincode?: string
  area?: string
  city?: string
  property_number?: string
  dc_id?: { _id: string; dc_code?: string; status?: string } | string
}

export default function MySamplesPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [myRequests, setMyRequests] = useState<SampleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    loadMyRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMyRequests = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<SampleRequest[]>('/sample-requests/my')
      setMyRequests(data)
    } catch (err: any) {
      toast.error('Failed to load sample requests')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-100 text-green-800'
      case 'Rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const warehouseLabel = (req: SampleRequest) => {
    if (req.status !== 'Accepted') return null
    const dc = req.dc_id
    if (!dc || typeof dc === 'string') return 'Sent to warehouse (processing)'
    const st = dc.status
    if (st === 'sent_to_manager') return 'At warehouse queue (DC @ Warehouse)'
    if (st === 'warehouse_processing') return 'Warehouse processing'
    if (st === 'completed') return 'Completed'
    return `DC status: ${st || '—'}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/samples/request">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Samples</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Track sample requests you submitted and their EMP DC / warehouse status.
            </p>
          </div>
        </div>
        <Link href="/dashboard/samples/request">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New request
          </Button>
        </Link>
      </div>

      <Card className="p-4 md:p-6 bg-white border border-neutral-200">
        {loading ? (
          <div className="text-center py-8">Loading…</div>
        ) : myRequests.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No sample requests yet.{' '}
            <Link href="/dashboard/samples/request" className="text-blue-600 underline">
              Create one
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {myRequests.map((request) => {
              const open = expandedId === request._id
              const wh = warehouseLabel(request)
              return (
                <div key={request._id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold">{request.school_name}</p>
                      <p className="text-sm text-neutral-600">Code: {request.request_code}</p>
                      <p className="text-sm text-neutral-600">Purpose: {request.purpose}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold shrink-0 ${getStatusColor(request.status)}`}
                    >
                      {request.status}
                    </span>
                  </div>
                  {wh && (
                    <p className="text-xs text-blue-700 mt-2 font-medium">{wh}</p>
                  )}
                  <ul className="list-disc list-inside text-sm text-neutral-600 mt-2">
                    {request.products.map((p, idx) => (
                      <li key={idx}>
                        {p.product_name}
                        {p.class ? ` · Class ${p.class}` : ''}
                        {p.level ? ` · ${p.level}` : ''} — Qty: {p.quantity}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-neutral-500 mt-2">
                    Submitted: {new Date(request.createdAt).toLocaleString()}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 h-auto text-sm mt-1"
                    onClick={() => setExpandedId(open ? null : request._id)}
                  >
                    {open ? 'Hide details' : 'View delivery & transport'}
                  </Button>
                  {open && (
                    <div className="mt-2 text-sm text-neutral-700 bg-neutral-50 p-3 rounded space-y-1">
                      <p>
                        <span className="font-medium">Delivery:</span>{' '}
                        {formatSampleDeliveryAddress(request)}
                      </p>
                      <p>
                        <span className="font-medium">Transport:</span>{' '}
                        {[request.transport_name, request.transport_location, request.pincode]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                      {request.rejection_reason && (
                        <p className="text-red-700">
                          <span className="font-medium">Rejection:</span> {request.rejection_reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
