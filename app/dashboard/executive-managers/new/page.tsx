'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { INDIAN_STATES, getCitiesForState } from '@/lib/indianStatesCities'

export default function NewExecutiveManagerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    mobile: '',
    department: '',
    state: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
  }, [])


  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSelectChange = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.state || form.state.trim() === '') {
      toast.error('Please select a state')
      return
    }
    
    setSubmitting(true)
    try {
      const payload: any = {
        ...form,
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName || form.lastName || 'Executive Manager',
        password: form.password || 'Password123',
        // Set state as assignedState
        state: form.state.trim(),
        assignedState: form.state.trim(),
      }
      await apiRequest('/executive-managers/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toast.success('Executive Manager created successfully!')
      router.push('/dashboard/executive-managers')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create Executive Manager')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Create Executive Manager</h1>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-lg font-semibold mb-2">Executive Manager Details</div>
          
          <div>
            <Label>First Name *</Label>
            <Input className="bg-white text-neutral-900" name="firstName" value={form.firstName} onChange={onChange} placeholder="First Name" required />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input className="bg-white text-neutral-900" name="lastName" value={form.lastName} onChange={onChange} placeholder="Last Name" />
          </div>
          <div>
            <Label>Email Id *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} placeholder="Email" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input className="bg-white text-neutral-900" type="password" name="password" value={form.password} onChange={onChange} placeholder="Leave empty for default (Password123)" />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input className="bg-white text-neutral-900" name="mobile" value={form.mobile} onChange={onChange} placeholder="Mobile Number" required />
          </div>
          <div>
            <Label>State *</Label>
            <Select 
              value={form.state || undefined} 
              onValueChange={(value) => {
                if (value) {
                  onSelectChange('state', value)
                }
              }}
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.state && (
              <p className="text-xs text-neutral-500 mt-1">
                {getCitiesForState(form.state).length} zone(s) (cities) will be available in {form.state}
              </p>
            )}
          </div>
          <div>
            <Label>Department</Label>
            <Input className="bg-white text-neutral-900" name="department" value={form.department} onChange={onChange} placeholder="Department" />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Executive Manager'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

