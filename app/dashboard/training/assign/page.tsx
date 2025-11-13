'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'

type Trainer = { _id: string; name: string; trainerProducts?: string[] }
type Employee = { _id: string; name: string }
type DcOrder = { _id: string; school_name: string; zone?: string; location?: string }

export default function AssignTrainingServicePage() {
  const router = useRouter()
  const [type, setType] = useState<'training' | 'service'>('training')
  const [form, setForm] = useState({
    schoolCode: '',
    schoolName: '',
    zone: '',
    town: '',
    subject: '',
    trainerId: '',
    employeeId: '',
    date: '',
    status: 'Scheduled' as 'Scheduled' | 'Completed' | 'Cancelled',
  })
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schools, setSchools] = useState<DcOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [tData, eData, sData] = await Promise.all([
          apiRequest<Trainer[]>('/trainers?status=active'),
          apiRequest<Employee[]>('/employees?isActive=true'),
          apiRequest<DcOrder[]>('/dc-orders?status=completed'),
        ])
        setTrainers(tData)
        setEmployees(eData)
        setSchools(sData)
      } catch (e) {
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const onSchoolSelect = (code: string) => {
    const school = schools.find(s => s._id === code || (s as any).school_code === code)
    if (school) {
      setForm(f => ({
        ...f,
        schoolCode: (school as any).school_code || code,
        schoolName: school.school_name,
        zone: school.zone || '',
        town: school.location || '',
      }))
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const endpoint = type === 'training' ? '/training/create' : '/services/create'
      const payload = {
        ...form,
        [type === 'training' ? 'trainingDate' : 'serviceDate']: form.date,
        status: form.status,
      }
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) })
      toast.success(`${type === 'training' ? 'Training' : 'Service'} assigned successfully`)
      router.push(type === 'training' ? '/dashboard/training/list' : '/dashboard/training/services')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTrainers = form.subject ? trainers.filter(t => (t.trainerProducts || []).includes(form.subject)) : trainers

  if (loading) return <div className="text-neutral-900">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Assign Training / Service</h1>
        <div className="flex gap-2">
          <Button variant={type === 'training' ? 'default' : 'outline'} onClick={() => setType('training')}>Training</Button>
          <Button variant={type === 'service' ? 'default' : 'outline'} onClick={() => setType('service')}>Service</Button>
        </div>
      </div>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="mb-2 block">Search School</Label>
            <Select onValueChange={(v) => onSchoolSelect(v)}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select school from completed DC orders" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s._id} value={(s as any).school_code || s._id}>
                    {s.school_name} - {(s as any).school_code || s._id} {s.zone ? `(${s.zone})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>School Code *</Label>
            <Input className="bg-white text-neutral-900" value={form.schoolCode} onChange={(e) => {
              setForm(f => ({ ...f, schoolCode: e.target.value }))
              onSchoolSelect(e.target.value)
            }} required />
          </div>
          <div>
            <Label>School Name *</Label>
            <Input className="bg-white text-neutral-900" value={form.schoolName} onChange={(e) => setForm(f => ({ ...f, schoolName: e.target.value }))} required />
          </div>
          <div>
            <Label>Zone</Label>
            <Input className="bg-white text-neutral-900" value={form.zone} onChange={(e) => setForm(f => ({ ...f, zone: e.target.value }))} />
          </div>
          <div>
            <Label>Town</Label>
            <Input className="bg-white text-neutral-900" value={form.town} onChange={(e) => setForm(f => ({ ...f, town: e.target.value }))} />
          </div>
          <div>
            <Label>Subject *</Label>
            <Select value={form.subject} onValueChange={(v) => setForm(f => ({ ...f, subject: v }))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
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
            <Label>Trainer *</Label>
            <Select value={form.trainerId} onValueChange={(v) => setForm(f => ({ ...f, trainerId: v }))} disabled={!form.subject}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder={form.subject ? "Select trainer" : "Select subject first"} />
              </SelectTrigger>
              <SelectContent>
                {filteredTrainers.map(t => (
                  <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Employee (Executive)</Label>
            <Select value={form.employeeId} onValueChange={(v) => setForm(f => ({ ...f, employeeId: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{type === 'training' ? 'Training' : 'Service'} Date *</Label>
            <Input className="bg-white text-neutral-900" type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Assigning...' : `Assign ${type === 'training' ? 'Training' : 'Service'}`}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}






