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

type Training = {
  _id: string
  schoolCode?: string
  schoolName: string
  zone?: string
  town?: string
  subject: string
  trainerId: { _id: string; name: string; mobile?: string }
  employeeId?: { _id: string; name: string }
  trainingDate: string
  term?: string
  trainingLevel?: string
  remarks?: string
  status: 'Scheduled' | 'Completed' | 'Cancelled'
  poImageUrl?: string
  feedbackPdfUrl?: string
}

export default function EditTrainingPage() {
  const router = useRouter()
  const params = useParams()
  const trainingId = params.id as string

  const [training, setTraining] = useState<Training | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFeedback, setUploadingFeedback] = useState(false)
  const [feedbackPdfUrl, setFeedbackPdfUrl] = useState<string | undefined>()
  const feedbackInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    // Empty until user picks Completed/Cancelled (Scheduled is not a selectable update status)
    status: '' as '' | 'Completed' | 'Cancelled',
    remarks: '',
  })
  const [statusError, setStatusError] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  const isPdfFile = (file: File) => {
    const name = file.name.toLowerCase()
    return file.type === 'application/pdf' || name.endsWith('.pdf')
  }

  useEffect(() => {
    if (trainingId) {
      loadTraining()
    }
  }, [trainingId])

  const loadTraining = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Training>(`/training/${trainingId}`)
      if (data) {
        setTraining(data)
        setForm({
          // Only Completed/Cancelled are valid selections on this form
          status:
            data.status === 'Completed' || data.status === 'Cancelled'
              ? data.status
              : '',
          remarks: data.remarks || '',
        })
        setStatusError('')
        setFeedbackPdfUrl(data.feedbackPdfUrl)
      } else {
        toast.error('Training not found')
        router.push('/dashboard/training/list')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load training')
      router.push('/dashboard/training/list')
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
      const response = await fetch(`${API_BASE_URL}/api/training/${trainingId}/upload-feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to upload feedback')
      }
      const result = await response.json()
      setFeedbackPdfUrl(result.feedbackPdfUrl || result.training?.feedbackPdfUrl)
      setFeedbackError('')
      toast.success('Feedback form uploaded')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload feedback')
    } finally {
      setUploadingFeedback(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const status = typeof form.status === 'string' ? form.status.trim() : ''
    if (!status) {
      setStatusError('Training Status is required.')
      return
    }
    setStatusError('')

    if (status === 'Completed' && !feedbackPdfUrl) {
      setFeedbackError('Please upload the feedback form (PDF) for completed training.')
      return
    }
    setFeedbackError('')

    setSubmitting(true)
    try {
      const payload: Record<string, string> = {
        status,
      }

      // Only include remarks if it's provided
      if (form.remarks) {
        payload.remarks = form.remarks
      }

      await apiRequest(`/training/${trainingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Training updated successfully')
      router.push('/dashboard/training/list')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update training')
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

  if (!training) {
    return (
      <div className="space-y-6">
        <div className="p-4 text-center text-neutral-500">Training not found</div>
      </div>
    )
  }

  // Format address from zone, town
  const address = [training.zone, training.town].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 mb-2">Viswam Edutech - Trainings</h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-neutral-700">Edit Training Details</h2>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>School Code</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={training.schoolCode || ''}
                readOnly
              />
            </div>
            <div>
              <Label>School Name</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={training.schoolName || ''}
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
                value={training.subject || ''}
                readOnly
              />
            </div>
            <div>
              <Label>Trainer</Label>
              <Input
                className="bg-neutral-50 text-neutral-900"
                value={training.trainerId?.name || ''}
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
              <Label>Training Date</Label>
              <Input
                type="date"
                className="bg-neutral-50 text-neutral-900"
                value={training.trainingDate ? new Date(training.trainingDate).toISOString().split('T')[0] : ''}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="training-status">Training Status *</Label>
              <Select
                value={form.status || undefined}
                onValueChange={(v: 'Completed' | 'Cancelled') => {
                  setForm((f) => ({ ...f, status: v }))
                  setStatusError('')
                  if (v !== 'Completed') setFeedbackError('')
                }}
              >
                <SelectTrigger
                  id="training-status"
                  className={`bg-white text-neutral-900 ${statusError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  aria-invalid={!!statusError}
                  aria-describedby={statusError ? 'training-status-error' : undefined}
                >
                  <SelectValue placeholder="Select Training Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {statusError && (
                <p id="training-status-error" className="mt-1.5 text-sm text-red-600">
                  {statusError}
                </p>
              )}
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
                  Upload the signed feedback form after training is completed.
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
                {feedbackError && (
                  <p className="text-sm text-red-600">{feedbackError}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/training/list')}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Training'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

