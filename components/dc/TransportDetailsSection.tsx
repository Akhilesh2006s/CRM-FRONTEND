'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { TransportNameField, TransportToFields, transportToError, transportToLabel } from '@/components/dc/TransportFields'

export type TransportDetails = {
  transport_name?: string
  transport_location?: string
  transportation_landmark?: string
  pincode?: string
  transport_to?: string
  transport_to_name?: string
  transport_to_mobile?: string
}

const SAVED_KEYS: (keyof TransportDetails)[] = [
  'transport_name', 'transport_location', 'transportation_landmark', 'pincode',
  'transport_to', 'transport_to_name', 'transport_to_mobile',
]

/** Plain text fields (Transport Name and Transport To have their own dropdowns). */
const FIELDS: { key: keyof TransportDetails; label: string }[] = [
  { key: 'transport_location', label: 'Transport Location' },
  { key: 'transportation_landmark', label: 'Transportation Landmark' },
  { key: 'pincode', label: 'Pincode' },
]

export function canEditTransportDetails(role?: string) {
  return role === 'Coordinator' || role === 'Senior Coordinator'
}

/** Transport details entered by the BDE. Coordinators can unlock and correct them. */
export function TransportDetailsSection({
  dcOrderId,
  details,
  canEdit,
  onSaved,
  title = 'Delivery and Address',
  bde,
  school,
}: {
  dcOrderId?: string
  details: TransportDetails
  canEdit: boolean
  onSaved?: (details: TransportDetails) => void
  title?: string
  /** Prefill for Transport To = BDE / School. */
  bde?: { name?: string; mobile?: string }
  school?: { name?: string; mobile?: string }
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<TransportDetails>(details)

  useEffect(() => {
    if (!editing) setDraft(details)
  }, [details, editing])

  const save = async () => {
    if (!dcOrderId) return
    const pincode = String(draft.pincode || '').trim()
    if (pincode && !/^\d{6}$/.test(pincode)) {
      toast.error('Pincode must be 6 digits.')
      return
    }
    const toProblem = draft.transport_to || draft.transport_to_name ? transportToError(draft) : ''
    if (toProblem) {
      toast.error(toProblem)
      return
    }
    setSaving(true)
    try {
      const payload = Object.fromEntries(SAVED_KEYS.map((key) => [key, String(draft[key] || '').trim()]))
      await apiRequest(`/dc-orders/${dcOrderId}`, { method: 'PUT', body: JSON.stringify(payload) })
      onSaved?.(payload)
      setEditing(false)
      toast.success('Transport details updated')
    } catch (e: any) {
      toast.error(e?.message || 'Unable to update transport details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-xl mb-1">{title}</h3>
          <p className="text-sm text-slate-500">Transport details entered by the BDE</p>
        </div>
        {canEdit && dcOrderId && (
          editing ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => { setDraft(details); setEditing(false) }}>Cancel</Button>
              <Button type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save transport details'}</Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>Edit transport details</Button>
          )
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {editing ? (
          <>
            <TransportNameField label="Transport Name" value={draft.transport_name || ''} onChange={(transport_name) => setDraft({ ...draft, transport_name })} />
            <TransportToFields value={draft} onChange={(next) => setDraft({ ...draft, ...next })} bde={bde} school={school} />
          </>
        ) : (
          <>
            <div>
              <Label className="text-sm font-medium mb-2 block">Transport Name</Label>
              <Input value={details.transport_name || ''} disabled className="h-11 text-sm" placeholder="-" />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Transport To</Label>
              <Input value={transportToLabel(details)} disabled className="h-11 text-sm" placeholder="-" />
            </div>
          </>
        )}
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <Label className="text-sm font-medium mb-2 block">{label}</Label>
            <Input
              value={(editing ? draft[key] : details[key]) || ''}
              disabled={!editing}
              inputMode={key === 'pincode' ? 'numeric' : undefined}
              maxLength={key === 'pincode' ? 6 : undefined}
              onChange={(e) => setDraft({
                ...draft,
                [key]: key === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value,
              })}
              className="h-11 text-sm"
              placeholder={editing ? label : '-'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
