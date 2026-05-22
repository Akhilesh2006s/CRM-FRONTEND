'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

type Partner = {
  _id: string
  name: string
  email: string
  isActive?: boolean
  createdAt?: string
  partnerAssignedProducts?: Array<{ _id: string; productName: string }>
  vendorAssignedProducts?: Array<{ _id: string; productName: string }>
}

export default function VendorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const currentUser = getCurrentUser()
  const [vendor, setVendor] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadVendor()
  }, [currentUser, router, id])

  const loadVendor = async () => {
    try {
      const data = await apiRequest<Partner>(`/partners/${id}`)
      setVendor(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load vendor')
      router.push('/dashboard/products/vendors')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading vendor...</div>
      </div>
    )
  }

  if (!vendor) {
    return null
  }

  const products = vendor.partnerAssignedProducts || vendor.vendorAssignedProducts || []
  const productNames = products.map(p => (typeof p === 'object' && p?.productName) || String(p))

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/products/vendors"
        className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vendors
      </Link>

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Vendor Details</h1>
        <p className="text-sm text-neutral-600 mt-1">View vendor information and assigned products</p>
      </div>

      <Card className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-xs font-medium text-neutral-500">Vendor Name</Label>
            <p className="text-base font-medium mt-1">{vendor.name}</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-neutral-500">Email</Label>
            <p className="text-base mt-1">{vendor.email}</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-neutral-500">Status</Label>
            <div className="mt-1">
              <Badge
                variant={vendor.isActive !== false ? 'default' : 'secondary'}
                className={vendor.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
              >
                {vendor.isActive !== false ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-neutral-500">Created Date</Label>
            <p className="text-base mt-1">
              {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : '-'}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-200">
          <Label className="text-xs font-medium text-neutral-500">Assigned Products ({productNames.length})</Label>
          {productNames.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-2">No products assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {productNames.map((name, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
