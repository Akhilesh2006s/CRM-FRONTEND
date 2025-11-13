'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useProducts } from '@/hooks/useProducts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ProductSelection = {
  product_name: string
  quantity: number
}

type SampleRequest = {
  _id: string
  request_code: string
  products: ProductSelection[]
  purpose: string
  status: 'Pending' | 'Accepted' | 'Rejected'
  createdAt: string
  accepted_at?: string
  rejected_at?: string
}

export default function SampleRequestPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProducts } = useProducts()
  
  const [products, setProducts] = useState<ProductSelection[]>([])
  const [purpose, setPurpose] = useState('To show schools')
  const [submitting, setSubmitting] = useState(false)
  const [myRequests, setMyRequests] = useState<SampleRequest[]>([])
  const [loading, setLoading] = useState(true)

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

  const addProduct = () => {
    setProducts([...products, { product_name: '', quantity: 1 }])
  }

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index))
  }

  const updateProduct = (index: number, field: keyof ProductSelection, value: string | number) => {
    const updated = [...products]
    updated[index] = { ...updated[index], [field]: value }
    setProducts(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (products.length === 0) {
      toast.error('Please add at least one product')
      return
    }

    // Validate all products
    for (const product of products) {
      if (!product.product_name || !product.quantity || product.quantity < 1) {
        toast.error('Please fill all product fields correctly')
        return
      }
    }

    setSubmitting(true)
    try {
      await apiRequest('/sample-requests', {
        method: 'POST',
        body: JSON.stringify({ products, purpose }),
      })
      toast.success('Sample request created successfully!')
      setProducts([])
      setPurpose('To show schools')
      loadMyRequests()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create sample request')
    } finally {
      setSubmitting(false)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Request Sample Products</h1>
          <p className="text-sm text-neutral-600 mt-1">Request sample products to show schools</p>
        </div>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Purpose</Label>
            <Input
              className="bg-white text-neutral-900"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Purpose of sample request"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Products *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addProduct}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
            
            {products.length === 0 ? (
              <p className="text-sm text-neutral-500 p-4 bg-white rounded border text-center">
                No products added. Click "Add Product" to add products.
              </p>
            ) : (
              <div className="space-y-2">
                {products.map((product, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-white rounded border">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Product Name</Label>
                        <Select
                          value={product.product_name}
                          onValueChange={(value) => updateProduct(index, 'product_name', value)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProducts.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          className="bg-white"
                          value={product.quantity}
                          onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(index)}
                      className="mt-6"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || products.length === 0}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-4 md:p-6 bg-white border border-neutral-200">
        <h2 className="text-xl font-semibold mb-4">My Sample Requests</h2>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : myRequests.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No sample requests yet
          </div>
        ) : (
          <div className="space-y-4">
            {myRequests.map((request) => (
              <div key={request._id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">Request Code: {request.request_code}</p>
                    <p className="text-sm text-neutral-600">Purpose: {request.purpose}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium mb-1">Products:</p>
                  <ul className="list-disc list-inside text-sm text-neutral-600">
                    {request.products.map((p, idx) => (
                      <li key={idx}>
                        {p.product_name} - Quantity: {p.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Created: {new Date(request.createdAt).toLocaleString()}
                </p>
                {request.accepted_at && (
                  <p className="text-xs text-green-600 mt-1">
                    Accepted: {new Date(request.accepted_at).toLocaleString()}
                  </p>
                )}
                {request.rejected_at && (
                  <p className="text-xs text-red-600 mt-1">
                    Rejected: {new Date(request.rejected_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

