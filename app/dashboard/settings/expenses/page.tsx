'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { getCurrentUser } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/permissions'
import { DEFAULT_TRAVEL_PER_KM_RATES } from '@/lib/expenseTravelRates'

/** Travel modes on the Create Expense form. */
const TRAVEL_MODES = ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto']

type ExpensePolicyForm = {
  skipFinanceStage: boolean
  foodBillMandatoryAbove: number
  requireTicketForModes: string
  bikeRatePerKm: string
  carRatePerKm: string
}

export default function ExpensePolicySettingsPage() {
  const [form, setForm] = useState<ExpensePolicyForm>({
    skipFinanceStage: false,
    foodBillMandatoryAbove: 500,
    requireTicketForModes: 'Bus, Train, Flight',
    bikeRatePerKm: String(DEFAULT_TRAVEL_PER_KM_RATES.bikeRatePerKm),
    carRatePerKm: String(DEFAULT_TRAVEL_PER_KM_RATES.carRatePerKm),
  })
  // Only Super Admin may change the Bike / Car per-km rates (the server enforces this too).
  const [canEditRates, setCanEditRates] = useState(false)
  useEffect(() => {
    setCanEditRates(isSuperAdmin(getCurrentUser() as any))
  }, [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest<{
      skipFinanceStage: boolean
      foodBillMandatoryAbove: number
      requireTicketForModes: string[]
      bikeRatePerKm?: number
      carRatePerKm?: number
    }>('/settings/expense-policy')
      .then((data) => {
        setForm({
          skipFinanceStage: Boolean(data.skipFinanceStage),
          foodBillMandatoryAbove: Number(data.foodBillMandatoryAbove) || 500,
          requireTicketForModes: (data.requireTicketForModes || []).join(', '),
          bikeRatePerKm: String(data.bikeRatePerKm || DEFAULT_TRAVEL_PER_KM_RATES.bikeRatePerKm),
          carRatePerKm: String(data.carRatePerKm || DEFAULT_TRAVEL_PER_KM_RATES.carRatePerKm),
        })
      })
      .catch(() => toast.error('Could not load expense policy'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    const bike = Number(form.bikeRatePerKm)
    const car = Number(form.carRatePerKm)
    if (canEditRates && (!(bike > 0) || !(car > 0))) {
      toast.error('Bike and Car rates must be greater than 0')
      return
    }
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
          ...(canEditRates ? { bikeRatePerKm: bike, carRatePerKm: car } : {}),
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
        <Label>Travel modes requiring bill / ticket upload</Label>
        <p className="text-xs text-neutral-500">Employees must upload a bill or ticket for these modes when they create a travel expense.</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {TRAVEL_MODES.map((mode) => {
            const selected = form.requireTicketForModes.split(',').map((s) => s.trim()).filter(Boolean)
            const checked = selected.some((s) => s.toLowerCase() === mode.toLowerCase())
            return (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={(e) => {
                    const rest = selected.filter((s) => s.toLowerCase() !== mode.toLowerCase())
                    setForm({ ...form, requireTicketForModes: (e.target.checked ? [...rest, mode] : rest).join(', ') })
                  }}
                />
                {mode}
              </label>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-neutral-900">Travel rates per km</h3>
          <p className="text-xs text-neutral-500">
            Bike and Car travel amounts are calculated as kilometres × rate.
            {canEditRates ? '' : ' Only Super Admin can change these rates.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bikeRate">Bike (₹ per km)</Label>
            <Input
              id="bikeRate"
              type="number"
              min="0.01"
              step="0.01"
              className="mt-1 bg-white"
              value={form.bikeRatePerKm}
              disabled={!canEditRates}
              onChange={(e) => setForm({ ...form, bikeRatePerKm: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="carRate">Car (₹ per km)</Label>
            <Input
              id="carRate"
              type="number"
              min="0.01"
              step="0.01"
              className="mt-1 bg-white"
              value={form.carRatePerKm}
              disabled={!canEditRates}
              onChange={(e) => setForm({ ...form, carRatePerKm: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
        {saving ? 'Saving…' : 'Save policy'}
      </Button>
    </Card>
  )
}
