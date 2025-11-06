'use client'

import { useEffect, useState, useMemo } from 'react'
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
  subject: string
  trainerId: { _id: string; name: string }
  trainingDate: string
  status: string
}

export default function TrainersDashboardPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    trainerId: '',
    zone: '',
    trainerType: '',
    subject: '',
    schoolCode: '',
    schoolName: '',
  })
  const [trainers, setTrainers] = useState<{ _id: string; name: string; trainerType?: string }[]>([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest<any[]>('/trainers?status=active')
        setTrainers(data)
      } catch {}
    })()
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.trainerId) params.append('trainerId', filters.trainerId)
      if (filters.zone) params.append('zone', filters.zone)
      if (filters.subject) params.append('subject', filters.subject)
      if (filters.schoolCode) params.append('schoolCode', filters.schoolCode)
      if (filters.schoolName) params.append('schoolName', filters.schoolName)
      if (dateRange.from) params.append('fromDate', dateRange.from)
      if (dateRange.to) params.append('toDate', dateRange.to)

      const data = await apiRequest<Training[]>(`/training?${params.toString()}`)
      setTrainings(data)
    } catch (e) {
      toast.error('Failed to load trainings')
    } finally {
      setLoading(false)
    }
  }

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Training[]>()
    trainings.forEach(t => {
      const d = new Date(t.trainingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(t)
    })
    return Array.from(map.entries()).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
  }, [trainings])

  const exportToExcel = () => {
    // Simple CSV export
    const headers = ['Trainer Name', 'Trainer Type', 'Levels', ...Array.from(groupedByDate.keys())]
    const rows: string[][] = []
    const trainerMap = new Map<string, { name: string; type?: string; levels?: string; dates: Map<string, string> }>()

    trainings.forEach(t => {
      const trainer = trainers.find(tr => tr._id === t.trainerId._id)
      if (!trainer) return
      const key = trainer._id
      if (!trainerMap.has(key)) {
        trainerMap.set(key, { name: trainer.name, type: trainer.trainerType, levels: (trainer as any).trainerLevels, dates: new Map() })
      }
      const dateStr = new Date(t.trainingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      const entry = trainerMap.get(key)!
      const existing = entry.dates.get(dateStr) || ''
      entry.dates.set(dateStr, existing ? `${existing}, ${t.schoolName}` : t.schoolName)
    })

    trainerMap.forEach((v, k) => {
      const row = [v.name, v.type || '', v.levels || '']
      groupedByDate.forEach(([date]) => {
        row.push(v.dates.get(date) || '')
      })
      rows.push(row)
    })

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trainings-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Trainers Dashboard</h1>
        <Button onClick={exportToExcel}>Export to Excel</Button>
      </div>
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Select value={filters.trainerId || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, trainerId: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Trainer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              {trainers.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.trainerType || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, trainerType: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Trainer Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="BDE">BDE</SelectItem>
              <SelectItem value="Employee">Employee</SelectItem>
              <SelectItem value="Freelancer">Freelancer</SelectItem>
              <SelectItem value="Teachers">Teachers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.subject || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, subject: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="Abacus">Abacus</SelectItem>
              <SelectItem value="Vedic Maths">Vedic Maths</SelectItem>
              <SelectItem value="EELL">EELL</SelectItem>
            </SelectContent>
          </Select>
          <Input className="bg-white text-neutral-900" placeholder="School Code" value={filters.schoolCode} onChange={(e) => setFilters(f => ({ ...f, schoolCode: e.target.value }))} />
          <Input className="bg-white text-neutral-900" type="date" placeholder="From Date" value={dateRange.from} onChange={(e) => setDateRange(r => ({ ...r, from: e.target.value }))} />
          <Input className="bg-white text-neutral-900" type="date" placeholder="To Date" value={dateRange.to} onChange={(e) => setDateRange(r => ({ ...r, to: e.target.value }))} />
          <Button type="submit" className="md:col-span-3">Search</Button>
        </form>
      </Card>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && groupedByDate.length === 0 && (
          <div className="p-4 text-center text-neutral-500">No trainings found</div>
        )}
        {!loading && groupedByDate.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left border">Trainer Name</th>
                <th className="py-2 px-3 text-left border">Trainer Type</th>
                <th className="py-2 px-3 text-left border">Levels</th>
                {groupedByDate.map(([date]) => (
                  <th key={date} className="py-2 px-3 text-left border whitespace-nowrap">{date}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(trainings.map(t => t.trainerId._id))).map(trainerId => {
                const trainer = trainers.find(t => t._id === trainerId)
                if (!trainer) return null
                return (
                  <tr key={trainerId} className="border-b last:border-0">
                    <td className="py-2 px-3 border">{trainer.name}</td>
                    <td className="py-2 px-3 border">{trainer.trainerType || '-'}</td>
                    <td className="py-2 px-3 border">{(trainer as any).trainerLevels || '-'}</td>
                    {groupedByDate.map(([date]) => {
                      const trainingsForDate = trainings.filter(t =>
                        t.trainerId._id === trainerId &&
                        new Date(t.trainingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) === date
                      )
                      return (
                        <td key={date} className="py-2 px-3 border text-xs">
                          {trainingsForDate.map(t => (
                            <div key={t._id}>{t.schoolName} ({t.schoolCode})</div>
                          ))}
                          {trainingsForDate.length === 0 && '-'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

