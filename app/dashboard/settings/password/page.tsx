'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await apiRequest('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      toast.success('Password updated successfully')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 shadow-sm max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="oldPassword">Current Password</Label>
          <Input
            id="oldPassword"
            type="password"
            className="bg-white mt-1"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            className="bg-white mt-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <p className="text-xs text-neutral-500 mt-1">Minimum 6 characters</p>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            className="bg-white mt-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {submitting ? 'Updating…' : 'Change Password'}
        </Button>
      </form>
    </Card>
  )
}
