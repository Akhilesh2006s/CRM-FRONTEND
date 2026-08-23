'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export default function AddTrainerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    state: '', zone: '', cluster: '',
    trainerProducts: [] as string[],
    trainerLevels: '',
    trainerAbacusLevels: '',
    trainerVedicLevels: '',
    trainerType: 'Employee',
    address1: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [zoneError, setZoneError] = useState<string | null>(null)
  const [checkingMobile, setCheckingMobile] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})

  useEffect(() => {
    ;(async () => {
      try {
        const [pairsRaw, zonesRaw] = await Promise.all([
          apiRequest<{ zone?: string; cluster?: string }[]>('/zones-clusters').catch(() => []),
          apiRequest<{ name?: string }[]>('/zones').catch(() => []),
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
        const allZones = [...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort((a, b) =>
          a.localeCompare(b)
        )
        setZones(allZones)
        setClustersByZone(zoneMap)
      } catch (e) {
        console.error('Failed to load zones for trainer', e)
      }
    })()
  }, [])

  const clusterList = useMemo(() => {
    return form.zone ? clustersByZone[form.zone] || [] : []
  }, [form.zone, clustersByZone])

  const checkMobileDuplicate = async (mobile: string) => {
    const formatCheck = validateTrainerMobile(mobile)
    if (!formatCheck.ok) {
      setMobileError(formatCheck.message)
      return
    }
    setCheckingMobile(true)
    try {
      const trainers = await apiRequest<any[]>('/trainers')
      const trainersArray = Array.isArray(trainers) ? trainers : []
      const exists = trainersArray.some((t) => t.mobile === formatCheck.value)
      if (exists) {
        setMobileError('Mobile number already exists. Please use a different mobile number.')
      } else {
        setMobileError(null)
      }
    } catch (e) {
      setMobileError(null)
    } finally {
      setCheckingMobile(false)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

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
    setEmailError(null)
    setZoneError(null)

    if (mobileError && mobileError.toLowerCase().includes('already exists')) {
      toast.error('Please fix the mobile number error before submitting')
      return
    }

    if (!form.trainerProducts || form.trainerProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/trainers/create', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          mobile: contactCheck.values.mobile,
          email: contactCheck.values.email,
          zone: contactCheck.values.zone,
        }),
      })
      toast.success('Trainer created successfully!')
      router.push('/dashboard/training/trainers/active')
    } catch (e: any) {
      const msg = e?.message || 'Failed to create trainer'
      if (msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('already exists')) {
        setMobileError('Mobile number already exists. Please use a different mobile number.')
      }
      toast.error(msg)
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Trainer</h1>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Trainer Name *</Label>
            <Input className="bg-white text-neutral-900" value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} required />
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
                const formatCheck = validateTrainerMobile(value)
                if (!value) {
                  setMobileError(null)
                } else if (!formatCheck.ok) {
                  setMobileError(formatCheck.message)
                } else {
                  setMobileError(null)
                  if (debounceTimer.current) clearTimeout(debounceTimer.current)
                  debounceTimer.current = setTimeout(() => {
                    checkMobileDuplicate(value)
                  }, 500)
                }
              }}
              onBlur={() => {
                const formatCheck = validateTrainerMobile(form.mobile)
                if (!formatCheck.ok) {
                  setMobileError(formatCheck.message)
                  return
                }
                checkMobileDuplicate(form.mobile)
              }}
              required
            />
            {checkingMobile && <p className="text-xs text-neutral-500 mt-1">Checking...</p>}
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
            <Select value={form.trainerType} onValueChange={(v)=>setForm(f=>({...f,trainerType:v}))}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Employee">Employee</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="trainer-state">State</Label>
            <Select value={form.state} onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}>
              <SelectTrigger id="trainer-state" className="bg-white text-neutral-900">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="trainer-zone">Zone *</Label>
            <Select
              value={form.zone}
              onValueChange={(v) => {
                setForm((f) => ({ ...f, zone: v, cluster: '' }))
                const check = validateTrainerZone(v)
                setZoneError(check.ok ? null : check.message)
              }}
            >
              <SelectTrigger
                id="trainer-zone"
                className={`bg-white text-neutral-900 ${zoneError ? 'border-red-500' : ''}`}
              >
                <SelectValue placeholder={zones.length === 0 ? 'Add zones under Users → Zones' : 'Select Zone'} />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {zoneError && <p className="text-xs text-red-600 mt-1">{zoneError}</p>}
          </div>
          <div>
            <Label htmlFor="trainer-cluster">Cluster</Label>
            <Select
              value={form.cluster}
              onValueChange={(v) => setForm((f) => ({ ...f, cluster: v }))}
              disabled={!form.zone}
            >
              <SelectTrigger id="trainer-cluster" className="bg-white text-neutral-900">
                <SelectValue
                  placeholder={
                    !form.zone
                      ? 'Select zone first'
                      : clusterList.length === 0
                        ? 'Link clusters in Users → Zones'
                        : 'Select Cluster'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {clusterList.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea className="bg-white text-neutral-900" value={form.address1} onChange={(e)=>setForm(f=>({...f,address1:e.target.value}))} />
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
              <Input className="bg-white text-neutral-900" value={form.trainerAbacusLevels} onChange={(e)=>setForm(f=>({...f,trainerAbacusLevels:e.target.value}))} placeholder="e.g. Level 1–8" />
            </div>
          )}
          {form.trainerProducts.includes('Vedic Maths') && (
            <div className="md:col-span-2">
              <Label>Vedic Maths levels known</Label>
              <Input className="bg-white text-neutral-900" value={form.trainerVedicLevels} onChange={(e)=>setForm(f=>({...f,trainerVedicLevels:e.target.value}))} placeholder="e.g. Level 1–5" />
            </div>
          )}
          <div className="md:col-span-2">
            <Label>Other levels (optional)</Label>
            <Input className="bg-white text-neutral-900" value={form.trainerLevels} onChange={(e)=>setForm(f=>({...f,trainerLevels:e.target.value}))} placeholder="ECC / IIT notes" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting?'Saving…':'Create Trainer'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
