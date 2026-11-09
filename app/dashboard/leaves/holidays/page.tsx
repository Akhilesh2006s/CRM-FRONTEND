'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { type Holiday, longDay } from '@/lib/leavePolicy'

type HolidaysResponse = { year: number | null; holidays: Holiday[]; perYear: number; canManage: boolean }

/**
 * Company holiday calendar: 12 paid holidays a year. HR / Admin enter them; everyone sees them.
 * Holidays are paid days; working on one (or a Sunday) earns a comp-off.
 */
export default function HolidayCalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<HolidaysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ date: '', name: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setData(await apiRequest<HolidaysResponse>(`/holidays?year=${year}`))
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Could not load holidays')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const holidays = data?.holidays || []
  const perYear = data?.perYear || 12
  const canManage = Boolean(data?.canManage)

  const reset = () => {
    setForm({ date: '', name: '' })
    setEditingId(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date || !form.name.trim()) {
      toast.error('Date and holiday name are required.')
      return
    }
    setSaving(true)
    try {
      await apiRequest(editingId ? `/holidays/${editingId}` : '/holidays', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ date: form.date, name: form.name.trim() }),
      })
      toast.success(editingId ? 'Holiday updated' : 'Holiday added')
      reset()
      const y = Number(form.date.slice(0, 4))
      if (y !== year) setYear(y)
      else await load()
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Could not save holiday')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (h: Holiday) => {
    if (!window.confirm(`Remove ${h.name} (${longDay(h.date)}) from the holiday calendar?`)) return
    try {
      await apiRequest(`/holidays/${h._id}`, { method: 'DELETE' })
      toast.success('Holiday removed')
      await load()
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Could not remove holiday')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Holiday Calendar</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Company paid holidays. Working on a company holiday or a Sunday is marked Holiday Worked and earns a comp-off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>‹ {year - 1}</Button>
          <span className="font-semibold w-14 text-center">{year}</span>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>{year + 1} ›</Button>
        </div>
      </div>

      {canManage && (
        <Card className="p-4 max-w-2xl">
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
            <div>
              <Label htmlFor="holidayDate">Date</Label>
              <Input
                id="holidayDate"
                type="date"
                className="bg-white mt-1"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="holidayName">Festival / event</Label>
              <Input
                id="holidayName"
                className="bg-white mt-1"
                placeholder="e.g. Diwali"
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{editingId ? 'Update' : 'Add Holiday'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-x-auto max-w-2xl">
        <div className="px-4 py-3 border-b font-medium text-neutral-900">
          Company Holidays ({holidays.length} / {perYear})
        </div>
        {loading ? (
          <div className="p-4">Loading…</div>
        ) : holidays.length === 0 ? (
          <div className="p-4 text-sm text-neutral-500">No holidays entered for {year}.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {holidays.map((h) => (
                <tr key={h._id} className="border-b last:border-0">
                  <td className="py-2 px-4 whitespace-nowrap">
                    {new Date(`${h.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-4">{h.name}</td>
                  {canManage && (
                    <td className="py-2 px-4 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(h._id)
                          setForm({ date: h.date, name: h.name })
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove(h)}>
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
