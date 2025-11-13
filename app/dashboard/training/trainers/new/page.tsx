'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'

export default function AddTrainerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    state: '', zone: '', cluster: '',
    trainerProducts: [] as string[],
    trainerLevels: '',
    trainerType: 'Employee',
    address1: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [checkingMobile, setCheckingMobile] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const checkMobileDuplicate = async (mobile: string) => {
    if (!mobile || mobile.length < 10) {
      setMobileError(null)
      return
    }
    setCheckingMobile(true)
    try {
      const trainers = await apiRequest<any[]>('/trainers')
      // Ensure trainers is an array before using array methods
      const trainersArray = Array.isArray(trainers) ? trainers : []
      const exists = trainersArray.some(t => t.mobile === mobile.trim())
      if (exists) {
        setMobileError('Mobile number already exists. Please use a different mobile number.')
      } else {
        setMobileError(null)
      }
    } catch (e) {
      // Silently fail - will check on submit
      setMobileError(null)
    } finally {
      setCheckingMobile(false)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mobileError) {
      toast.error('Please fix the mobile number error before submitting')
      return
    }
    if (!form.trainerProducts || form.trainerProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/trainers/create', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Trainer created successfully!')
      router.push('/dashboard/training/trainers/active')
    } catch (e: any) {
      const msg = e?.message || 'Failed to create trainer'
      if (msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('already exists')) {
        setMobileError('Mobile number already exists. Please use a different mobile number.')
      }
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleProduct = (p: string) => {
    setForm(f => ({ ...f, trainerProducts: f.trainerProducts.includes(p) ? f.trainerProducts.filter(x => x !== p) : [...f.trainerProducts, p] }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Trainer</h1>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Trainer Name *</Label>
            <Input className="bg-white text-neutral-900" value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} required />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input
              className={`bg-white text-neutral-900 ${mobileError ? 'border-red-500' : ''}`}
              value={form.mobile}
              onChange={(e) => {
                const value = e.target.value
                setForm(f => ({ ...f, mobile: value }))
                setMobileError(null) // Clear error on change
                if (debounceTimer.current) {
                  clearTimeout(debounceTimer.current)
                }
                if (value.length >= 10) {
                  debounceTimer.current = setTimeout(() => {
                    checkMobileDuplicate(value)
                  }, 500)
                }
              }}
              onBlur={() => {
                if (form.mobile && form.mobile.length >= 10) {
                  checkMobileDuplicate(form.mobile)
                }
              }}
              required
            />
            {checkingMobile && <p className="text-xs text-neutral-500 mt-1">Checking...</p>}
            {mobileError && <p className="text-xs text-red-600 mt-1">{mobileError}</p>}
          </div>
          <div>
            <Label>Email</Label>
            <Input className="bg-white text-neutral-900" type="email" value={form.email} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} />
          </div>
          <div>
            <Label>Trainer Type *</Label>
            <Select value={form.trainerType} onValueChange={(v)=>setForm(f=>({...f,trainerType:v}))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BDE">BDE</SelectItem>
                <SelectItem value="Employee">Employee</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
                <SelectItem value="Teachers">Teachers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>State</Label>
            <Input className="bg-white text-neutral-900" value={form.state} onChange={(e)=>setForm(f=>({...f,state:e.target.value}))} />
          </div>
          <div>
            <Label>Zone</Label>
            <Input className="bg-white text-neutral-900" value={form.zone} onChange={(e)=>setForm(f=>({...f,zone:e.target.value}))} />
          </div>
          <div>
            <Label>Cluster</Label>
            <Input className="bg-white text-neutral-900" value={form.cluster} onChange={(e)=>setForm(f=>({...f,cluster:e.target.value}))} />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea className="bg-white text-neutral-900" value={form.address1} onChange={(e)=>setForm(f=>({...f,address1:e.target.value}))} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1">Products *</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {['Abacus', 'Vedic Maths', 'EEL', 'IIT', 'Financial literacy', 'Brain bytes', 'Spelling bee', 'Skill pro', 'Maths lab', 'Codechamp'].map(p=> (
                <label key={p} className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.trainerProducts.includes(p)} onChange={()=>toggleProduct(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Levels</Label>
            <Input className="bg-white text-neutral-900" value={form.trainerLevels} onChange={(e)=>setForm(f=>({...f,trainerLevels:e.target.value}))} placeholder="e.g., AB-3, VM-2" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting?'Saving…':'Create Trainer'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


