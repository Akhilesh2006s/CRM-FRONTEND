'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Upload, Eye } from 'lucide-react'
import { format } from 'date-fns'

type Training = {
  _id: string
  schoolName: string
  schoolCode?: string
  subject: string
  trainingDate: string
  completionDate?: string
  status: string
  feedbackPdfUrl?: string
  zone?: string
  town?: string
  trainerId: { _id: string; name: string }
  employeeId?: { _id: string; name: string }
  createdBy: { _id: string; name: string }
}

type Service = {
  _id: string
  schoolName: string
  schoolCode?: string
  subject: string
  serviceDate: string
  completionDate?: string
  status: string
  feedbackPdfUrl?: string
  zone?: string
  town?: string
  trainerId: { _id: string; name: string }
  employeeId?: { _id: string; name: string }
  createdBy: { _id: string; name: string }
}

const EMPTY_FILTERS = {
  zone: '',
  employeeId: '',
  trainerId: '',
  schoolCode: '',
  schoolName: '',
  fromDate: '',
  toDate: '',
}

export default function TrainerCompletedPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'training' | 'service'>('training')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [zones, setZones] = useState<string[]>([])
  const [trainers, setTrainers] = useState<{ _id: string; name: string }[]>([])
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadRef = useRef<{ id: string; type: 'training' | 'service' } | null>(null)

  const isPdfFile = (file: File) => {
    const name = file.name.toLowerCase()
    return file.type === 'application/pdf' || name.endsWith('.pdf')
  }

  useEffect(() => {
    ;(async () => {
      try {
        const [zData, tData, eData] = await Promise.all([
          apiRequest<any[]>('/dc-orders'),
          apiRequest<any[]>('/trainers?status=active'),
          apiRequest<any[]>('/employees?isActive=true'),
        ])
        const uniqueZones = [...new Set((zData || []).map((d: any) => d.zone).filter(Boolean))]
        setZones(uniqueZones)
        setTrainers(Array.isArray(tData) ? tData : [])
        setEmployees(Array.isArray(eData) ? eData : [])
      } catch {
        /* filter dropdowns optional */
      }
    })()
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const user = getCurrentUser()
      const isTrainer = user?.role === 'Trainer'
      const params = new URLSearchParams({ status: 'Completed' })
      if (isTrainer && user?._id) {
        params.append('trainerId', user._id)
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return
        if (isTrainer && key === 'trainerId') return
        params.append(key, value)
      })

      if (activeTab === 'training') {
        const data = await apiRequest<Training[]>(`/training?${params.toString()}`)
        setTrainings(Array.isArray(data) ? data.filter((t) => t.status === 'Completed') : [])
      } else {
        const data = await apiRequest<Service[]>(`/services?${params.toString()}`)
        setServices(Array.isArray(data) ? data.filter((s) => s.status === 'Completed') : [])
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [activeTab, filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleFileUpload = async (id: string, type: 'training' | 'service', file: File) => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    if (!isPdfFile(file)) {
      toast.error('Only PDF files are allowed')
      return
    }

    setUploading(id)
    try {
      const formData = new FormData()
      formData.append('feedback', file)

      const endpoint = type === 'training' ? `/training/${id}/upload-feedback` : `/services/${id}/upload-feedback`
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

      const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to upload feedback')
      }

      await response.json()
      toast.success('Feedback uploaded successfully')
      loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload feedback')
    } finally {
      setUploading(null)
    }
  }

  const openFilePicker = (id: string, type: 'training' | 'service') => {
    pendingUploadRef.current = { id, type }
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const pending = pendingUploadRef.current
    if (file && pending) {
      void handleFileUpload(pending.id, pending.type, file)
    }
    pendingUploadRef.current = null
    e.target.value = ''
  }

  const handleViewFeedback = (url: string) => {
    const resolved = resolveUploadUrl(url)
    if (!resolved) {
      toast.error('Feedback file URL is invalid')
      return
    }
    window.open(resolved, '_blank', 'noopener,noreferrer')
  }

  const isTrainer = getCurrentUser()?.role === 'Trainer'

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 mb-2">
          Completed Training & Services (Closure + proof)
        </h1>
        <p className="text-neutral-600">
          Audit and documentation after delivery. Upload feedback PDF for completed trainings and services.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('training')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'training'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Completed Trainings
        </button>
        <button
          onClick={() => setActiveTab('service')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'service'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Completed Services
        </button>
      </div>

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            loadData()
          }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <Select
            value={filters.zone || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, zone: v === 'all' ? '' : v }))}
          >
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Select Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.employeeId || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v === 'all' ? '' : v }))}
          >
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Select Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.trainerId || 'all'}
            onValueChange={(v) => setFilters((f) => ({ ...f, trainerId: v === 'all' ? '' : v }))}
            disabled={isTrainer}
          >
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Select Trainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              {trainers.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="bg-white text-neutral-900"
            placeholder="By School Code"
            value={filters.schoolCode}
            onChange={(e) => setFilters((f) => ({ ...f, schoolCode: e.target.value }))}
          />
          <Input
            className="bg-white text-neutral-900"
            placeholder="By School Name"
            value={filters.schoolName}
            onChange={(e) => setFilters((f) => ({ ...f, schoolName: e.target.value }))}
          />
          <div className="space-y-2">
            <Label htmlFor="completed-from-date">From Date</Label>
            <Input
              id="completed-from-date"
              className="bg-white text-neutral-900"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="completed-to-date">To Date</Label>
            <Input
              id="completed-to-date"
              className="bg-white text-neutral-900"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
            />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <Button type="submit" className="flex-1">
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Card className="p-4">Loading...</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          {activeTab === 'training' ? (
            trainings.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No completed trainings</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-50/70 border-b text-neutral-700">
                    <th className="py-3 px-4 text-left border">Training</th>
                    <th className="py-3 px-4 text-left border">Client</th>
                    <th className="py-3 px-4 text-left border">Zone</th>
                    <th className="py-3 px-4 text-left border">Trainer</th>
                    <th className="py-3 px-4 text-left border">Starting Date</th>
                    <th className="py-3 px-4 text-left border">Completion Status</th>
                    <th className="py-3 px-4 text-left border">Completion Date</th>
                    <th className="py-3 px-4 text-left border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map((training) => (
                    <tr key={training._id} className="border-b hover:bg-neutral-50">
                      <td className="py-3 px-4 border">{training.subject}</td>
                      <td className="py-3 px-4 border">
                        {training.schoolName}
                        {training.schoolCode && ` (${training.schoolCode})`}
                      </td>
                      <td className="py-3 px-4 border">{training.zone || '-'}</td>
                      <td className="py-3 px-4 border">{training.trainerId?.name || '-'}</td>
                      <td className="py-3 px-4 border">
                        {format(new Date(training.trainingDate), 'dd-MMM-yyyy')}
                      </td>
                      <td className="py-3 px-4 border">
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                          {training.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 border">
                        {training.completionDate
                          ? format(new Date(training.completionDate), 'dd-MMM-yyyy')
                          : '-'}
                      </td>
                      <td className="py-3 px-4 border">
                        <div className="flex gap-2">
                          {!training.feedbackPdfUrl ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={uploading === training._id}
                              className="flex items-center gap-1"
                              onClick={() => openFilePicker(training._id, 'training')}
                            >
                              <Upload className="w-4 h-4" />
                              {uploading === training._id ? 'Uploading...' : 'Upload Feedback PDF'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewFeedback(training.feedbackPdfUrl!)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              View Uploaded File
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : services.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No completed services</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-50/70 border-b text-neutral-700">
                  <th className="py-3 px-4 text-left border">Service</th>
                  <th className="py-3 px-4 text-left border">Client</th>
                  <th className="py-3 px-4 text-left border">Zone</th>
                  <th className="py-3 px-4 text-left border">Trainer</th>
                  <th className="py-3 px-4 text-left border">Starting Date</th>
                  <th className="py-3 px-4 text-left border">Completion Status</th>
                  <th className="py-3 px-4 text-left border">Completion Date</th>
                  <th className="py-3 px-4 text-left border">Action</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service._id} className="border-b hover:bg-neutral-50">
                    <td className="py-3 px-4 border">{service.subject}</td>
                    <td className="py-3 px-4 border">
                      {service.schoolName}
                      {service.schoolCode && ` (${service.schoolCode})`}
                    </td>
                    <td className="py-3 px-4 border">{service.zone || '-'}</td>
                    <td className="py-3 px-4 border">{service.trainerId?.name || '-'}</td>
                    <td className="py-3 px-4 border">
                      {format(new Date(service.serviceDate), 'dd-MMM-yyyy')}
                    </td>
                    <td className="py-3 px-4 border">
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                        {service.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 border">
                      {service.completionDate
                        ? format(new Date(service.completionDate), 'dd-MMM-yyyy')
                        : '-'}
                    </td>
                    <td className="py-3 px-4 border">
                      <div className="flex gap-2">
                        {!service.feedbackPdfUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={uploading === service._id}
                            className="flex items-center gap-1"
                            onClick={() => openFilePicker(service._id, 'service')}
                          >
                            <Upload className="w-4 h-4" />
                            {uploading === service._id ? 'Uploading...' : 'Upload Feedback PDF'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewFeedback(service.feedbackPdfUrl!)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View Uploaded File
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  )
}
