'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { PlusCircle, Building2, Eye, RefreshCw, Pencil, X, DollarSign } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type Partner = {
  _id: string
  name: string
  email: string
  isActive?: boolean
  createdAt?: string
  partnerAssignedProducts?: Array<{ _id: string; productName: string }>
}

type Product = {
  _id: string
  productName: string
}

export default function PartnersPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const currentUser = mounted ? getCurrentUser() : null
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  const loadPartners = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<Partner[]>('/partners')
      setPartners(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const msg = err?.message || 'Failed to load partners'
      setError(msg)
      toast.error(msg)
      setPartners([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProducts = async () => {
    try {
      const data = await apiRequest<Product[]>('/products/active')
      setAvailableProducts(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error('Failed to load products:', err)
      toast.error('Failed to load products')
    }
  }

  const openEditDialog = async (partner: Partner) => {
    setSelectedPartner(partner)
    // Load current assigned product IDs
    const currentProductIds = partner.partnerAssignedProducts?.map(p => 
      typeof p === 'object' && p._id ? p._id : String(p)
    ) || []
    setSelectedProductIds(currentProductIds)
    await loadProducts()
    setEditDialogOpen(true)
  }

  const handleProductToggle = (productId: string) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId)
      } else {
        return [...prev, productId]
      }
    })
  }

  const handleSaveProducts = async () => {
    if (!selectedPartner) return

    if (selectedProductIds.length === 0) {
      toast.error('At least one product must be assigned to the partner')
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/partners/${selectedPartner._id}/products`, {
        method: 'PUT',
        body: JSON.stringify({
          assignedProducts: selectedProductIds
        })
      })
      toast.success('Products updated successfully!')
      setEditDialogOpen(false)
      loadPartners() // Refresh the list
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update products')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (currentUser && !isAdmin) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadPartners()
  }, [mounted, isAdmin, router, loadPartners])

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading...</div>
      </div>
    )
  }

  if (currentUser && !isAdmin) {
    return null
  }

  if (loading && partners.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading partners...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Partners</h1>
          <p className="text-sm text-neutral-600 mt-1">Manage partner accounts and product assignments</p>
        </div>
        <Link href="/dashboard/products/vendors/new">
          <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Partner
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={loadPartners}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-6">
        {partners.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <p>No partners yet. Add your first partner to get started.</p>
            <Link href="/dashboard/products/vendors/new">
              <Button variant="outline" size="sm" className="mt-4">
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Partner Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Assigned Products Count</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Created Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4 font-medium">{partner.name}</td>
                    <td className="py-3 px-4 text-neutral-600">{partner.email}</td>
                    <td className="py-3 px-4">
                      {Array.isArray(partner.partnerAssignedProducts) ? partner.partnerAssignedProducts.length : 0}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={partner.isActive !== false ? 'default' : 'secondary'}
                        className={partner.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                      >
                        {partner.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/products/vendors/${partner._id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openEditDialog(partner)}
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Link href={`/dashboard/products/vendors/${partner._id}/assign-cost`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-green-200 text-green-700 hover:bg-green-50"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Assign Cost
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Products Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Products - {selectedPartner?.name}</DialogTitle>
            <DialogDescription>
              Add or remove products assigned to this partner
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {availableProducts.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <p>No products available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availableProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product._id)
                  return (
                    <div
                      key={product._id}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50"
                    >
                      <Checkbox
                        id={`product-${product._id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleProductToggle(product._id)}
                        className="border-neutral-400 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 data-[state=checked]:text-white"
                      />
                      <Label
                        htmlFor={`product-${product._id}`}
                        className="flex-1 cursor-pointer font-medium"
                      >
                        {product.productName}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="pt-2 border-t border-neutral-200">
              <p className="text-sm text-neutral-600">
                Selected: <span className="font-semibold">{selectedProductIds.length}</span> product(s)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProducts}
              disabled={saving || selectedProductIds.length === 0}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
