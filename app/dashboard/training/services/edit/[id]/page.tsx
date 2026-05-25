'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { toast } from 'sonner'
import { Upload, Eye } from 'lucide-react'

type Service = {
  _id: string
  schoolCode?: string
  schoolName: string
  zone?: string
  town?: string
  subject: string
  trainerId: { _id: string; name: string; mobile?: string }
  employeeId?: { _id: string; name: string }
  serviceDate: string
  term?: string
  remarks?: string
  status: 'Scheduled' | 'Completed' | 'Cancelled'
  poImageUrl?: string
  feedbackPdfUrl?: string
}

export default function EditServicePage() {
  const router = useRouter()
  const params = useParams()
  const serviceId = params.id as string

  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFeedback, setUploadingFeedback] = useState(false)
  const [feedbackPdfUrl, setFeedbackPdfUrl] = useState<string | undefined>()
  const feedbackInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    status: 'Scheduled' as 'Scheduled' | 'Completed' | 'Cancelled',
    remarks: '',
  })

  const isPdfFile = (file: File) => {
    const name = file.name.toLowerCase()
    return file.type === 'application/pdf' || name.endsWith('.pdf')
  }

  useEffect(() => {
    if (serviceId) {
      loadService()
    }
  }, [serviceId])

  const loadService = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Service>(`/services/${serviceId}`)
      if (data) {
        setService(data)
        setForm({
          status: data.status || 'Scheduled',
          remarks: data.remarks || '',
        })
        setFeedbackPdfUrl(data.feedbackPdfUrl)
      } else {
        toast.error('Service not found')
        router.push('/dashboard/training/services')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load service')
      router.push('/dashboard/training/services')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedbackUpload = async (file: File) => {
    if (!isPdfFile(file)) {
      toast.error('Only PDF files are allowed')
      return
    }
    setUploadingFeedback(true)
    try {
      const formData = new FormData()
      formData.append('feedback', file)
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const response = await fetch(`${API_BASE_URL}/api/services/${serviceId}/upload-feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to upload feedback')
      }
      const result = await response.json()
      setFeedbackPdfUrl(result.feedbackPdfUrl || result.service?.feedbackPdfUrl)
      toast.success('Feedback form uploaded')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload feedback')
    } finally {
      setUploadingFeedback(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.status) {
      toast.error('Service Status is required')
      return
    }

    if (form.status === 'Completed' && !feedbackPdfUrl) {
      toast.error('Please upload the feedback form (PDF) for completed service visit')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        status: form.status,
      }
      
      // Only include remarks if it's provided
      if (form.remarks) {
        payload.remarks = form.remarks
      }

      await apiRequest(`/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Service updated successfully')
      router.push('/dashboard/training/services')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update service')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-4">Loading...</div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="space-y-6">
        <div className="p-4 text-center text-neutral-500">Service not found</div>
      </div>
    )
  }

  // Format address from zone, town
  const address = [service.zone, service.town].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 mb-2">Viswam Edutech - Services</h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-neutral-700">Edit Service Details</h2>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>School Code</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={service.schoolCode || ''}
                readOnly
              />
            </div>
            <div>
              <Label>School Name</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={service.schoolName || ''}
                readOnly
              />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={address || ''}
                readOnly
              />
            </div>
            <div>
              <Label>Product</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={service.subject || ''}
                readOnly
              />
            </div>
            <div>
              <Label>Trainer</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={service.trainerId?.name || ''}
                readOnly
              />
            </div>
            <div>
              <Label>Previous Scheduled Date</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value=""
                readOnly
                placeholder=""
              />
            </div>
            <div>
              <Label>Previous Schedule Remarks</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value=""
                readOnly
                placeholder=""
              />
            </div>
            <div>
              <Label>Service Date</Label>
              <Input
                type="date"
                className="bg-neutral-50 text-neutral-900"
                value={service.serviceDate ? new Date(service.serviceDate).toISOString().split('T')[0] : ''}
                readOnly
              />
            </div>
            <div>
              <Label>Service Status *</Label>
              <Select
                value={form.status}
                onValueChange={(v: 'Scheduled' | 'Completed' | 'Cancelled') => setForm(f => ({ ...f, status: v }))}
                required
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select Service Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                className="bg-white text-neutral-900"
                value={form.remarks}
                onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Enter remarks (optional)"
                rows={3}
              />
            </div>
            {form.status === 'Completed' && (
              <div className="md:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                <Label>Feedback Form (PDF) *</Label>
                <p className="text-sm text-neutral-600">
                  Upload the signed feedback form after the service visit is completed.
                </p>
                <input
                  ref={feedbackInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleFeedbackUpload(file)
                    e.target.value = ''
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingFeedback}
                    onClick={() => feedbackInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingFeedback ? 'Uploading...' : feedbackPdfUrl ? 'Replace PDF' : 'Upload PDF'}
                  </Button>
                  {feedbackPdfUrl && (
                    <Button type="button" variant="ghost" asChild>
                      <a href={resolveUploadUrl(feedbackPdfUrl)} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 mr-2" />
                        View feedback
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/training/services')}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Service'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

