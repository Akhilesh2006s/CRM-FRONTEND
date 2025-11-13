'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { PlusCircle, Edit, Search, Package } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

type Product = {
  _id: string
  productName: string
  productLevels: string[]
  hasSubjects: boolean
  subjects: string[]
  hasSpecs: boolean
  specs?: string | string[] // Support both old (string) and new (array) format for backward compatibility
  prodStatus: number
  createdAt: string
  createdBy?: {
    name: string
    email: string
  }
}

const SPECS_OPTIONS = [
  'Regular',
  'Single Level only',
  'Class WorkBooks Only',
]

export default function ProductsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({
    productName: '',
    productLevels: [] as string[],
    newLevel: '',
    hasSubjects: false,
    subjects: [] as string[],
    newSubject: '',
    hasSpecs: false,
    specs: [] as string[],
    prodStatus: 1,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadProducts()
  }, [statusFilter])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const url = statusFilter === 'all' 
        ? '/products' 
        : `/products?status=${statusFilter}`
      const data = await apiRequest<Product[]>(url)
      setProducts(data || [])
    } catch (err: any) {
      toast.error('Failed to load products')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      productName: product.productName,
      productLevels: product.productLevels || [],
      newLevel: '',
      hasSubjects: product.hasSubjects || false,
      subjects: product.subjects || [],
      newSubject: '',
      hasSpecs: product.hasSpecs || false,
      specs: Array.isArray(product.specs) ? product.specs : (product.specs ? [product.specs] : []),
      prodStatus: product.prodStatus,
    })
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingProduct(null)
    setEditForm({
      productName: '',
      productLevels: [],
      newLevel: '',
      hasSubjects: false,
      subjects: [],
      newSubject: '',
      hasSpecs: false,
      specs: [],
      prodStatus: 1,
    })
  }

  const addLevel = () => {
    if (editForm.newLevel.trim()) {
      setEditForm({
        ...editForm,
        productLevels: [...editForm.productLevels, editForm.newLevel.trim()],
        newLevel: '',
      })
    }
  }

  const removeLevel = (index: number) => {
    setEditForm({
      ...editForm,
      productLevels: editForm.productLevels.filter((_, i) => i !== index),
    })
  }

  const addSubject = () => {
    if (editForm.newSubject.trim() && !editForm.subjects.includes(editForm.newSubject.trim())) {
      setEditForm({
        ...editForm,
        subjects: [...editForm.subjects, editForm.newSubject.trim()],
        newSubject: '',
      })
    }
  }

  const removeSubject = (index: number) => {
    setEditForm({
      ...editForm,
      subjects: editForm.subjects.filter((_, i) => i !== index),
    })
  }

  const addSpec = (spec: string) => {
    if (spec && !editForm.specs.includes(spec)) {
      setEditForm({
        ...editForm,
        specs: [...editForm.specs, spec],
      })
    }
  }

  const removeSpec = (index: number) => {
    setEditForm({
      ...editForm,
      specs: editForm.specs.filter((_, i) => i !== index),
    })
  }

  const handleSaveEdit = async () => {
    if (!editingProduct) return

    // Validation
    if (!editForm.productName.trim()) {
      toast.error('Product name is required')
      return
    }
    if (editForm.hasSubjects && editForm.subjects.length === 0) {
      toast.error('At least one subject is required when subjects are enabled')
      return
    }
    if (editForm.hasSpecs && editForm.specs.length === 0) {
      toast.error('At least one spec is required when specs are enabled')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        productName: editForm.productName,
        productLevels: editForm.productLevels,
        hasSubjects: editForm.hasSubjects,
        subjects: editForm.hasSubjects ? editForm.subjects : [],
        hasSpecs: editForm.hasSpecs,
        specs: editForm.hasSpecs ? editForm.specs : [],
        prodStatus: editForm.prodStatus,
      }

      await apiRequest(`/products/${editingProduct._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Product updated successfully!')
      closeEditModal()
      await loadProducts()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading products...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Products</h1>
          <p className="text-sm text-neutral-600 mt-1">Manage all products in the system</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            Add New Product
          </Button>
        </Link>
      </div>

      <Card className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="1">Available</SelectItem>
              <SelectItem value="0">Not Available</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <p>No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Product Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Levels</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Subjects</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Specs</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Created Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-neutral-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4 font-medium">{product.productName}</td>
                    <td className="py-3 px-4">
                      {product.productLevels.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.productLevels.map((level, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {level}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {product.hasSubjects && product.subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.subjects.map((subject, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {product.hasSpecs && product.specs && Array.isArray(product.specs) && product.specs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.specs.map((spec, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={product.prodStatus === 1 ? 'default' : 'secondary'}
                        className={product.prodStatus === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                      >
                        {product.prodStatus === 1 ? 'Available' : 'Not Available'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(product)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Product Name *</Label>
              <Input
                value={editForm.productName}
                onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Product Levels</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Enter level (e.g., L1, L2)"
                  value={editForm.newLevel}
                  onChange={(e) => setEditForm({ ...editForm, newLevel: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLevel())}
                />
                <Button type="button" onClick={addLevel} variant="outline">
                  Add Level
                </Button>
              </div>
              {editForm.productLevels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {editForm.productLevels.map((level, idx) => (
                    <Badge key={idx} variant="outline" className="flex items-center gap-1">
                      {level}
                      <button
                        type="button"
                        onClick={() => removeLevel(idx)}
                        className="ml-1 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasSubjects"
                checked={editForm.hasSubjects}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, hasSubjects: checked as boolean })
                }
              />
              <Label htmlFor="hasSubjects" className="cursor-pointer">
                Has Subjects
              </Label>
            </div>

            {editForm.hasSubjects && (
              <div>
                <Label>Subjects</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Enter subject name"
                    value={editForm.newSubject}
                    onChange={(e) => setEditForm({ ...editForm, newSubject: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                  />
                  <Button type="button" onClick={addSubject} variant="outline">
                    Add Subject
                  </Button>
                </div>
                {editForm.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editForm.subjects.map((subject, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {subject}
                        <button
                          type="button"
                          onClick={() => removeSubject(idx)}
                          className="ml-1 hover:text-red-600"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasSpecs"
                checked={editForm.hasSpecs}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, hasSpecs: checked as boolean })
                }
              />
              <Label htmlFor="hasSpecs" className="cursor-pointer">
                Has Specs
              </Label>
            </div>

            {editForm.hasSpecs && (
              <div>
                <Label>Specs *</Label>
                <p className="text-xs text-neutral-500 mb-2">Select one or multiple specs</p>
                <Select
                  onValueChange={(v) => addSpec(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a spec to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECS_OPTIONS.filter(spec => !editForm.specs.includes(spec)).map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.specs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editForm.specs.map((spec, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        {spec}
                        <button
                          type="button"
                          onClick={() => removeSpec(idx)}
                          className="ml-1 hover:text-red-600"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Product Status *</Label>
              <Select
                value={editForm.prodStatus.toString()}
                onValueChange={(v) => setEditForm({ ...editForm, prodStatus: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Available</SelectItem>
                  <SelectItem value="0">Not Available</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

