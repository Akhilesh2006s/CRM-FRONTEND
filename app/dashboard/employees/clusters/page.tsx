'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Cluster = { _id?: string; name: string }

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Cluster[]>('/clusters')
      setClusters(Array.isArray(data) ? data : [])
    } catch (e: any) {
      alert(e?.message || 'Failed to load clusters')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Cluster is required')
      return
    }
    const dup = clusters.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (dup) {
      toast.error('Cluster already exists')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/clusters', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
      })
      setName('')
      toast.success('Cluster added')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save cluster')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this cluster?')) return
    try {
      await apiRequest(`/clusters/${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete cluster')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Clusters</h1>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Cluster *</Label>
            <Input
              className="bg-white text-neutral-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Cluster"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add Cluster'}
            </Button>
            <Button type="button" variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </form>

        <Card className="p-0 overflow-x-auto bg-white border border-neutral-200">
          {loading ? (
            <div className="p-4 text-sm text-neutral-600">Loading clusters…</div>
          ) : clusters.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">No clusters added yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-100 border-b text-neutral-700">
                  <th className="py-2 px-3 text-left">Cluster</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((c) => (
                  <tr key={c._id || c.name} className="border-b last:border-0">
                    <td className="py-2 px-3">{c.name}</td>
                    <td className="py-2 px-3 text-right">
                      {c._id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => onDelete(c._id)}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Card>
    </div>
  )
}

