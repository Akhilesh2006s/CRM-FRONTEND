'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { BarChart3, TrendingUp, Download, GraduationCap, CheckCircle2 } from 'lucide-react'

type Stats = {
  total: number
  byStatus: { Scheduled: number; Completed: number; Cancelled: number }
  zoneStats: { _id: string; total: number; completed: number }[]
  subjectStats: { _id: string; total: number; completed: number }[]
}

export default function TrainingServiceReportsPage() {
  const [trainingStats, setTrainingStats] = useState<Stats | null>(null)
  const [serviceStats, setServiceStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    zone: '',
  })
  const [zones, setZones] = useState<string[]>([])

  useEffect(() => {
    loadStats()
    loadZones()
  }, [])

  const loadZones = async () => {
    try {
      const data = await apiRequest<any[]>('/dc-orders')
      const uniqueZones = [...new Set((data || []).map((d: any) => d.zone).filter(Boolean))]
      setZones(uniqueZones)
    } catch {}
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.fromDate) params.append('fromDate', filters.fromDate)
      if (filters.toDate) params.append('toDate', filters.toDate)
      if (filters.zone) params.append('zone', filters.zone)

      const [tStats, sStats] = await Promise.all([
        apiRequest<Stats>(`/training/stats?${params.toString()}`),
        apiRequest<Stats>(`/services/stats?${params.toString()}`),
      ])
      setTrainingStats(tStats)
      setServiceStats(sStats)
    } catch (e) {
      toast.error('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      filters,
      training: trainingStats,
      service: serviceStats,
    }

    const csv = [
      ['Training & Service Report', ''],
      ['Generated At', new Date().toLocaleString()],
      ['From Date', filters.fromDate || 'All'],
      ['To Date', filters.toDate || 'All'],
      ['Zone', filters.zone || 'All'],
      [''],
      ['TRAINING STATISTICS', ''],
      ['Total Trainings', trainingStats?.total || 0],
      ['Scheduled', trainingStats?.byStatus.Scheduled || 0],
      ['Completed', trainingStats?.byStatus.Completed || 0],
      ['Cancelled', trainingStats?.byStatus.Cancelled || 0],
      [''],
      ['SERVICE STATISTICS', ''],
      ['Total Services', serviceStats?.total || 0],
      ['Scheduled', serviceStats?.byStatus.Scheduled || 0],
      ['Completed', serviceStats?.byStatus.Completed || 0],
      ['Cancelled', serviceStats?.byStatus.Cancelled || 0],
      [''],
      ['ZONE-WISE TRAINING', ''],
      ['Zone', 'Total', 'Completed'],
      ...(trainingStats?.zoneStats || []).map(z => [z._id || 'N/A', z.total, z.completed]),
      [''],
      ['SUBJECT-WISE TRAINING', ''],
      ['Subject', 'Total', 'Completed'],
      ...(trainingStats?.subjectStats || []).map(s => [s._id, s.total, s.completed]),
    ]

    const csvContent = csv.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-service-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="space-y-6"><h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Training & Service Reports</h1><Card className="p-4">Loading...</Card></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Training & Service Reports</h1>
        <Button onClick={exportReport}>
          <Download className="w-4 h-4 mr-2" /> Export Report
        </Button>
      </div>

      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); loadStats() }} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            type="date"
            placeholder="From Date"
            value={filters.fromDate}
            onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))}
            className="bg-white text-neutral-900"
          />
          <Input
            type="date"
            placeholder="To Date"
            value={filters.toDate}
            onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))}
            className="bg-white text-neutral-900"
          />
          <Select value={filters.zone || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, zone: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Filter by Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit">Apply Filters</Button>
        </form>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Total Trainings</p>
              <p className="text-3xl font-bold text-blue-600">{trainingStats?.total || 0}</p>
            </div>
            <GraduationCap className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Completed Trainings</p>
              <p className="text-3xl font-bold text-green-600">{trainingStats?.byStatus.Completed || 0}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Total Services</p>
              <p className="text-3xl font-bold text-purple-600">{serviceStats?.total || 0}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-purple-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Completed Services</p>
              <p className="text-3xl font-bold text-green-600">{serviceStats?.byStatus.Completed || 0}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Zone-wise Analysis */}
      {trainingStats?.zoneStats && trainingStats.zoneStats.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Zone-wise Training Analysis
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Zone</th>
                  <th className="text-right py-2 px-3">Total Trainings</th>
                  <th className="text-right py-2 px-3">Completed</th>
                  <th className="text-right py-2 px-3">Scheduled</th>
                  <th className="text-right py-2 px-3">Cancelled</th>
                  <th className="text-right py-2 px-3">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {trainingStats.zoneStats.map((zone) => {
                  const scheduled = trainingStats.byStatus.Scheduled
                  const cancelled = trainingStats.byStatus.Cancelled
                  return (
                    <tr key={zone._id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium">{zone._id || 'N/A'}</td>
                      <td className="py-2 px-3 text-right">{zone.total}</td>
                      <td className="py-2 px-3 text-right text-green-600 font-medium">{zone.completed}</td>
                      <td className="py-2 px-3 text-right text-yellow-600">{scheduled}</td>
                      <td className="py-2 px-3 text-right text-red-600">{cancelled}</td>
                      <td className="py-2 px-3 text-right">
                        {zone.total > 0 ? Math.round((zone.completed / zone.total) * 100) : 0}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Subject-wise Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {trainingStats?.subjectStats && trainingStats.subjectStats.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Training by Subject
            </h2>
            <div className="space-y-3">
              {trainingStats.subjectStats.map((subj) => (
                <div key={subj._id} className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-neutral-900">{subj._id}</p>
                    <p className="text-lg font-bold text-blue-600">{subj.total}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Completed: {subj.completed}</span>
                    <span className="text-neutral-600">
                      {subj.total > 0 ? Math.round((subj.completed / subj.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${subj.total > 0 ? (subj.completed / subj.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {serviceStats?.subjectStats && serviceStats.subjectStats.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Service by Subject
            </h2>
            <div className="space-y-3">
              {serviceStats.subjectStats.map((subj) => (
                <div key={subj._id} className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-neutral-900">{subj._id}</p>
                    <p className="text-lg font-bold text-purple-600">{subj.total}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Completed: {subj.completed}</span>
                    <span className="text-neutral-600">
                      {subj.total > 0 ? Math.round((subj.completed / subj.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${subj.total > 0 ? (subj.completed / subj.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Training Status Breakdown</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium">Completed</span>
              <span className="font-bold text-green-600">{trainingStats?.byStatus.Completed || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium">Scheduled</span>
              <span className="font-bold text-yellow-600">{trainingStats?.byStatus.Scheduled || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium">Cancelled</span>
              <span className="font-bold text-red-600">{trainingStats?.byStatus.Cancelled || 0}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Service Status Breakdown</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium">Completed</span>
              <span className="font-bold text-green-600">{serviceStats?.byStatus.Completed || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium">Scheduled</span>
              <span className="font-bold text-yellow-600">{serviceStats?.byStatus.Scheduled || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium">Cancelled</span>
              <span className="font-bold text-red-600">{serviceStats?.byStatus.Cancelled || 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

