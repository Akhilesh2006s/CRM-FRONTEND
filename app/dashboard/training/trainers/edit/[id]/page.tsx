'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'
import { INDIAN_STATES } from '@/lib/indianStatesCities'
import {
  sanitizeTrainerMobileInput,
  validateTrainerMobile,
  validateTrainerEmail,
  validateTrainerZone,
  validateTrainerContactFields,
} from '@/lib/trainerFormValidation'

const TRAINER_CATEGORIES = ['Abacus', 'Vedic Maths', 'ECC', 'IIT']

const normalizeProducts = (products: string[] = []) =>
  products.map((p) => (p === 'EEL' ? 'ECC' : p))

export default function EditTrainerPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    state: '',
    zone: '',
    cluster: '',
    trainerProducts: [] as string[],
    trainerLevels: '',
    trainerAbacusLevels: '',
    trainerVedicLevels: '',
    trainerType: 'Employee',
    address1: '',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [zoneError, setZoneError] = useState<string | null>(null)
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})

  useEffect(() => {
    ;(async () => {
      try {
        const [pairsRaw, zonesRaw, trainer] = await Promise.all([
          apiRequest<{ zone?: string; cluster?: string }[]>('/zones-clusters').catch(() => []),
          apiRequest<{ name?: string }[]>('/zones').catch(() => []),
          apiRequest<any>(`/employees/${id}`),
        ])
        const pairs = Array.isArray(pairsRaw) ? pairsRaw : []
        const zoneDocs = Array.isArray(zonesRaw) ? zonesRaw : []
        const zoneMap: Record<string, string[]> = {}
        pairs.forEach((zc) => {
          const zone = (zc.zone || '').trim()
          if (!zone) return
          if (!zoneMap[zone]) zoneMap[zone] = []
          const cl = (zc.cluster || '').trim()
          if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl)
        })
        const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean)
        setZones([...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort())
        setClustersByZone(zoneMap)

        setForm({
          name: trainer.name || '',
          email: trainer.email || '',
          mobile: trainer.mobile || '',
          state: trainer.state || '',
          zone: trainer.zone || '',
          cluster: trainer.cluster || '',
          trainerProducts: normalizeProducts(trainer.trainerProducts || []),
          trainerLevels: trainer.trainerLevels || '',
          trainerAbacusLevels: trainer.trainerAbacusLevels || '',
          trainerVedicLevels: trainer.trainerVedicLevels || '',
          trainerType: trainer.trainerType || 'Employee',
          address1: trainer.address1 || '',
        })
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load trainer')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const stateOptions = useMemo(() => INDIAN_STATES.map((s) => ({ value: s, label: s })), [])
  const zoneOptions = useMemo(() => zones.map((z) => ({ value: z, label: z })), [zones])
  const clusterOptions = useMemo(() => {
    const list = form.zone ? clustersByZone[form.zone] || [] : []
    return list.map((c) => ({ value: c, label: c }))
  }, [form.zone, clustersByZone])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const contactCheck = validateTrainerContactFields({
      mobile: form.mobile,
      email: form.email,
      zone: form.zone,
    })
    if (!contactCheck.ok) {
      setMobileError(contactCheck.errors.mobile || null)
      setEmailError(contactCheck.errors.email || null)
      setZoneError(contactCheck.errors.zone || null)
      toast.error(
        contactCheck.errors.mobile ||
          contactCheck.errors.email ||
          contactCheck.errors.zone ||
          'Please fix the highlighted fields.'
      )
      return
    }
    setMobileError(null)
    setEmailError(null)
    setZoneError(null)

    if (!form.trainerProducts?.length) {
      toast.error('Please select at least one product category')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest(`/trainers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          mobile: contactCheck.values.mobile,
          email: contactCheck.values.email,
          zone: contactCheck.values.zone,
        }),
      })
      toast.success('Trainer updated successfully!')
      router.push('/dashboard/training/trainers/active')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update trainer')
    } finally {
      setSubmitting(false)
    }
  }

  const addProductCategory = (value: string) => {
    if (!value || form.trainerProducts.includes(value)) return
    setForm((f) => ({ ...f, trainerProducts: [...f.trainerProducts, value] }))
  }

  const removeProductCategory = (p: string) => {
    setForm((f) => ({ ...f, trainerProducts: f.trainerProducts.filter((x) => x !== p) }))
  }

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit Trainer</h1>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Trainer Name *</Label>
            <Input className="bg-white text-neutral-900" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input
              className={`bg-white text-neutral-900 ${mobileError ? 'border-red-500' : ''}`}
              type="tel"
              inputMode="numeric"
              maxLength={15}
              value={form.mobile}
              onChange={(e) => {
                const value = sanitizeTrainerMobileInput(e.target.value)
                setForm((f) => ({ ...f, mobile: value }))
                if (!value) {
                  setMobileError(null)
                } else {
                  const check = validateTrainerMobile(value)
                  setMobileError(check.ok ? null : check.message)
                }
              }}
              onBlur={() => {
                const check = validateTrainerMobile(form.mobile)
                setMobileError(check.ok ? null : check.message)
              }}
              required
            />
            {mobileError && <p className="text-xs text-red-600 mt-1">{mobileError}</p>}
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              className={`bg-white text-neutral-900 ${emailError ? 'border-red-500' : ''}`}
              type="email"
              value={form.email}
              onChange={(e) => {
                const value = e.target.value
                setForm((f) => ({ ...f, email: value }))
                if (!value.trim()) {
                  setEmailError(null)
                } else {
                  const check = validateTrainerEmail(value)
                  setEmailError(check.ok ? null : check.message)
                }
              }}
              onBlur={() => {
                const check = validateTrainerEmail(form.email)
                setEmailError(check.ok ? null : check.message)
              }}
              required
            />
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
          </div>
          <div>
            <Label>Employment Type *</Label>
            <Select value={form.trainerType} onValueChange={(v) => setForm((f) => ({ ...f, trainerType: v }))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Employee">Employee</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-state">State</Label>
            <SearchableSelect
              id="trainer-state"
              value={form.state}
              onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}
              placeholder="Select State"
              searchPlaceholder="Search states…"
              options={stateOptions}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-zone">Zone *</Label>
            <SearchableSelect
              id="trainer-zone"
              value={form.zone}
              onValueChange={(v) => {
                setForm((f) => ({ ...f, zone: v, cluster: '' }))
                const check = validateTrainerZone(v)
                setZoneError(check.ok ? null : check.message)
              }}
              placeholder="Select Zone"
              searchPlaceholder="Search zones…"
              options={zoneOptions}
            />
            {zoneError && <p className="text-xs text-red-600 mt-1">{zoneError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-cluster">Cluster</Label>
            <SearchableSelect
              id="trainer-cluster"
              value={form.cluster}
              onValueChange={(v) => setForm((f) => ({ ...f, cluster: v }))}
              placeholder={form.zone ? 'Select Cluster' : 'Select zone first'}
              searchPlaceholder="Search clusters…"
              options={clusterOptions}
              disabled={!form.zone}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea className="bg-white text-neutral-900" value={form.address1} onChange={(e) => setForm((f) => ({ ...f, address1: e.target.value }))} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Product Category *</Label>
            <Select onValueChange={addProductCategory}>
              <SelectTrigger className="bg-white text-neutral-900 max-w-md">
                <SelectValue placeholder="Select product category to add" />
              </SelectTrigger>
              <SelectContent>
                {TRAINER_CATEGORIES.filter((c) => !form.trainerProducts.includes(c)).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.trainerProducts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.trainerProducts.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-sm">
                    {p}
                    <button type="button" className="text-neutral-600 hover:text-red-600" onClick={() => removeProductCategory(p)} aria-label={`Remove ${p}`}>×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No categories selected</p>
            )}
          </div>
          {form.trainerProducts.includes('Abacus') && (
            <div className="md:col-span-2">
              <Label>Abacus levels known</Label>
              <Input className="bg-white text-neutral-900" value={form.trainerAbacusLevels} onChange={(e) => setForm((f) => ({ ...f, trainerAbacusLevels: e.target.value }))} />
            </div>
          )}
          {form.trainerProducts.includes('Vedic Maths') && (
            <div className="md:col-span-2">
              <Label>Vedic Maths levels known</Label>
              <Input className="bg-white text-neutral-900" value={form.trainerVedicLevels} onChange={(e) => setForm((f) => ({ ...f, trainerVedicLevels: e.target.value }))} />
            </div>
          )}
          <div className="md:col-span-2">
            <Label>Other levels (optional)</Label>
            <Input className="bg-white text-neutral-900" value={form.trainerLevels} onChange={(e) => setForm((f) => ({ ...f, trainerLevels: e.target.value }))} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
