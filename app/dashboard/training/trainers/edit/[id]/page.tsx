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
          trainerProducts: trainer.trainerProducts || [],
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
    if (!form.trainerProducts?.length) {
      toast.error('Please select at least one product category')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest(`/trainers/${id}`, { method: 'PUT', body: JSON.stringify(form) })
      toast.success('Trainer updated successfully!')
      router.push('/dashboard/training/trainers/active')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update trainer')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleProduct = (p: string) => {
    setForm((f) => ({
      ...f,
      trainerProducts: f.trainerProducts.includes(p)
        ? f.trainerProducts.filter((x) => x !== p)
        : [...f.trainerProducts, p],
    }))
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
            <Input className="bg-white text-neutral-900" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="bg-white text-neutral-900" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
            <Label htmlFor="trainer-zone">Zone</Label>
            <SearchableSelect
              id="trainer-zone"
              value={form.zone}
              onValueChange={(v) => setForm((f) => ({ ...f, zone: v, cluster: '' }))}
              placeholder="Select Zone"
              searchPlaceholder="Search zones…"
              options={zoneOptions}
            />
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
          <div className="md:col-span-2">
            <Label className="mb-1">Product Category *</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {['Abacus', 'Vedic Maths', 'EEL', 'IIT'].map((p) => (
                <label key={p} className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.trainerProducts.includes(p)} onChange={() => toggleProduct(p)} />
                  {p}
                </label>
              ))}
            </div>
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
