'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export type SchoolAddress = { address?: string; location?: string; zone?: string }

/** School address and town (zone is read-only). Coordinators can unlock and correct them. */
export function SchoolAddressSection({
  dcOrderId,
  details,
  canEdit,
  onSaved,
}: {
  dcOrderId?: string
  details: SchoolAddress
  canEdit: boolean
  onSaved?: (details: SchoolAddress) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ address: details.address || '', location: details.location || '' })

  useEffect(() => {
    if (!editing) setDraft({ address: details.address || '', location: details.location || '' })
  }, [details, editing])

  const save = async () => {
    if (!dcOrderId) return
    setSaving(true)
    try {
      const payload = { address: draft.address.trim(), location: draft.location.trim() }
      await apiRequest(`/dc-orders/${dcOrderId}`, { method: 'PUT', body: JSON.stringify(payload) })
      onSaved?.(payload)
      setEditing(false)
      toast.success('Address updated')
    } catch (e: any) {
      toast.error(e?.message || 'Unable to update the address.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && dcOrderId && (
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save address'}</Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>Edit address</Button>
          )}
        </div>
      )}
      <div>
        <Label>Address</Label>
        <Textarea
          value={editing ? draft.address : details.address || 'N/A'}
          onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
          disabled={!editing}
          rows={4}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Zone</Label>
          <Input value={details.zone || '-'} disabled />
        </div>
        <div>
          <Label>Location/Town</Label>
          <Input
            value={editing ? draft.location : details.location || '-'}
            onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
            disabled={!editing}
          />
        </div>
      </div>
    </div>
  )
}
