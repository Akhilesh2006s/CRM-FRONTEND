'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'

type Item = {
  _id: string
  productName: string
  category: string
  level?: string
  specs?: string
  subject?: string
  currentStock?: number
}

export default function InventoryEditItemPage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '').toString()
  const router = useRouter()
  const { productNames: productOptions, getProductLevels, getProductSpecs, getProductSubjects, hasProductSubjects } = useProducts()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [specs, setSpecs] = useState('Regular')
  const [subject, setSubject] = useState('')
  const [updateQty, setUpdateQty] = useState('')
  
  // Update level, specs, and subject options when product changes
  useEffect(() => {
    if (productName) {
      const levels = getProductLevels(productName)
      if (levels.length > 0 && !levels.includes(level)) {
        setLevel(levels[0]) // Set to first available level
      }
      const availableSpecs = getProductSpecs(productName)
      if (availableSpecs.length > 0 && !availableSpecs.includes(specs)) {
        setSpecs(availableSpecs[0]) // Set to first available spec
      }
      if (!hasProductSubjects(productName)) {
        setSubject('') // Clear subject if product doesn't have subjects
      }
    }
  }, [productName, getProductLevels, getProductSpecs, hasProductSubjects])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {

        const item = await apiRequest<Item>(`/warehouse/${id}`)
        setProductName(item.productName || '')
        setCategory(item.category || '')
        setLevel(item.level || '')
        setSpecs(item.specs || 'Regular')
        setSubject(item.subject || '')
        setUpdateQty(String(item.currentStock ?? 0))
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load item')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate subject is required for products with subjects
    if (productName && hasProductSubjects(productName) && !subject) {
      toast.error('Subject is required for this product')
      return
    }
    
    setSaving(true)
    try {
      const qty = parseFloat(updateQty)
      if (isNaN(qty) || qty < 0) {
        toast.error('Please enter a valid quantity (0 or greater)')
        setSaving(false)
        return
      }
      await apiRequest(`/warehouse/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          productName, 
          category, 
          level,
          specs: specs || 'Regular',
          subject: subject || undefined,
          currentStock: qty 
        }),
      })
      toast.success('Item updated')
      router.push('/dashboard/warehouse/inventory-items')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit Item</h1>
      </div>
      <Card className="p-6">
        {!loading && (
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Product *</div>
              <Select onValueChange={(value) => {
                setProductName(value)
                // If level is not valid for new product, reset to first available level
                const availableLevels = getProductLevels(value)
                if (!availableLevels.includes(level)) {
                  setLevel(availableLevels.length > 0 ? availableLevels[0] : '')
                }
                // Reset specs and set to first available spec
                const availableSpecs = getProductSpecs(value)
                if (availableSpecs.length > 0 && !availableSpecs.includes(specs)) {
                  setSpecs(availableSpecs[0])
                }
                // Clear subject if product doesn't have subjects
                if (!hasProductSubjects(value)) {
                  setSubject('')
                }
              }} value={productName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Category *</div>
              <Input placeholder="Category Name" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Level</div>
              <Select onValueChange={setLevel} value={level} disabled={!productName}>
                <SelectTrigger>
                  <SelectValue placeholder={productName ? "Select Level" : "Select Product first"} />
                </SelectTrigger>
                <SelectContent>
                  {productName && getProductLevels(productName).map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Specs</div>
              <Select onValueChange={setSpecs} value={specs} disabled={!productName}>
                <SelectTrigger>
                  <SelectValue placeholder={productName ? "Select Specs" : "Select Product first"} />
                </SelectTrigger>
                <SelectContent>
                  {productName && getProductSpecs(productName).map((spec) => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productName && hasProductSubjects(productName) && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Subject *</div>
                <Select onValueChange={setSubject} value={subject || undefined} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Subject *" />
                  </SelectTrigger>
                  <SelectContent>
                    {getProductSubjects(productName).map((subj) => (
                      <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Update qty *</div>
              <Input type="number" step="1" min="0" placeholder="Quantity" value={updateQty} onChange={(e) => setUpdateQty(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || !productName || !category || !updateQty || (hasProductSubjects(productName) && !subject)}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}


