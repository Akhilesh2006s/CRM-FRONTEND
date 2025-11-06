'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'

export default function NewEmployeePage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    password: '',
    phone: '0',
    mobile: '',
    address1: '',
    state: '',
    zone: '',
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Employee',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload: any = {
        ...form,
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName || form.lastName || 'Employee',
      }
      await apiRequest('/employees/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      router.push('/dashboard/employees/active')
    } catch (err: any) {
      setError(err?.message || 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add New Employee</h1>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-lg font-semibold mb-2">Personal Data</div>
          
          <div>
            <Label>First Name *</Label>
            <Input className="bg-white text-neutral-900" name="firstName" value={form.firstName} onChange={onChange} placeholder="First Name" required />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input className="bg-white text-neutral-900" name="lastName" value={form.lastName} onChange={onChange} placeholder="Last Name" />
          </div>
          <div>
            <Label>Emp ID / Code</Label>
            <Input className="bg-white text-neutral-900" name="empCode" value={form.empCode} onChange={onChange} placeholder="Employee ID / Code" />
          </div>
          <div>
            <Label>Email Id *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} placeholder="Email" required />
          </div>
          <div>
            <Label>Phone</Label>
            <Input className="bg-white text-neutral-900" name="phone" value={form.phone} onChange={onChange} placeholder="Phone" />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input className="bg-white text-neutral-900" name="mobile" value={form.mobile} onChange={onChange} placeholder="Mobile" required />
          </div>
          <div className="md:col-span-2">
            <Label>Address 1</Label>
            <Textarea className="bg-white text-neutral-900" name="address1" value={form.address1} onChange={onChange} placeholder="Address 1" />
          </div>

          <div className="md:col-span-2 text-lg font-semibold mb-2 mt-4">Location & User Type</div>

          <div>
            <Label>State *</Label>
            <Input className="bg-white text-neutral-900" name="state" value={form.state} onChange={onChange} placeholder="Enter Employee State" required />
          </div>
          <div>
            <Label>Zone *</Label>
            <Input className="bg-white text-neutral-900" name="zone" value={form.zone} onChange={onChange} placeholder="Enter Employee Zone" required />
          </div>
          <div>
            <Label>Cluster *</Label>
            <Input className="bg-white text-neutral-900" name="cluster" value={form.cluster} onChange={onChange} placeholder="Enter Employee Cluster" required />
          </div>
          <div>
            <Label>District</Label>
            <Input className="bg-white text-neutral-900" name="district" value={form.district} onChange={onChange} placeholder="Enter Employee District" />
          </div>
          <div>
            <Label>City</Label>
            <Input className="bg-white text-neutral-900" name="city" value={form.city} onChange={onChange} placeholder="City" />
          </div>
          <div>
            <Label>PinCode</Label>
            <Input className="bg-white text-neutral-900" name="pincode" value={form.pincode} onChange={onChange} placeholder="Pincode" />
          </div>
          <div>
            <Label>User Type *</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Employee">Employee</SelectItem>
                <SelectItem value="Trainer">Trainer</SelectItem>
                <SelectItem value="Finance Manager">Finance Manager</SelectItem>
                <SelectItem value="Coordinator">Coordinator</SelectItem>
                <SelectItem value="Senior Coordinator">Senior Coordinator</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Executive">Executive</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Super Admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Password *</Label>
            <Input className="bg-white text-neutral-900" type="password" name="password" value={form.password} onChange={onChange} required />
          </div>

          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
