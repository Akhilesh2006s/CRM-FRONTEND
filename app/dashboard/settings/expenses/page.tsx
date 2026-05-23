'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type ExpensePolicyForm = {
  skipFinanceStage: boolean
  foodBillMandatoryAbove: number
  requireTicketForModes: string
}

export default function ExpensePolicySettingsPage() {
  const [form, setForm] = useState<ExpensePolicyForm>({
    skipFinanceStage: false,
    foodBillMandatoryAbove: 500,
    requireTicketForModes: 'Bus, Train, Flight, Other',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest<{
      skipFinanceStage: boolean
      foodBillMandatoryAbove: number
      requireTicketForModes: string[]
    }>('/settings/expense-policy')
      .then((data) => {
        setForm({
          skipFinanceStage: Boolean(data.skipFinanceStage),
          foodBillMandatoryAbove: Number(data.foodBillMandatoryAbove) || 500,
          requireTicketForModes: (data.requireTicketForModes || []).join(', '),
        })
      })
      .catch(() => toast.error('Could not load expense policy'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await apiRequest('/settings/expense-policy', {
        method: 'PUT',
        body: JSON.stringify({
          skipFinanceStage: form.skipFinanceStage,
          foodBillMandatoryAbove: form.foodBillMandatoryAbove,
          requireTicketForModes: form.requireTicketForModes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      })
      toast.success('Expense policy saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-neutral-500">Loading…</div>

  return (
    <Card className="p-6 max-w-lg space-y-4">
      <p className="text-sm text-neutral-600">
        Configure reimbursement approval. When finance stage is skipped, manager approval is final.
      </p>

      <div className="flex items-center gap-2">
        <input
          id="skipFinance"
          type="checkbox"
          checked={form.skipFinanceStage}
          onChange={(e) => setForm({ ...form, skipFinanceStage: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="skipFinance">Skip finance review (manager approval is final)</Label>
      </div>

      <div>
        <Label>Food bill mandatory above (₹)</Label>
        <Input
          type="number"
          className="mt-1 bg-white"
          value={form.foodBillMandatoryAbove}
          onChange={(e) =>
            setForm({ ...form, foodBillMandatoryAbove: Number(e.target.value) || 0 })
          }
        />
      </div>

      <div>
        <Label>Travel modes requiring ticket upload (comma-separated)</Label>
        <Input
          className="mt-1 bg-white"
          value={form.requireTicketForModes}
          onChange={(e) => setForm({ ...form, requireTicketForModes: e.target.value })}
        />
      </div>

      <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
        {saving ? 'Saving…' : 'Save policy'}
      </Button>
    </Card>
  )
}
