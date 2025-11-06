'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Training = {
  _id: string
  schoolCode: string
  schoolName: string
  zone?: string
  town?: string
  subject: string
  trainerId: { _id: string; name: string; mobile?: string }
  employeeId?: { _id: string; name: string }
  trainingDate: string
  status: 'Scheduled' | 'Completed' | 'Cancelled'
  poImageUrl?: string
}

export default function TrainingsListPage() {
  const [items, setItems] = useState<Training[]>([])
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
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v)
      })
      const data = await apiRequest<Training[]>(`/training?${params.toString()}`)
      setItems(data)
    } catch (e) {
      toast.error('Failed to load trainings')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (id: string) => {
    if (!confirm('Cancel this training?')) return
    try {
      await apiRequest(`/training/${id}/cancel`, { method: 'PUT', body: JSON.stringify({}) })
      toast.success('Training cancelled')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel')
    }
  }

  const markCompleted = async (id: string) => {
    if (!confirm('Mark this training as completed?')) return
    try {
      await apiRequest(`/training/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Completed' }) })
      toast.success('Training marked as completed')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Trainings List</h1>
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
                <th className="py-2 px-3">Training Date</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">PO Image</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={11} className="py-4 px-3 text-center text-neutral-500">No trainings found</td></tr>
              )}
              {items.map((t, idx) => (
                <tr key={t._id} className="border-b last:border-0">
                  <td className="py-2 px-3 text-center">{idx + 1}</td>
                  <td className="py-2 px-3">{t.schoolCode}</td>
                  <td className="py-2 px-3">{t.schoolName}</td>
                  <td className="py-2 px-3">{t.zone || '-'}</td>
                  <td className="py-2 px-3">{t.town || '-'}</td>
                  <td className="py-2 px-3">{t.subject}</td>
                  <td className="py-2 px-3">{t.trainerId?.name || '-'}</td>
                  <td className="py-2 px-3 text-center">{new Date(t.trainingDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs ${
                      t.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      t.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {t.poImageUrl ? (
                      <a href={t.poImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                    ) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {t.status === 'Scheduled' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => markCompleted(t._id)}>Mark Completed</Button>
                          <Button size="sm" variant="destructive" onClick={() => cancel(t._id)}>Cancel</Button>
                        </>
                      )}
                    </div>
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

