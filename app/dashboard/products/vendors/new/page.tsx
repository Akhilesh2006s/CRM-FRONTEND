'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Save } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

type Product = {
  _id: string
  productName: string
}

export default function NewVendorPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    assignedProducts: [] as string[],
  })
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadProducts()
  }, [currentUser, router])

  const loadProducts = async () => {
    try {
      const data = await apiRequest<Product[]>('/products')
      setProducts(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error('Failed to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const toggleProduct = (productId: string) => {
    setForm(f => ({
      ...f,
      assignedProducts: f.assignedProducts.includes(productId)
        ? f.assignedProducts.filter(id => id !== productId)
        : [...f.assignedProducts, productId],
    }))
  }

  const selectAllProducts = () => {
    if (form.assignedProducts.length === products.length) {
      setForm(f => ({ ...f, assignedProducts: [] }))
    } else {
      setForm(f => ({ ...f, assignedProducts: products.map(p => p._id) }))
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    if (!form.name.trim()) {
      setError('Vendor name is required')
      setSubmitting(false)
      return
    }
    if (!form.email.trim()) {
      setError('Vendor email is required')
      setSubmitting(false)
      return
    }
    if (!form.password.trim()) {
      setError('Vendor password is required')
      setSubmitting(false)
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      setSubmitting(false)
      return
    }
    if (form.assignedProducts.length === 0) {
      setError('At least one product must be assigned to the vendor')
      setSubmitting(false)
      return
    }

    try {
      await apiRequest('/partners', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          assignedProducts: form.assignedProducts,
        }),
      })
      toast.success('Partner created successfully!')
      router.push('/dashboard/products/vendors')
    } catch (err: any) {
      setError(err?.message || 'Failed to create vendor')
      toast.error(err?.message || 'Failed to create vendor')
    } finally {
      setSubmitting(false)
    }
  }

  const onCancel = () => {
    router.push('/dashboard/products/vendors')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/products/vendors"
        className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Partners
      </Link>

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Partner</h1>
        <p className="text-sm text-neutral-600 mt-1">Create a new partner account and assign products</p>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">Partner Basic Details</h2>

            <div>
              <Label htmlFor="name">Partner Name *</Label>
              <Input
                id="name"
                className="bg-white text-neutral-900 mt-1"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Enter partner name"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Partner Email *</Label>
              <Input
                id="email"
                type="email"
                className="bg-white text-neutral-900 mt-1"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Enter partner email (used for login)"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Partner Password *</Label>
              <Input
                id="password"
                type="password"
                className="bg-white text-neutral-900 mt-1"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
                required
              />
              <p className="text-xs text-neutral-500 mt-1">Minimum 6 characters required</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Assign Products</h2>
              <Button type="button" variant="outline" size="sm" onClick={selectAllProducts}>
                {form.assignedProducts.length === products.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <p className="text-sm text-neutral-600">Select products to assign to this vendor. At least one product is required.</p>

            {products.length === 0 ? (
              <div className="p-4 border rounded bg-amber-50 text-amber-800 text-sm">
                No products in the database. Please add products first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded p-3 bg-white">
                {products.map(product => (
                  <div key={product._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`product-${product._id}`}
                      checked={form.assignedProducts.includes(product._id)}
                      onCheckedChange={() => toggleProduct(product._id)}
                      className="border-neutral-400 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 data-[state=checked]:text-white"
                    />
                    <Label
                      htmlFor={`product-${product._id}`}
                      className="text-sm cursor-pointer font-normal"
                    >
                      {product.productName}
                    </Label>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-500">
              Selected: {form.assignedProducts.length} product(s)
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || products.length === 0} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Partner
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
