'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { ArrowUpDown } from 'lucide-react'

type Training = {
  _id: string
  schoolCode: string
  schoolName: string
  subject: string
  trainerId: { _id: string; name: string }
  trainingDate: string
  status: string
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const formatDate = (date: Date): string => {
  const day = date.getDate()
  const month = MONTH_NAMES[date.getMonth()]
  const year = date.getFullYear().toString().slice(-2)
  return `${day}-${month}-${year}`
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
  const [trainers, setTrainers] = useState<{ _id: string; name: string; trainerType?: string; zone?: string; trainerLevels?: string }[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'date' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [sortDate, setSortDate] = useState<string | null>(null)

  // Generate date columns from today to 30 days later
  const dateColumns = useMemo(() => {
    const dates: string[] = []
    const today = new Date()
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(formatDate(date))
    }
    return dates
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.trainerId) params.append('trainerId', filters.trainerId)
      if (filters.zone) params.append('zone', filters.zone)
      if (filters.subject) params.append('subject', filters.subject)
      if (filters.schoolCode) params.append('schoolCode', filters.schoolCode)
      if (filters.schoolName) params.append('schoolName', filters.schoolName)
      if (filters.trainerType) params.append('trainerType', filters.trainerType)

      // Set date range from today to 30 days later
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 30)
      params.append('fromDate', today.toISOString().split('T')[0])
      params.append('toDate', endDate.toISOString().split('T')[0])

      const data = await apiRequest<Training[]>(`/training?${params.toString()}`)
      setTrainings(data)
    } catch (e) {
      toast.error('Failed to load trainings')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest<any[]>('/trainers?status=active')
        setTrainers(data)
        // Extract unique zones
        const uniqueZones = [...new Set((data || []).map(t => t.zone).filter(Boolean) as string[])]
        setZones(uniqueZones)
      } catch {}
    })()
    load()
  }, [load])

  const toggleSort = (field: 'name' | 'type') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const toggleDateSort = (date: string) => {
    if (sortDate === date) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortDate(date)
      setSortOrder('asc')
    }
  }

  // Get all active trainers with their data
  const trainerData = useMemo(() => {
    const trainerMap = new Map<string, { 
      id: string
      name: string
      type: string
      levels: string
      trainings: Training[]
    }>()

    // First, add all active trainers
    trainers.forEach(trainer => {
      trainerMap.set(trainer._id, {
        id: trainer._id,
        name: trainer.name,
        type: trainer.trainerType || '-',
        levels: trainer.trainerLevels || '-',
        trainings: []
      })
    })

    // Then, populate trainings for trainers who have them
    trainings.forEach(t => {
      const trainer = trainers.find(tr => tr._id === t.trainerId._id)
      if (!trainer) return
      
      const key = trainer._id
      if (trainerMap.has(key)) {
        trainerMap.get(key)!.trainings.push(t)
      }
    })

    return Array.from(trainerMap.values())
  }, [trainings, trainers])

  const visibleTrainerData = useMemo(() => {
    if (filters.trainerId) {
      return trainerData.filter((t) => t.id === filters.trainerId)
    }
    return trainerData
  }, [trainerData, filters.trainerId])

  // Sort trainer data
  const sortedTrainerData = useMemo(() => {
    const sorted = [...visibleTrainerData]
    
    if (sortBy === 'name') {
      sorted.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name)
        return sortOrder === 'asc' ? comparison : -comparison
      })
    } else if (sortBy === 'type') {
      sorted.sort((a, b) => {
        const comparison = a.type.localeCompare(b.type)
        return sortOrder === 'asc' ? comparison : -comparison
      })
    }
    
    return sorted
  }, [visibleTrainerData, sortBy, sortOrder])

  const exportToExcel = () => {
    const headers = ['Trainer Name', 'Trainer Type', 'Levels', ...dateColumns]
    const rows: string[][] = []

      sortedTrainerData.forEach(trainer => {
        const row = [trainer.name, trainer.type, trainer.levels]
        dateColumns.forEach(date => {
          const trainingsForDate = trainer.trainings.filter(t => {
            const trainingDate = formatDate(new Date(t.trainingDate))
            return trainingDate === date
          })
          const schoolNames = trainingsForDate.map(t => `${t.schoolName} (${t.schoolCode})`).join(', ')
          row.push(schoolNames || '')
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
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 mb-2">Viswam Edutech - Trainings Report</h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-neutral-700">Trainings History</h2>
          <Button onClick={exportToExcel}>Export to Excel</Button>
        </div>
      </div>
      
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Select Trainer</label>
            <Select value={filters.trainerId || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, trainerId: v === 'all' ? '' : v }))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Trainer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainers</SelectItem>
                {trainers.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Select Zone</label>
            <Select value={filters.zone || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, zone: v === 'all' ? '' : v }))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Select Subject</label>
            <Select value={filters.subject || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, subject: v === 'all' ? '' : v }))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
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
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Code</label>
            <Input className="bg-white text-neutral-900" placeholder="School Code" value={filters.schoolCode} onChange={(e) => setFilters(f => ({ ...f, schoolCode: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Name</label>
            <Input className="bg-white text-neutral-900" placeholder="School Name" value={filters.schoolName} onChange={(e) => setFilters(f => ({ ...f, schoolName: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Select Trainer Type</label>
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
          </div>
          <div className="md:col-span-3">
            <Button type="submit" className="w-full md:w-auto">Search</Button>
          </div>
        </form>
      </Card>
      
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && sortedTrainerData.length === 0 && (
          <div className="p-4 text-center text-neutral-500">No trainings found</div>
        )}
        {!loading && sortedTrainerData.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left border">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:underline">
                    Trainer Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2 px-3 text-left border">
                  <button onClick={() => toggleSort('type')} className="flex items-center gap-1 hover:underline">
                    Trainer Type <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2 px-3 text-left border">Levels</th>
                {dateColumns.map((date) => (
                  <th key={date} className="py-2 px-3 text-left border whitespace-nowrap">
                    <button onClick={() => toggleDateSort(date)} className="flex items-center gap-1 hover:underline">
                      {date} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTrainerData.map(trainer => (
                <tr key={trainer.id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="py-2 px-3 border">{trainer.name}</td>
                  <td className="py-2 px-3 border">{trainer.type}</td>
                  <td className="py-2 px-3 border">{trainer.levels}</td>
                  {dateColumns.map((date) => {
                    const trainingsForDate = trainer.trainings.filter(t => {
                      const trainingDate = formatDate(new Date(t.trainingDate))
                      return trainingDate === date
                    })
                    return (
                      <td key={date} className="py-2 px-3 border text-xs">
                        {trainingsForDate.length > 0 ? (
                          trainingsForDate.map(t => (
                            <div key={t._id}>{t.schoolName} ({t.schoolCode})</div>
                          ))
                        ) : (
                          '-'
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

