'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Save, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function NewProductPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentLogicOpen, setPaymentLogicOpen] = useState(false)

  const [form, setForm] = useState({
    productName: '',
    productLevels: [] as string[],
    newLevel: '',
    hasSubjects: false,
    subjects: [] as string[],
    newSubject: '',
    hasSpecs: false,
    specs: [] as string[],
    newSpec: '',
    hasCategory: false,
    categories: [] as string[],
    newCategory: '',
    prodStatus: 1,
    calculationType: 'normal' as 'normal' | 'level_based' | 'subject_based',
  })

  const addLevel = () => {
    if (form.newLevel.trim() && !form.productLevels.includes(form.newLevel.trim())) {
      setForm({
        ...form,
        productLevels: [...form.productLevels, form.newLevel.trim()],
        newLevel: '',
      })
    }
  }

  const addNamedTerm = (term: string) => {
    const value = term.trim()
    if (!value || form.productLevels.includes(value)) return
    setForm({
      ...form,
      productLevels: [...form.productLevels, value],
      newLevel: '',
    })
  }

  const removeLevel = (index: number) => {
    setForm({
      ...form,
      productLevels: form.productLevels.filter((_, i) => i !== index),
    })
  }

  const addSubject = () => {
    if (form.newSubject.trim() && !form.subjects.includes(form.newSubject.trim())) {
      setForm({
        ...form,
        subjects: [...form.subjects, form.newSubject.trim()],
        newSubject: '',
      })
    }
  }

  const removeSubject = (index: number) => {
    setForm({
      ...form,
      subjects: form.subjects.filter((_, i) => i !== index),
    })
  }

  const addSpec = () => {
    if (form.newSpec.trim() && !form.specs.includes(form.newSpec.trim())) {
      setForm({
        ...form,
        specs: [...form.specs, form.newSpec.trim()],
        newSpec: '',
      })
    }
  }

  const removeSpec = (index: number) => {
    setForm({
      ...form,
      specs: form.specs.filter((_, i) => i !== index),
    })
  }

  const addCategory = () => {
    if (form.newCategory.trim() && !form.categories.includes(form.newCategory.trim())) {
      setForm({
        ...form,
        categories: [...form.categories, form.newCategory.trim()],
        newCategory: '',
      })
    }
  }

  const removeCategory = (index: number) => {
    setForm({
      ...form,
      categories: form.categories.filter((_, i) => i !== index),
    })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Validation
    if (!form.productName.trim()) {
      setError('Product name is required')
      setSubmitting(false)
      return
    }
    if (form.hasSubjects && form.subjects.length === 0) {
      setError('At least one special note is required when special notes are enabled')
      setSubmitting(false)
      return
    }
    if (form.hasSpecs && form.specs.length === 0) {
      setError('At least one spec is required when specs are enabled')
      setSubmitting(false)
      return
    }
    if (form.hasCategory && form.categories.length === 0) {
      setError('At least one series is required when series are enabled')
      setSubmitting(false)
      return
    }
    if (form.calculationType === 'level_based' && form.productLevels.length === 0) {
      setError('Level-based payment requires at least one term/level above')
      setSubmitting(false)
      return
    }
    if (form.calculationType === 'subject_based' && !form.hasSubjects) {
      setError('Subject-based payment requires Special Notes / subjects to be enabled with at least one entry')
      setSubmitting(false)
      return
    }

    try {
      const payload: any = {
        productName: form.productName.trim(),
        productLevels: form.productLevels,
        hasSubjects: form.hasSubjects,
        subjects: form.hasSubjects ? form.subjects : [],
        hasSpecs: form.hasSpecs,
        specs: form.hasSpecs ? form.specs : [],
        hasCategory: form.hasCategory,
        categories: form.hasCategory ? form.categories : [],
        prodStatus: form.prodStatus,
        calculationType: form.calculationType,
      }

      await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast.success('Product created successfully!')
      router.push('/dashboard/products')
      router.refresh() // Force refresh to reload products list
    } catch (err: any) {
      setError(err?.message || 'Failed to create product')
      toast.error(err?.message || 'Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin')) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-red-600">Access denied. Admin privileges required.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add New Product</h1>
          <p className="text-sm text-neutral-600 mt-1">Create a new product for the system</p>
        </div>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <Label>Product Name *</Label>
            <Input
              className="bg-white text-neutral-900 mt-1"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium text-neutral-900">Payment logic</p>
              <p className="text-xs text-neutral-600 mt-1">
                {form.calculationType === 'normal' && 'Normal: full amount is charged without division.'}
                {form.calculationType === 'level_based' &&
                  'Level-based: amount = (total students × price) ÷ distinct levels in the sale (per class).'}
                {form.calculationType === 'subject_based' &&
                  'Subject-based: amount = (total students × price) ÷ distinct subjects in the sale (per class).'}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setPaymentLogicOpen(true)} className="shrink-0">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Manage payment logic
            </Button>
          </div>

          <Dialog open={paymentLogicOpen} onOpenChange={setPaymentLogicOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Manage payment logic</DialogTitle>
                <DialogDescription>
                  Choose how the payable amount is divided. Configure terms/levels and special notes/subjects on the main form.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label>Calculation type</Label>
                <Select
                  value={form.calculationType}
                  onValueChange={(v: 'none' | 'level_based' | 'subject_based') =>
                    setForm({ ...form, calculationType: v })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="level_based">Level-Based</SelectItem>
                    <SelectItem value="subject_based">Subject-Based</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500">
                  Level-Based: Total amount is divided by number of levels (terms). Subject-Based: Total amount is divided by number of selected subjects. Normal: Full amount is charged without division.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setPaymentLogicOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div>
            <Label>Term</Label>
            <p className="text-xs text-neutral-500 mb-2">Add terms like Term 1, Term 2</p>
            <div className="flex gap-2 mb-2">
              <Input
                className="bg-white text-neutral-900"
                placeholder="Enter term (e.g., Term 1, Term 2)"
                value={form.newLevel}
                onChange={(e) => setForm({ ...form, newLevel: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLevel())}
              />
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {(['Term 1', 'Term 2', 'Term 3'] as const).map((term) => {
                const alreadyAdded = form.productLevels.includes(term)
                return (
                  <Button
                    key={term}
                    type="button"
                    onClick={() => addNamedTerm(term)}
                    variant="outline"
                    disabled={alreadyAdded}
                  >
                    Add {term}
                  </Button>
                )
              })}
            </div>
            {form.productLevels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.productLevels.map((level, idx) => (
                  <Badge key={idx} variant="outline" className="flex items-center gap-1 text-sm py-1 px-3">
                    {level}
                    <button
                      type="button"
                      onClick={() => removeLevel(idx)}
                      className="ml-1 hover:text-red-600 font-bold"
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
              checked={form.hasSubjects}
              onCheckedChange={(checked) =>
                setForm({ ...form, hasSubjects: checked as boolean })
              }
            />
            <Label htmlFor="hasSubjects" className="cursor-pointer font-medium">
              Special Notes
            </Label>
          </div>

          {form.hasSubjects && (
            <div>
              <Label>Special Notes *</Label>
              <p className="text-xs text-neutral-500 mb-2">Add one or multiple special notes</p>
              <div className="flex gap-2 mb-2">
                <Input
                  type="text"
                  className="bg-white text-neutral-900"
                  placeholder="Enter special note"
                  value={form.newSubject}
                  onChange={(e) => setForm({ ...form, newSubject: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                />
                <Button type="button" onClick={addSubject} variant="outline">
                  Add Special Note
                </Button>
              </div>
              {form.subjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.subjects.map((subject, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3">
                      {subject}
                      <button
                        type="button"
                        onClick={() => removeSubject(idx)}
                        className="ml-1 hover:text-red-600 font-bold"
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
              checked={form.hasSpecs}
              onCheckedChange={(checked) =>
                setForm({ ...form, hasSpecs: checked as boolean })
              }
            />
            <Label htmlFor="hasSpecs" className="cursor-pointer font-medium">
              Specs
            </Label>
          </div>

          {form.hasSpecs && (
            <div>
              <Label>Specs *</Label>
              <p className="text-xs text-neutral-500 mb-2">Add one or multiple specs</p>
              <div className="flex gap-2 mb-2">
                <Input
                  className="bg-white text-neutral-900"
                  placeholder="Enter spec name"
                  value={form.newSpec}
                  onChange={(e) => setForm({ ...form, newSpec: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpec())}
                />
                <Button type="button" onClick={addSpec} variant="outline">
                  Add Spec
                </Button>
              </div>
              {form.specs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.specs.map((spec, idx) => (
                    <Badge key={idx} variant="outline" className="flex items-center gap-1 text-sm py-1 px-3">
                      {spec}
                      <button
                        type="button"
                        onClick={() => removeSpec(idx)}
                        className="ml-1 hover:text-red-600 font-bold"
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
              id="hasCategory"
              checked={form.hasCategory}
              onCheckedChange={(checked) =>
                setForm({ ...form, hasCategory: checked as boolean })
              }
            />
            <Label htmlFor="hasCategory" className="cursor-pointer font-medium">
              Series
            </Label>
          </div>

          {form.hasCategory && (
            <div>
              <Label>Series *</Label>
              <p className="text-xs text-neutral-500 mb-2">Add one or multiple series</p>
              <div className="flex gap-2 mb-2">
                <Input
                  className="bg-white text-neutral-900"
                  placeholder="Enter series name"
                  value={form.newCategory}
                  onChange={(e) => setForm({ ...form, newCategory: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                />
                <Button type="button" onClick={addCategory} variant="outline">
                    Add Series
                </Button>
              </div>
              {form.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.categories.map((category, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3">
                      {category}
                      <button
                        type="button"
                        onClick={() => removeCategory(idx)}
                        className="ml-1 hover:text-red-600 font-bold"
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
              value={form.prodStatus.toString()}
              onValueChange={(v) => setForm({ ...form, prodStatus: Number(v) })}
            >
              <SelectTrigger className="bg-white text-neutral-900 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Available</SelectItem>
                <SelectItem value="0">Not Available</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 mt-1">
              0 = Not Available, 1 = Available
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Link href="/dashboard/products">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
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
                  Create Product
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

