'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Parcel services offered in the Transport Name dropdown; anything else is typed under Others. */
export const TRANSPORT_COMPANIES = ['APSRTC', 'TGSRTC', 'ANL', 'Navatha', 'DSPS', 'Kranthi', 'SRMT', 'Blue Dart', 'DTDC'] as const

/** Who collects the parcel at the transport office. */
export const TRANSPORT_TO_OPTIONS = [
  { value: 'BDE', label: 'BDE Name' },
  { value: 'School', label: 'School Name' },
  { value: 'Trainer', label: 'Trainer Name' },
  { value: 'Others', label: 'Others' },
] as const

export type TransportTo = {
  transport_to?: string
  transport_to_name?: string
  transport_to_mobile?: string
}

const isListedCompany = (name: string) =>
  (TRANSPORT_COMPANIES as readonly string[]).some((c) => c.toLowerCase() === name.trim().toLowerCase())

/** "BDE Name: Ravi (9876543210)" for read-only views and the DC printout. */
export function transportToLabel(v: TransportTo): string {
  if (!v.transport_to && !v.transport_to_name) return ''
  const kind = TRANSPORT_TO_OPTIONS.find((o) => o.value === v.transport_to)?.label || v.transport_to || ''
  const who = [v.transport_to_name, v.transport_to_mobile ? `(${v.transport_to_mobile})` : ''].filter(Boolean).join(' ')
  return [kind === 'Others' ? '' : kind, who].filter(Boolean).join(': ')
}

const selectClass = 'h-10 w-full rounded-md border bg-white px-3 text-sm text-neutral-900 disabled:opacity-60'

/** Transport Name: one of the parcel services, or Others with the name typed in. */
export function TransportNameField({
  value,
  onChange,
  disabled,
  label = 'Transport Name *',
}: {
  value: string
  onChange: (name: string) => void
  disabled?: boolean
  label?: string
}) {
  const listed = isListedCompany(value || '')
  const [others, setOthers] = useState(!listed && Boolean(String(value || '').trim()))
  useEffect(() => {
    if (String(value || '').trim() && !isListedCompany(value)) setOthers(true)
  }, [value])
  const selected = others ? 'Others' : (TRANSPORT_COMPANIES as readonly string[]).find((c) => c.toLowerCase() === String(value || '').trim().toLowerCase()) || ''
  return (
    <div>
      <Label>{label}</Label>
      <select
        aria-label="Transport name"
        className={selectClass}
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === 'Others') {
            setOthers(true)
            onChange(isListedCompany(value || '') ? '' : value || '')
          } else {
            setOthers(false)
            onChange(e.target.value)
          }
        }}
      >
        <option value="">Select transport</option>
        {TRANSPORT_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="Others">Others</option>
      </select>
      {others && (
        <Input
          className="mt-2 bg-white"
          value={value || ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter transport name"
        />
      )}
    </div>
  )
}

type Trainer = { _id: string; name?: string; phone?: string; mobile?: string }

/**
 * Transport To: BDE / School / Trainer / Others, with a name and mobile number. Picking BDE or School
 * fills the name and mobile from the order (editable); Trainer offers the trainer list.
 */
export function TransportToFields({
  value,
  onChange,
  disabled,
  bde,
  school,
}: {
  value: TransportTo
  onChange: (next: TransportTo) => void
  disabled?: boolean
  bde?: { name?: string; mobile?: string }
  school?: { name?: string; mobile?: string }
}) {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  useEffect(() => {
    if (value.transport_to !== 'Trainer' || trainers.length) return
    apiRequest<Trainer[]>('/trainers?status=active')
      .then((rows) => setTrainers(Array.isArray(rows) ? rows : []))
      .catch(() => setTrainers([]))
  }, [value.transport_to, trainers.length])

  const pick = (kind: string) => {
    if (kind === 'BDE') onChange({ transport_to: kind, transport_to_name: bde?.name || '', transport_to_mobile: bde?.mobile || '' })
    else if (kind === 'School') onChange({ transport_to: kind, transport_to_name: school?.name || '', transport_to_mobile: school?.mobile || '' })
    else onChange({ transport_to: kind, transport_to_name: '', transport_to_mobile: '' })
  }

  return (
    <>
      <div>
        <Label>Transport To *</Label>
        <select aria-label="Transport to" className={selectClass} value={value.transport_to || ''} disabled={disabled} onChange={(e) => pick(e.target.value)}>
          <option value="">Select who collects</option>
          {TRANSPORT_TO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <Label>{value.transport_to === 'Trainer' ? 'Trainer *' : 'Name *'}</Label>
        {value.transport_to === 'Trainer' && !disabled ? (
          <select
            aria-label="Trainer"
            className={selectClass}
            value={trainers.find((t) => t.name === value.transport_to_name)?._id || ''}
            onChange={(e) => {
              const t = trainers.find((x) => x._id === e.target.value)
              onChange({ ...value, transport_to_name: t?.name || '', transport_to_mobile: t?.mobile || t?.phone || value.transport_to_mobile || '' })
            }}
          >
            <option value="">{value.transport_to_name || 'Select trainer'}</option>
            {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        ) : (
          <Input
            className="bg-white"
            value={value.transport_to_name || ''}
            disabled={disabled || !value.transport_to}
            onChange={(e) => onChange({ ...value, transport_to_name: e.target.value })}
            placeholder="Name of the person collecting"
          />
        )}
      </div>
      <div>
        <Label>Mobile Number *</Label>
        <Input
          className="bg-white"
          inputMode="numeric"
          maxLength={10}
          value={value.transport_to_mobile || ''}
          disabled={disabled || !value.transport_to}
          onChange={(e) => onChange({ ...value, transport_to_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          placeholder="10-digit mobile"
        />
      </div>
    </>
  )
}

/** Error text when the Transport To block is incomplete, else ''. */
export function transportToError(v: TransportTo): string {
  if (!v.transport_to) return 'Select who the transport is to (BDE, School, Trainer or Others).'
  if (!String(v.transport_to_name || '').trim()) return 'Enter the name of the person collecting the parcel.'
  if (!/^\d{10}$/.test(String(v.transport_to_mobile || ''))) return 'Enter a 10-digit mobile number for Transport To.'
  return ''
}
