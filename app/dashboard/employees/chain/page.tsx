'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { getCurrentUser } from '@/lib/auth'
import { lookupPincode, type PostOfficeArea } from '@/lib/pincode'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'
import { displayRoleName } from '@/lib/roleLabels'
import {
  validateContactMobile,
  validateContactPerson,
  validateSchoolCode,
  validateSchoolName,
} from '@/lib/saleFormValidation'

const SCHOOL_TYPES = ['New', 'Existing'] as const

type ProductSelection = {
  name: string
  checked: boolean
  price: number
  quantity: number
  strength: number
}

type ChainHead = { _id: string; name: string; role: string }

type SchoolEntry = {
  id: string
  school_type: string
  school_name: string
  school_code: string
  contact_person: string
  contact_mobile: string
  email: string
  contact_person2: string
  contact_mobile2: string
  location: string
  address: string
  pincode: string
  state: string
  city: string
  region: string
  area: string
  lead_status: string
  strength: string
  remarks: string
  follow_up_date: string
  areas: PostOfficeArea[]
  pincodeError: string | null
  loadingPincode: boolean
  schoolCodeError: string | null
  checkingSchoolCode: boolean
  products: ProductSelection[]
}

function blankProducts(names: string[]): ProductSelection[] {
  return names.map((name) => ({ name, checked: false, price: 0, quantity: 1, strength: 0 }))
}

let schoolSeq = 0

function blankSchool(productNames: string[]): SchoolEntry {
  schoolSeq += 1
  return {
    id: `chain-school-${schoolSeq}`,
    school_type: '',
    school_name: '',
    school_code: '',
    contact_person: '',
    contact_mobile: '',
    email: '',
    contact_person2: '',
    contact_mobile2: '',
    location: '',
    address: '',
    pincode: '',
    state: '',
    city: '',
    region: '',
    area: '',
    lead_status: 'pending',
    strength: '',
    remarks: '',
    follow_up_date: '',
    areas: [],
    pincodeError: null,
    loadingPincode: false,
    schoolCodeError: null,
    checkingSchoolCode: false,
    products: blankProducts(productNames),
  }
}

export default function ChainPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProducts } = useProducts()
  const canPickProducts =
    currentUser?.role === 'Super Admin' ||
    currentUser?.role === 'Admin' ||
    Boolean((currentUser as { isSuperAdmin?: boolean })?.isSuperAdmin)

  const [assignedTo, setAssignedTo] = useState('')
  const [schools, setSchools] = useState<SchoolEntry[]>(() => [blankSchool([])])
  const [heads, setHeads] = useState<ChainHead[]>([])
  const [loadingHeads, setLoadingHeads] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const role = String(currentUser?.role || '')
  const isSuperAdmin = Boolean((currentUser as { isSuperAdmin?: boolean })?.isSuperAdmin)

  useEffect(() => {
    const allowed = role === 'Admin' || role === 'Super Admin' || isSuperAdmin
    if (!allowed) {
      toast.error('Admin only')
      router.push('/dashboard')
    }
  }, [role, isSuperAdmin, router])

  const productKey = availableProducts.join('\0')
  useEffect(() => {
    if (!canPickProducts || !productKey) return
    const names = productKey.split('\0')
    setSchools((prev) => {
      if (prev.every((school) => school.products.length > 0)) return prev
      return prev.map((school) =>
        school.products.length > 0 ? school : { ...school, products: blankProducts(names) }
      )
    })
  }, [productKey, canPickProducts])

  useEffect(() => {
    ;(async () => {
      setLoadingHeads(true)
      try {
        const [bdes, managers] = await Promise.all([
          apiRequest<any[]>('/employees?isActive=true&role=Executive').catch(() => []),
          apiRequest<any[]>('/employees?isActive=true&role=Executive%20Manager').catch(() => []),
        ])
        const mapUser = (u: any, fallbackRole: string): ChainHead | null => {
          const id = u?._id || u?.id
          if (!id) return null
          return { _id: String(id), name: u.name || 'Unknown', role: u.role || fallbackRole }
        }
        const combined = [
          ...(Array.isArray(bdes) ? bdes : []).map((u) => mapUser(u, 'Executive')),
          ...(Array.isArray(managers) ? managers : []).map((u) => mapUser(u, 'Executive Manager')),
        ].filter((u): u is ChainHead => Boolean(u) && u.name !== 'Unknown')
        const seen = new Set<string>()
        setHeads(combined.filter((u) => (seen.has(u._id) ? false : (seen.add(u._id), true))))
      } catch {
        setHeads([])
      } finally {
        setLoadingHeads(false)
      }
    })()
  }, [])

  const patchSchool = (id: string, patch: Partial<SchoolEntry>) => {
    setSchools((prev) => prev.map((school) => (school.id === id ? { ...school, ...patch } : school)))
  }

  const onField = (id: string, name: string, value: string) => {
    let nextValue = value
    if (name === 'contact_mobile' || name === 'contact_mobile2') {
      nextValue = value.replace(/\D/g, '').slice(0, 10)
    }
    if (name === 'school_name' && nextValue.length > 100) nextValue = nextValue.slice(0, 100)
    const extra: Partial<SchoolEntry> = { [name]: nextValue } as Partial<SchoolEntry>
    if (name === 'school_code') extra.schoolCodeError = null
    patchSchool(id, extra)
  }

  const checkSchoolCodeUnique = async (id: string, rawCode: string): Promise<boolean> => {
    const format = validateSchoolCode(rawCode)
    if (!format.ok) {
      patchSchool(id, { schoolCodeError: format.message })
      return false
    }
    const duplicateInForm = schools.some(
      (school) => school.id !== id && school.school_code.trim().toLowerCase() === format.value.toLowerCase()
    )
    if (duplicateInForm) {
      patchSchool(id, { schoolCodeError: 'This school code is already used for another school in this chain.' })
      return false
    }
    patchSchool(id, { checkingSchoolCode: true })
    try {
      const existing = await apiRequest<Array<{ schoolCode?: string }>>('/schools')
      const exists = (Array.isArray(existing) ? existing : []).some(
        (s) => (s.schoolCode || '').trim().toLowerCase() === format.value.toLowerCase()
      )
      if (exists) {
        patchSchool(id, { schoolCodeError: 'School Code already exists. Please enter a unique School Code.' })
        return false
      }
      patchSchool(id, { schoolCodeError: null })
      return true
    } catch {
      patchSchool(id, { schoolCodeError: null })
      return true
    } finally {
      patchSchool(id, { checkingSchoolCode: false })
    }
  }

  const handlePincodeChange = async (id: string, raw: string) => {
    const pincode = raw.replace(/\D/g, '').slice(0, 6)
    patchSchool(id, { pincode, pincodeError: null })
    if (pincode.length !== 6) {
      patchSchool(id, { areas: [] })
      return
    }
    patchSchool(id, { loadingPincode: true })
    try {
      const response = await lookupPincode(pincode)
      if (response.success && response.town) {
        patchSchool(id, {
          city: response.district || '',
          state: response.state || '',
          region: response.region || '',
          areas: response.postOffices || [{ name: response.town, district: response.district || '' }],
        })
      } else {
        const msg = response.message || 'Could not find this pincode.'
        patchSchool(id, { areas: [], pincodeError: msg })
        toast.error(msg)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pincode lookup failed. Enter location manually.'
      patchSchool(id, { areas: [], pincodeError: msg })
      toast.error(msg)
    } finally {
      patchSchool(id, { loadingPincode: false })
    }
  }

  const addSchool = () => {
    setSchools((prev) => [...prev, blankSchool(canPickProducts ? availableProducts : [])])
  }

  const removeSchool = (id: string) => {
    setSchools((prev) => (prev.length <= 1 ? prev : prev.filter((school) => school.id !== id)))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    let savedCount = 0
    try {
      if (!assignedTo) throw new Error('Please assign a chain head.')
      if (schools.length === 0) throw new Error('Add at least one school for this chain.')

      const chainGroupId = crypto.randomUUID()
      for (let index = 0; index < schools.length; index += 1) {
        const school = schools[index]
        const label = `School ${index + 1}`
        const schoolNameCheck = validateSchoolName(school.school_name)
        if (!schoolNameCheck.ok) throw new Error(`${label}: ${schoolNameCheck.message}`)
        const schoolCodeCheck = validateSchoolCode(school.school_code)
        if (!schoolCodeCheck.ok) throw new Error(`${label}: ${schoolCodeCheck.message}`)
        const contactPersonCheck = validateContactPerson(school.contact_person, { required: true, label: 'Contact person' })
        if (!contactPersonCheck.ok) throw new Error(`${label}: ${contactPersonCheck.message}`)
        const contactMobileCheck = validateContactMobile(school.contact_mobile, { required: true })
        if (!contactMobileCheck.ok) throw new Error(`${label}: ${contactMobileCheck.message}`)
        const contactPerson2Check = validateContactPerson(school.contact_person2, { required: true, label: 'Contact Person 2' })
        if (!contactPerson2Check.ok) throw new Error(`${label}: ${contactPerson2Check.message}`)
        const contactMobile2Check = validateContactMobile(school.contact_mobile2, { required: true })
        if (!contactMobile2Check.ok) throw new Error(`${label}: ${contactMobile2Check.message}`)
        if (!school.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(school.email.trim())) {
          throw new Error(`${label}: Please enter a valid email address`)
        }
        if (!school.address.trim()) throw new Error(`${label}: Address is required`)
        if (!school.strength.trim()) throw new Error(`${label}: School Strength is required`)
        if (!school.remarks.trim()) throw new Error(`${label}: Remarks is required`)
        if (!school.follow_up_date.trim()) throw new Error(`${label}: Follow-up Date is required.`)
        const followUp = new Date(school.follow_up_date + 'T00:00:00Z')
        if (Number.isNaN(followUp.getTime())) throw new Error(`${label}: Follow-up Date is required.`)

        const codeOk = await checkSchoolCodeUnique(school.id, schoolCodeCheck.value)
        if (!codeOk) throw new Error(`${label}: School Code already exists. Please enter a unique School Code.`)

        const selectedProducts = canPickProducts
          ? school.products
              .filter((p) => p.checked)
              .map((p) => ({
                product_name: p.name,
                quantity: p.quantity || 1,
                unit_price: p.price || 0,
                strength: p.strength || 0,
              }))
          : []
        if (canPickProducts && selectedProducts.length === 0) {
          throw new Error(`${label}: Please select at least one product.`)
        }

        const created = await apiRequest<{ dc?: { _id?: string }; dcCreated?: boolean; message?: string }>(
          '/dc-orders/create',
          {
            method: 'POST',
            body: JSON.stringify({
              school_name: schoolNameCheck.value,
              school_code: schoolCodeCheck.value,
              school_type: school.school_type || undefined,
              contact_person: contactPersonCheck.value,
              contact_mobile: contactMobileCheck.value,
              contact_person2: contactPerson2Check.value,
              contact_mobile2: contactMobile2Check.value,
              location: school.location,
              address: school.address.trim(),
              pincode: school.pincode.replace(/\D/g, '').slice(0, 6) || undefined,
              state: school.state || undefined,
              city: school.city || undefined,
              region: school.region || undefined,
              area: school.area || undefined,
              status: school.lead_status || 'pending',
              strength: Number(school.strength),
              remarks: school.remarks.trim(),
              email: school.email.trim(),
              products: selectedProducts,
              follow_up_date: followUp.toISOString(),
              assigned_to: assignedTo,
              isChain: true,
              chainGroupId,
            }),
          }
        )
        if (!created?.dc && !created?.dcCreated) {
          throw new Error(created?.message || `${label} was not fully created.`)
        }
        savedCount += 1
      }

      toast.success(
        schools.length === 1
          ? 'Chain school added to the sale cycle.'
          : `${schools.length} chain schools added to the sale cycle.`
      )
      setAssignedTo('')
      setSchools([blankSchool(canPickProducts ? availableProducts : [])])
    } catch (err: unknown) {
      const base = err instanceof Error ? err.message : 'Failed to create chain schools'
      const message =
        savedCount > 0
          ? `${base} ${savedCount} school${savedCount === 1 ? '' : 's'} already saved are in the sale cycle.`
          : base
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Chain</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Fill one entry for every school in this chain. Each school becomes a client. Chain head can be a BDE or a Zonal Manager. No zone or cluster.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
          <Label>Chain head *</Label>
          <Select value={assignedTo || undefined} onValueChange={setAssignedTo} disabled={loadingHeads}>
            <SelectTrigger className="bg-white mt-1">
              <SelectValue placeholder={loadingHeads ? 'Loading...' : 'Select BDE or Zonal Manager'} />
            </SelectTrigger>
            <SelectContent>
              {heads.map((head) => (
                <SelectItem key={head._id} value={head._id}>
                  {head.name} ({displayRoleName(head.role)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {schools.map((school, index) => (
          <Card key={school.id} className="p-4 md:p-6 bg-neutral-50 border border-blue-200 text-neutral-900 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-blue-950">School {index + 1}</h2>
              {schools.length > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => removeSchool(school.id)}>
                  Remove school
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>School name *</Label>
                <Input className="bg-white" value={school.school_name} maxLength={100} required onChange={(e) => onField(school.id, 'school_name', e.target.value)} />
              </div>
              <div>
                <Label>School Code *</Label>
                <Input
                  className="bg-white"
                  value={school.school_code}
                  required
                  onChange={(e) => onField(school.id, 'school_code', e.target.value)}
                  onBlur={() => {
                    if (school.school_code.trim()) void checkSchoolCodeUnique(school.id, school.school_code)
                  }}
                />
                {school.checkingSchoolCode && <p className="text-xs text-blue-600 mt-1">Checking school code...</p>}
                {school.schoolCodeError && !school.checkingSchoolCode && (
                  <p className="text-xs text-red-600 mt-1">{school.schoolCodeError}</p>
                )}
              </div>
              <div>
                <Label>School Type</Label>
                <Select value={school.school_type || undefined} onValueChange={(v) => patchSchool(school.id, { school_type: v })}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    {SCHOOL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contact person *</Label>
                <Input className="bg-white" value={school.contact_person} required onChange={(e) => onField(school.id, 'contact_person', e.target.value)} />
              </div>
              <div>
                <Label>Contact mobile *</Label>
                <Input className="bg-white" value={school.contact_mobile} inputMode="numeric" maxLength={10} required onChange={(e) => onField(school.id, 'contact_mobile', e.target.value)} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input className="bg-white" type="email" value={school.email} required onChange={(e) => onField(school.id, 'email', e.target.value)} />
              </div>
              <div>
                <Label>Contact Person 2 *</Label>
                <Input className="bg-white" value={school.contact_person2} required onChange={(e) => onField(school.id, 'contact_person2', e.target.value)} />
              </div>
              <div>
                <Label>Contact Mobile 2 *</Label>
                <Input className="bg-white" value={school.contact_mobile2} inputMode="numeric" maxLength={10} required onChange={(e) => onField(school.id, 'contact_mobile2', e.target.value)} />
              </div>
              <div>
                <Label>Location/Town</Label>
                <Input className="bg-white" value={school.location} onChange={(e) => onField(school.id, 'location', e.target.value)} />
              </div>
              <div>
                <Label>Pincode *</Label>
                <Input className="bg-white" value={school.pincode} maxLength={6} required onChange={(e) => void handlePincodeChange(school.id, e.target.value)} />
                {school.loadingPincode && <p className="text-xs text-blue-600 mt-1">Loading location details...</p>}
                {school.pincodeError && !school.loadingPincode && <p className="text-xs text-red-600 mt-1">{school.pincodeError}</p>}
              </div>
              <div>
                <Label>State</Label>
                <Input className="bg-white" value={school.state} onChange={(e) => onField(school.id, 'state', e.target.value)} />
              </div>
              <div>
                <Label>District</Label>
                <Input className="bg-white" value={school.city} onChange={(e) => onField(school.id, 'city', e.target.value)} />
              </div>
              <div>
                <Label>City/Town</Label>
                <Input className="bg-white" value={school.region} onChange={(e) => onField(school.id, 'region', e.target.value)} />
              </div>
              <div>
                <Label>Area / Locality</Label>
                <Select value={school.area || undefined} onValueChange={(v) => patchSchool(school.id, { area: v })} disabled={school.areas.length === 0}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={school.areas.length === 0 ? 'Enter pincode first' : 'Select exact area'} />
                  </SelectTrigger>
                  <SelectContent>
                    {school.areas.filter((area) => area.name?.trim()).map((area, areaIndex) => (
                      <SelectItem key={`${area.name}-${areaIndex}`} value={area.name}>{area.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Address *</Label>
                <Textarea className="bg-white" value={school.address} required onChange={(e) => onField(school.id, 'address', e.target.value)} />
              </div>

              {canPickProducts && (
                <div className="md:col-span-2 space-y-2">
                  <Label>Products *</Label>
                  <div className="space-y-3 p-4 bg-white rounded border border-neutral-200">
                    {school.products.length === 0 ? (
                      <p className="text-sm text-neutral-500">Loading products...</p>
                    ) : (
                      school.products.map((product, productIndex) => (
                        <div key={product.name} className="flex items-center gap-4 p-2 border rounded">
                          <div className="flex items-center space-x-2 min-w-[200px]">
                            <Checkbox
                              id={`chain-${school.id}-product-${productIndex}`}
                              checked={product.checked}
                              onCheckedChange={(checked) => {
                                patchSchool(school.id, {
                                  products: school.products.map((p, i) =>
                                    i === productIndex ? { ...p, checked: Boolean(checked) } : p
                                  ),
                                })
                              }}
                            />
                            <Label htmlFor={`chain-${school.id}-product-${productIndex}`} className="font-medium cursor-pointer">
                              {product.name}
                            </Label>
                          </div>
                          {product.checked && (
                            <div className="flex-1 grid grid-cols-3 gap-3">
                              <Input type="number" className="bg-white h-8" min="0" placeholder="Price" value={product.price || ''} onChange={(e) => patchSchool(school.id, { products: school.products.map((p, i) => i === productIndex ? { ...p, price: Number(e.target.value) || 0 } : p) })} />
                              <Input type="number" className="bg-white h-8" min="1" placeholder="Qty" value={product.quantity || ''} onChange={(e) => patchSchool(school.id, { products: school.products.map((p, i) => i === productIndex ? { ...p, quantity: Number(e.target.value) || 1 } : p) })} />
                              <Input type="number" className="bg-white h-8" min="0" placeholder="Strength" value={product.strength || ''} onChange={(e) => patchSchool(school.id, { products: school.products.map((p, i) => i === productIndex ? { ...p, strength: Number(e.target.value) || 0 } : p) })} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label>Deal Status</Label>
                <Select value={school.lead_status} onValueChange={(v) => patchSchool(school.id, { lead_status: v })}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saved">Saved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>School strength (students) *</Label>
                <Input className="bg-white" type="number" value={school.strength} required onChange={(e) => onField(school.id, 'strength', e.target.value)} />
              </div>
              <div>
                <Label>Follow-up date *</Label>
                <Input type="date" className="bg-white" value={school.follow_up_date} required onChange={(e) => onField(school.id, 'follow_up_date', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Remarks *</Label>
                <Textarea className="bg-white" value={school.remarks} required onChange={(e) => onField(school.id, 'remarks', e.target.value)} />
              </div>
            </div>
          </Card>
        ))}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={addSchool}>Add school</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving schools...' : 'Save chain schools'}
          </Button>
        </div>
      </form>
    </div>
  )
}
