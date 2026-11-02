'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'

type Item = {
  _id: string
  title: string
  type: string
  url: string
  description?: string
  product?: string
  isActive?: boolean
}

const TYPES = [
  { value: 'brochure', label: 'Brochure' },
  { value: 'video', label: 'Video' },
  { value: 'ppt', label: 'PPT' },
  { value: 'link', label: 'Link' },
  { value: 'other', label: 'Other' },
]

/** Sales Collateral: Admin / Super Admin upload brochures and videos; everyone else views them. */
export default function SalesCollateralPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState('brochure')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const user = getCurrentUser() as { role?: string; isSuperAdmin?: boolean } | null
    setCanManage(user?.role === 'Admin' || user?.role === 'Super Admin' || Boolean(user?.isSuperAdmin))
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Item[]>(`/collateral${canManage ? '?active=0' : ''}`)
      setItems(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load collateral')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage])

  const uploadFile = async (picked: File): Promise<string> => {
    const body = new FormData()
    body.append('file', picked)
    const res = await fetch(`${API_BASE_URL}/api/collateral/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.url) throw new Error(data?.message || 'Upload failed')
    return data.url
  }

  const add = async () => {
    if (!title.trim()) return toast.error('Enter the title')
    if (!file && !url.trim()) return toast.error('Choose a file to upload or enter a link')
    setSaving(true)
    try {
      const link = file ? await uploadFile(file) : url.trim()
      await apiRequest('/collateral', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), url: link, type, description }),
      })
      setTitle('')
      setUrl('')
      setFile(null)
      setDescription('')
      toast.success('Collateral added')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: Item) => {
    try {
      await apiRequest(`/collateral/${item._id}`, { method: 'PUT', body: JSON.stringify({ isActive: item.isActive === false }) })
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sales Collateral</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Brochures, videos and PPTs for school visits{canManage ? '' : '. Uploaded by Admin.'}
        </p>
      </div>

      {canManage ? (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Title *</Label>
              <Input className="bg-white" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input className="bg-white" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Upload file (brochure PDF / image / PPT / video, up to 200 MB)</Label>
              <Input
                className="bg-white"
                type="file"
                accept="application/pdf,image/*,video/*,.ppt,.pptx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Or link (YouTube / Drive)</Label>
              <Input className="bg-white" value={url} disabled={Boolean(file)} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <Button type="button" onClick={add} disabled={saving} className="w-full">
              {saving ? 'Uploading…' : 'Add'}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">No collateral yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">View</th>
                {canManage ? <th className="px-3 py-2 text-left">Active</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-t">
                  <td className="px-3 py-2 font-medium">{item.title}</td>
                  <td className="px-3 py-2 capitalize">{item.type}</td>
                  <td className="px-3 py-2 text-neutral-600">{item.description || '—'}</td>
                  <td className="px-3 py-2">
                    <a href={resolveUploadUrl(item.url) || item.url} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                      {item.type === 'video' ? 'Play' : 'Open'}
                    </a>
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <button className="text-sky-700 underline" onClick={() => toggleActive(item)}>
                        {item.isActive === false ? 'No (show)' : 'Yes (hide)'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
