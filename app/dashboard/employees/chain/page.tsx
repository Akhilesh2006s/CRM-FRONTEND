'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { displayRoleName } from '@/lib/roleLabels'

type ChainHead = { _id: string; name: string; role: string }

type ClientSchool = {
  id: string
  name: string
  code: string
  location: string
  status: string
}

export default function ChainPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [assignedTo, setAssignedTo] = useState('')
  const [heads, setHeads] = useState<ChainHead[]>([])
  const [loadingHeads, setLoadingHeads] = useState(true)
  const [schools, setSchools] = useState<ClientSchool[]>([])
  const [loadingSchools, setLoadingSchools] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const role = String(currentUser?.role || '')
  const isSuperAdmin = Boolean((currentUser as { isSuperAdmin?: boolean })?.isSuperAdmin)

  useEffect(() => {
    const allowed = role === 'Admin' || role === 'Super Admin' || isSuperAdmin
    if (!allowed) {
      toast.error('Admin only')
      router.push('/dashboard')
    }
  }, [role, isSuperAdmin, router])

  useEffect(() => {
    ;(async () => {
      setLoadingHeads(true)
      try {
        const [bdes, managers] = await Promise.all([
          apiRequest<any[]>('/employees?isActive=true&role=Executive').catch(() => []),
          apiRequest<any[]>('/employees?isActive=true&role=Executive%20Manager').catch(() => []),
        ])
        const mapUser = (u: any, fallbackRole: string): ChainHead | null => {
          const id = u?._id || u?.id
          if (!id) return null
          return { _id: String(id), name: u.name || 'Unknown', role: u.role || fallbackRole }
        }
        const combined = [
          ...(Array.isArray(bdes) ? bdes : []).map((u) => mapUser(u, 'Executive')),
          ...(Array.isArray(managers) ? managers : []).map((u) => mapUser(u, 'Executive Manager')),
        ].filter((u): u is ChainHead => Boolean(u) && u.name !== 'Unknown')
        const seen = new Set<string>()
        setHeads(combined.filter((u) => (seen.has(u._id) ? false : (seen.add(u._id), true))))
      } catch {
        setHeads([])
      } finally {
        setLoadingHeads(false)
      }
    })()
  }, [])

  const loadSchools = async () => {
    setLoadingSchools(true)
    try {
      const list = await apiRequest<ClientSchool[]>('/dc-orders/chain-candidates')
      setSchools(Array.isArray(list) ? list : [])
    } catch {
      setSchools([])
    } finally {
      setLoadingSchools(false)
    }
  }

  useEffect(() => {
    void loadSchools()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return schools
    return schools.filter((school) => {
      const label = `${school.name} ${school.code}`.toLowerCase()
      return label.includes(q)
    })
  }, [schools, query])

  const toggleSchool = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((item) => item !== id)
    })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (!assignedTo) throw new Error('Please assign a chain head.')
      if (selectedIds.length === 0) throw new Error('Select at least one existing client school.')
      const result = await apiRequest<{ message?: string; count?: number }>('/dc-orders/map-chain', {
        method: 'POST',
        body: JSON.stringify({ assigned_to: assignedTo, schoolIds: selectedIds }),
      })
      toast.success(result?.message || 'Schools mapped to the chain.')
      setAssignedTo('')
      setSelectedIds([])
      setQuery('')
      await loadSchools()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to map schools to the chain'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Chain</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Map schools that are already saved as clients. Chain head can be a BDE or a Zonal Manager. No zone or cluster.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
          <Label>Chain head *</Label>
          <Select value={assignedTo || undefined} onValueChange={setAssignedTo} disabled={loadingHeads}>
            <SelectTrigger className="bg-white mt-1">
              <SelectValue placeholder={loadingHeads ? 'Loading...' : 'Select BDE or Zonal Manager'} />
            </SelectTrigger>
            <SelectContent>
              {heads.map((head) => (
                <SelectItem key={head._id} value={head._id}>
                  {head.name} ({displayRoleName(head.role)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        <Card className="p-4 md:p-6 bg-neutral-50 border border-blue-200 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-blue-950">Existing client schools</h2>
              <p className="text-xs text-neutral-600 mt-1">
                {selectedIds.length} selected. Search by school name or school code.
              </p>
            </div>
            <div className="w-full md:w-72">
              <Label htmlFor="chain-school-search">Search</Label>
              <Input
                id="chain-school-search"
                className="bg-white mt-1"
                value={query}
                placeholder="School name or school code"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded border border-neutral-200 bg-white">
            {loadingSchools && <p className="p-4 text-sm text-neutral-600">Loading client schools...</p>}
            {!loadingSchools && filtered.length === 0 && (
              <p className="p-4 text-sm text-neutral-600">No client schools available to map.</p>
            )}
            {!loadingSchools &&
              filtered.map((school) => {
                const checked = selectedIds.includes(school.id)
                const label = school.code ? `${school.name} — ${school.code}` : school.name
                return (
                  <label
                    key={school.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-100 last:border-0 cursor-pointer hover:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer"
                      checked={checked}
                      onChange={(e) => toggleSchool(school.id, e.target.checked)}
                    />
                    <span className="text-sm text-neutral-900">{label}</span>
                  </label>
                )
              })}
          </div>
        </Card>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" disabled={submitting || loadingSchools}>
          {submitting ? 'Mapping schools...' : 'Map schools to chain'}
        </Button>
      </form>
    </div>
  )
}
