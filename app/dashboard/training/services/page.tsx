'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil } from 'lucide-react'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { toast } from 'sonner'

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
}

export default function ServicesListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    zone: '',
    employeeId: '',
    trainerId: '',
    schoolCode: '',
    schoolName: '',
    fromDate: '',
    toDate: '',
  })
  const [zones, setZones] = useState<string[]>([])
  const [trainers, setTrainers] = useState<{ _id: string; name: string }[]>([])
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])

  useEffect(() => {
    (async () => {
      try {
        const [zData, tData, eData] = await Promise.all([
          apiRequest<any[]>('/dc-orders'),
          apiRequest<any[]>('/trainers?status=active'),
          apiRequest<any[]>('/employees?isActive=true'),
        ])
        const uniqueZones = [...new Set((zData || []).map((d: any) => d.zone).filter(Boolean))]
        setZones(uniqueZones)
        setTrainers(tData)
        setEmployees(eData)
      } catch {}
    })()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v)
      })
      const data = await apiRequest<Service[]>(`/services?${params.toString()}`)
      setItems(data)
    } catch (e) {
      toast.error('Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  // Refresh data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        load()
      }
    }

    const handleFocus = () => {
      load()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [load])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Services List</h1>
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={filters.zone || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, zone: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.employeeId || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, employeeId: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(e => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.trainerId || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, trainerId: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Trainer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              {trainers.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="bg-white text-neutral-900" placeholder="By School Code" value={filters.schoolCode} onChange={(e) => setFilters(f => ({ ...f, schoolCode: e.target.value }))} />
          <Input className="bg-white text-neutral-900" placeholder="By School Name" value={filters.schoolName} onChange={(e) => setFilters(f => ({ ...f, schoolName: e.target.value }))} />
          <Input className="bg-white text-neutral-900" type="date" placeholder="From Date" value={filters.fromDate} onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))} />
          <Input className="bg-white text-neutral-900" type="date" placeholder="To Date" value={filters.toDate} onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))} />
          <Button type="submit" className="md:col-span-4">Search</Button>
        </form>
      </Card>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3">S.No</th>
                <th className="py-2 px-3 text-left">School Code</th>
                <th className="py-2 px-3 text-left">School Name</th>
                <th className="py-2 px-3">Zone</th>
                <th className="py-2 px-3">Town</th>
                <th className="py-2 px-3">Subject</th>
                <th className="py-2 px-3">Trainer</th>
                <th className="py-2 px-3">Term</th>
                <th className="py-2 px-3">Service Date</th>
                <th className="py-2 px-3">Remarks</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">PO Image</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={13} className="py-4 px-3 text-center text-neutral-500">No services found</td></tr>
              )}
              {items.map((s, idx) => (
                <tr key={s._id} className="border-b last:border-0">
                  <td className="py-2 px-3 text-center">{idx + 1}</td>
                  <td className="py-2 px-3">{s.schoolCode || '-'}</td>
                  <td className="py-2 px-3">{s.schoolName}</td>
                  <td className="py-2 px-3">{s.zone || '-'}</td>
                  <td className="py-2 px-3">{s.town || '-'}</td>
                  <td className="py-2 px-3">{s.subject}</td>
                  <td className="py-2 px-3">{s.trainerId?.name || '-'}</td>
                  <td className="py-2 px-3">{s.term || '-'}</td>
                  <td className="py-2 px-3 text-center">{new Date(s.serviceDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3">{s.remarks || '-'}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs ${
                      s.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      s.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {s.poImageUrl ? (
                      <a href={resolveUploadUrl(s.poImageUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                    ) : '-'}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => router.push(`/dashboard/training/services/edit/${s._id}`)}
                      className="flex items-center gap-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

