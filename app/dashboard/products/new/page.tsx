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
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const SPECS_OPTIONS = [
  'Regular',
  'Single Level only',
  'Class WorkBooks Only',
]

export default function NewProductPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
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

  const addLevel = () => {
    if (form.newLevel.trim() && !form.productLevels.includes(form.newLevel.trim())) {
      setForm({
        ...form,
        productLevels: [...form.productLevels, form.newLevel.trim()],
        newLevel: '',
      })
    }
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

  const addSpec = (spec: string) => {
    if (spec && !form.specs.includes(spec)) {
      setForm({
        ...form,
        specs: [...form.specs, spec],
      })
    }
  }

  const removeSpec = (index: number) => {
    setForm({
      ...form,
      specs: form.specs.filter((_, i) => i !== index),
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
      setError('At least one subject is required when subjects are enabled')
      setSubmitting(false)
      return
    }
    if (form.hasSpecs && form.specs.length === 0) {
      setError('At least one spec is required when specs are enabled')
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
        prodStatus: form.prodStatus,
      }

      await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast.success('Product created successfully!')
      router.push('/dashboard/products')
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

          <div>
            <Label>Product Levels</Label>
            <p className="text-xs text-neutral-500 mb-2">Add levels like L1, L2, L3, etc.</p>
            <div className="flex gap-2 mb-2">
              <Input
                className="bg-white text-neutral-900"
                placeholder="Enter level (e.g., L1, L2)"
                value={form.newLevel}
                onChange={(e) => setForm({ ...form, newLevel: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLevel())}
              />
              <Button type="button" onClick={addLevel} variant="outline">
                Add Level
              </Button>
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
              Has Subjects
            </Label>
          </div>

          {form.hasSubjects && (
            <div>
              <Label>Subjects *</Label>
              <p className="text-xs text-neutral-500 mb-2">Add one or multiple subjects</p>
              <div className="flex gap-2 mb-2">
                <Input
                  className="bg-white text-neutral-900"
                  placeholder="Enter subject name"
                  value={form.newSubject}
                  onChange={(e) => setForm({ ...form, newSubject: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                />
                <Button type="button" onClick={addSubject} variant="outline">
                  Add Subject
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
              Has Specs
            </Label>
          </div>

          {form.hasSpecs && (
            <div>
              <Label>Specs *</Label>
              <p className="text-xs text-neutral-500 mb-2">Select one or multiple specs</p>
              <Select
                onValueChange={(v) => addSpec(v)}
              >
                <SelectTrigger className="bg-white text-neutral-900 mt-1">
                  <SelectValue placeholder="Select a spec to add" />
                </SelectTrigger>
                <SelectContent>
                  {SPECS_OPTIONS.filter(spec => !form.specs.includes(spec)).map((spec) => (
                    <SelectItem key={spec} value={spec}>
                      {spec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

