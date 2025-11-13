'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Eye, Edit, ArrowUpDown } from 'lucide-react'

type Trainer = { _id: string; name: string; email?: string; mobile?: string; zone?: string; trainerProducts?: string[]; trainerLevels?: string; trainerType?: string; state?: string; cluster?: string }

export default function ActiveTrainersPage() {
  const router = useRouter()
  const [items, setItems] = useState<Trainer[]>([])
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ zone: '', trainerType: '', product: '' })
  const [sortBy, setSortBy] = useState<'name' | 'zone' | 'type'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<string[]>([])
  
  const currentUser = getCurrentUser()
  const isCoordinator = currentUser?.role === 'Coordinator'

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('status', 'active')
      if (q) params.append('q', q)
      if (filters.zone) params.append('zone', filters.zone)
      if (filters.trainerType) params.append('type', filters.trainerType)
      const data = await apiRequest<Trainer[]>(`/trainers?${params.toString()}`)
      setItems(data)
      
      // Extract unique zones
      const uniqueZones = [...new Set((data || []).map(t => t.zone).filter(Boolean) as string[])]
      setZones(uniqueZones)
    } catch (e) {
      toast.error('Failed to load trainers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sortedItems = useMemo(() => {
    const sorted = [...items]
    sorted.sort((a, b) => {
      let aVal: any = a[sortBy]
      let bVal: any = b[sortBy]
      
      if (sortBy === 'name') {
        aVal = a.name?.toLowerCase() || ''
        bVal = b.name?.toLowerCase() || ''
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    
    // Apply product filter
    if (filters.product) {
      return sorted.filter(t => (t.trainerProducts || []).includes(filters.product))
    }
    
    return sorted
  }, [items, sortBy, sortOrder, filters.product])

  const resetPassword = async (id: string) => {
    if (!confirm('Reset password to Password123?')) return
    try {
      await apiRequest(`/trainers/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({}) })
      toast.success('Password reset to Password123')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset password')
    }
  }

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Active Trainers</h1>
        <Button onClick={() => router.push('/dashboard/training/trainers/new')}>Add Trainer</Button>
      </div>
      
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input 
            placeholder="Search name / email / mobile" 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            className="bg-white text-neutral-900" 
          />
          <Select value={filters.zone || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, zone: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Filter by Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.trainerType || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, trainerType: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="BDE">BDE</SelectItem>
              <SelectItem value="Employee">Employee</SelectItem>
              <SelectItem value="Freelancer">Freelancer</SelectItem>
              <SelectItem value="Teachers">Teachers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.product || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, product: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Filter by Product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="Abacus">Abacus</SelectItem>
              <SelectItem value="Vedic Maths">Vedic Maths</SelectItem>
              <SelectItem value="EEL">EEL</SelectItem>
              <SelectItem value="IIT">IIT</SelectItem>
              <SelectItem value="Financial literacy">Financial literacy</SelectItem>
              <SelectItem value="Brain bytes">Brain bytes</SelectItem>
              <SelectItem value="Spelling bee">Spelling bee</SelectItem>
              <SelectItem value="Skill pro">Skill pro</SelectItem>
              <SelectItem value="Maths lab">Maths lab</SelectItem>
              <SelectItem value="Codechamp">Codechamp</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="md:col-span-4">Search</Button>
        </form>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:underline">
                    Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2 px-3">Mobile</th>
                <th className="py-2 px-3">
                  <button onClick={() => toggleSort('zone')} className="flex items-center gap-1 hover:underline">
                    Zone <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2 px-3">State</th>
                <th className="py-2 px-3">Cluster</th>
                <th className="py-2 px-3 text-left">Products</th>
                <th className="py-2 px-3">Levels</th>
                <th className="py-2 px-3">
                  <button onClick={() => toggleSort('type')} className="flex items-center gap-1 hover:underline">
                    Type <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {!isCoordinator && <th className="py-2 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 && (
                <tr><td colSpan={isCoordinator ? 8 : 9} className="py-4 px-3 text-center text-neutral-500">No trainers found</td></tr>
              )}
              {sortedItems.map(t => (
                <tr key={t._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="py-2 px-3 text-left font-medium">{t.name}</td>
                  <td className="py-2 px-3">{t.mobile || '-'}</td>
                  <td className="py-2 px-3">{t.zone || '-'}</td>
                  <td className="py-2 px-3">{t.state || '-'}</td>
                  <td className="py-2 px-3">{t.cluster || '-'}</td>
                  <td className="py-2 px-3 text-left">
                    <div className="flex flex-wrap gap-1">
                      {(t.trainerProducts || []).map(p => (
                        <span key={p} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3">{t.trainerLevels || '-'}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs">{t.trainerType || '-'}</span>
                  </td>
                  {!isCoordinator && (
                    <td className="py-2 px-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/training/trainers/edit/${t._id}`)}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => resetPassword(t._id)}>Reset Password</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      
      {!loading && (
        <div className="text-sm text-neutral-500">
          Showing {sortedItems.length} of {items.length} trainers
        </div>
      )}
    </div>
  )
}







