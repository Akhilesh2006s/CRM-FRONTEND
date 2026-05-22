'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'

type SmsSettings = {
  senderId: string
  apiKey: string
  template: string
}

export default function SmsSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<SmsSettings>({
    senderId: '',
    apiKey: '',
    template: '',
  })

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadSettings()
  }, [router])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<SmsSettings>('/settings/sms')
      setForm({
        senderId: data.senderId || '',
        apiKey: data.apiKey || '',
        template: data.template || '',
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load SMS settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiRequest('/settings/sms', {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      toast.success('SMS settings saved')
      loadSettings()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save SMS settings')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-8 text-neutral-500">Loading SMS settings…</div>
  }

  return (
    <Card className="p-6 shadow-sm max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="senderId">Sender ID *</Label>
          <Input
            id="senderId"
            className="bg-white mt-1"
            value={form.senderId}
            onChange={(e) => setForm((f) => ({ ...f, senderId: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="apiKey">API Key *</Label>
          <Input
            id="apiKey"
            type="password"
            className="bg-white mt-1"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="template">Default Template</Label>
          <Textarea
            id="template"
            className="bg-white mt-1 min-h-[120px]"
            value={form.template}
            onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
            placeholder="Default SMS message template"
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {submitting ? 'Saving…' : 'Save Settings'}
        </Button>
      </form>
    </Card>
  )
}
