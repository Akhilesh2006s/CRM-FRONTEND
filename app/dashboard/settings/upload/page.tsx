'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Download, Upload } from 'lucide-react'

type UploadEntry = {
  _id: string
  fileName: string
  originalName: string
  description: string
  dataType: string
  filePath: string
  uploadedByName: string
  createdAt: string
}

const DATA_TYPES = [
  { value: 'schools', label: 'Schools' },
  { value: 'employees', label: 'Employees' },
  { value: 'products', label: 'Products' },
  { value: 'other', label: 'Other' },
]

export default function DashboardDataUploadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [dataType, setDataType] = useState('other')

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadUploads()
  }, [router])

  const loadUploads = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<UploadEntry[]>('/settings/uploads')
      setUploads(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load upload history')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('description', description)
    formData.append('dataType', dataType)

    setUploading(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE_URL}/api/settings/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || 'Upload failed')
      }
      toast.success('File uploaded successfully')
      setFile(null)
      setDescription('')
      setDataType('other')
      const input = document.getElementById('dashboard-file') as HTMLInputElement | null
      if (input) input.value = ''
      loadUploads()
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-sm max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dashboard-file">File (CSV, Excel, or JSON) *</Label>
            <Input
              id="dashboard-file"
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="bg-white mt-1"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-xs text-neutral-500 mt-1">Max 10 MB</p>
          </div>
          <div>
            <Label>Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger className="bg-white mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              className="bg-white mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this upload"
            />
          </div>
          <Button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading…' : 'Upload File'}
          </Button>
        </form>
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Upload History</h2>
        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : uploads.length === 0 ? (
          <p className="text-neutral-500">No uploads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-600">
                  <th className="py-2 pr-4">File</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Uploaded By</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u._id} className="border-b border-neutral-100">
                    <td className="py-3 pr-4">{u.originalName || u.fileName}</td>
                    <td className="py-3 pr-4 capitalize">{u.dataType}</td>
                    <td className="py-3 pr-4 max-w-[200px] truncate" title={u.description}>
                      {u.description || '—'}
                    </td>
                    <td className="py-3 pr-4">{u.uploadedByName || '—'}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="py-3">
                      {u.filePath ? (
                        <a
                          href={resolveUploadUrl(u.filePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:underline"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
