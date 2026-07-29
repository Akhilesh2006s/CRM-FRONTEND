'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

export default function CreateExecutiveManagerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest('/executive-managers/create', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password || undefined,
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
        }),
      })
      toast.success('Executive Manager created successfully')
      router.push('/dashboard/executive-managers')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create Executive Manager'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
          Create Executive Manager
        </h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard/executive-managers">All Managers</Link>
        </Button>
      </div>

      <Card className="p-4 md:p-6 max-w-xl bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={onChange}
              required
              className="bg-white"
              placeholder="Manager name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
              className="bg-white"
              placeholder="email@company.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              className="bg-white"
              placeholder="Leave blank for default (Password123)"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={onChange}
              className="bg-white"
              placeholder="Phone number"
            />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              name="department"
              value={form.department}
              onChange={onChange}
              className="bg-white"
              placeholder="Department"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Manager'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/executive-managers">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
