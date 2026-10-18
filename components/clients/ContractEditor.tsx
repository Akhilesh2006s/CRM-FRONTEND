'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { ContractPeriod, type ContractFields } from '@/components/clients/ContractPeriod'

const toDateInput = (value?: string | Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : '')

/** Shows a client's contract; Admins can set its length and start date (the end date follows). */
export function ContractEditor({
  schoolId,
  contract,
  canEdit,
  onSaved,
}: {
  schoolId: string
  contract?: ContractFields | null
  canEdit: boolean
  onSaved?: (contract: ContractFields) => void
}) {
  const [editing, setEditing] = useState(false)
  const [years, setYears] = useState(String(contract?.contract_years || 1))
  const [start, setStart] = useState(toDateInput(contract?.contract_start))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!start) {
      toast.error('Choose the contract start date.')
      return
    }
    setSaving(true)
    try {
      const saved = await apiRequest<ContractFields>(`/dc-orders/${schoolId}/contract`, {
        method: 'PUT',
        body: JSON.stringify({ contract_years: Number(years), contract_start: start }),
      })
      toast.success('Contract saved')
      setEditing(false)
      onSaved?.(saved)
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the contract')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-3">
        <ContractPeriod contract={contract} />
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setYears(String(contract?.contract_years || 1))
              setStart(toDateInput(contract?.contract_start))
              setEditing(true)
            }}
          >
            {contract?.contract_end ? 'Edit contract' : 'Set contract'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label className="text-xs">Length</Label>
        <Select value={years} onValueChange={setYears}>
          <SelectTrigger className="w-28" aria-label="Contract length"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n} year{n > 1 ? 's' : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Start date</Label>
        <Input type="date" aria-label="Contract start date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
      </div>
      <Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
    </div>
  )
}
