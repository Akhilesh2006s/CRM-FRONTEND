'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Database, Download } from 'lucide-react'

type BackupFile = {
  fileName: string
  size: number
  createdAt: string
}

type BackupSettings = {
  notificationEmail: string
  schedule: string
  lastRunAt?: string
  lastBackupFile?: string
  files: BackupFile[]
}

export default function DbBackupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [email, setEmail] = useState('')
  const [schedule, setSchedule] = useState('')
  const [settings, setSettings] = useState<BackupSettings | null>(null)

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
      const data = await apiRequest<BackupSettings>('/settings/backup')
      setSettings(data)
      setEmail(data.notificationEmail || '')
      setSchedule(data.schedule || '')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load backup settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Notification email is required')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/settings/backup', {
        method: 'PUT',
        body: JSON.stringify({ notificationEmail: email, schedule }),
      })
      toast.success('Backup settings saved')
      loadSettings()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleRunBackup = async () => {
    setRunning(true)
    try {
      const result = await apiRequest<{ fileName: string; message: string }>(
        '/settings/backup/run',
        { method: 'POST' }
      )
      toast.success(result.message || 'Backup created')
      loadSettings()
    } catch (err: any) {
      toast.error(err?.message || 'Backup failed')
    } finally {
      setRunning(false)
    }
  }

  const downloadBackup = async (fileName: string) => {
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(
        `${API_BASE_URL}/api/settings/backup/download/${encodeURIComponent(fileName)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err?.message || 'Download failed')
    }
  }

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  if (loading) {
    return <div className="py-8 text-neutral-500">Loading backup settings…</div>
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-sm max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="email">Notification Email *</Label>
            <Input
              id="email"
              type="email"
              className="bg-white mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="schedule">Schedule (optional)</Label>
            <Input
              id="schedule"
              className="bg-white mt-1"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g. daily at 2am — manual run only for now"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={running}
              onClick={handleRunBackup}
            >
              <Database className="h-4 w-4 mr-2" />
              {running ? 'Running…' : 'Run Backup Now'}
            </Button>
          </div>
        </form>
        {settings?.lastRunAt && (
          <p className="text-sm text-neutral-600 mt-4">
            Last backup: {formatDate(settings.lastRunAt)}
            {settings.lastBackupFile ? ` (${settings.lastBackupFile})` : ''}
          </p>
        )}
      </Card>

      <Card className="p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Backup Files</h2>
        {!settings?.files?.length ? (
          <p className="text-neutral-500">No backup files yet. Run a backup to create one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-600">
                  <th className="py-2 pr-4">File</th>
                  <th className="py-2 pr-4">Size</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {settings.files.map((f) => (
                  <tr key={f.fileName} className="border-b border-neutral-100">
                    <td className="py-3 pr-4 font-mono text-xs">{f.fileName}</td>
                    <td className="py-3 pr-4">{formatBytes(f.size)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(f.createdAt)}</td>
                    <td className="py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadBackup(f.fileName)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
