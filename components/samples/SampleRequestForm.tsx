'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'
import { resolveClientDCRowFields } from '@/lib/clientDcProductRows'
import {
  emptySampleDelivery,
  validateSampleDelivery,
  type SampleDeliveryFields,
  type SampleProductLine,
  type SampleSchoolOption,
} from '@/lib/sampleRequestFields'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

type ProductRow = SampleProductLine & { id: string }

function newRow(): ProductRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product: '',
    class: '1',
    specs: 'Regular',
    quantity: 1,
    strength: 1,
    level: 'L1',
  }
}

type Props = {
  onSuccess?: () => void
}

export default function SampleRequestForm({ onSuccess }: Props) {
  const {
    productNames,
    getProductLevels,
    getDefaultLevel,
    getProductSpecs,
    hasProductSpecs,
    getProductCategories,
    hasProductCategories,
  } = useProducts()

  const [purpose, setPurpose] = useState('To show schools')
  const [schoolOptions, setSchoolOptions] = useState<SampleSchoolOption[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState('')
  const [zone, setZone] = useState('')
  const [delivery, setDelivery] = useState<SampleDeliveryFields>(emptySampleDelivery())
  const [rows, setRows] = useState<ProductRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loadingSchools, setLoadingSchools] = useState(true)

  useEffect(() => {
    loadSchoolOptions()
  }, [])

  const loadSchoolOptions = async () => {
    setLoadingSchools(true)
    try {
      const dcs = await apiRequest<any[]>('/dc/employee/my?limit=200')
      const map = new Map<string, SampleSchoolOption>()
      for (const dc of Array.isArray(dcs) ? dcs : []) {
        const order = dc.dcOrderId
        if (!order || typeof order !== 'object' || !order._id) continue
        if (map.has(order._id)) continue
        map.set(order._id, {
          dcOrderId: order._id,
          school_name: order.school_name || dc.customerName || 'School',
          contact_person: order.contact_person,
          contact_mobile: order.contact_mobile || dc.customerPhone,
          address: order.address,
          location: order.location,
          zone: order.zone,
        })
      }
      setSchoolOptions([...map.values()].sort((a, b) => a.school_name.localeCompare(b.school_name)))
    } catch {
      toast.error('Could not load your schools')
    } finally {
      setLoadingSchools(false)
    }
  }

  const applySchool = async (dcOrderId: string) => {
    setSelectedSchoolId(dcOrderId)
    const opt = schoolOptions.find((s) => s.dcOrderId === dcOrderId)
    if (opt) {
      setSchoolName(opt.school_name)
      setContactPerson(opt.contact_person || '')
      setContactMobile(opt.contact_mobile || '')
      setAddress(opt.address || '')
      setLocation(opt.location || '')
      setZone(opt.zone || '')
    }
    try {
      const order = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
      setSchoolName(order.school_name || opt?.school_name || '')
      setContactPerson(order.contact_person || '')
      setContactMobile(order.contact_mobile || '')
      setAddress(order.address || '')
      setLocation(order.location || '')
      setZone(order.zone || '')
      setDelivery({
        property_number: order.property_number || '',
        floor: order.floor || '',
        tower_block: order.tower_block || '',
        nearby_landmark: order.nearby_landmark || '',
        area: order.area || '',
        city: order.city || order.region || '',
        pincode: order.pincode || '',
        transport_name: order.transport_name || '',
        transport_location: order.transport_location || '',
        transportation_landmark: order.transportation_landmark || '',
      })
    } catch {
      /* keep partial from list */
    }
  }

  const updateRow = (index: number, patch: Partial<ProductRow>) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const onProductSelect = (index: number, product: string) => {
    const resolved = resolveClientDCRowFields({}, product, {
      hasProductCategories,
      getProductCategories,
    })
    const specsList = hasProductSpecs(product) ? getProductSpecs(product) : []
    updateRow(index, {
      product,
      level: getDefaultLevel(product),
      class: resolved.class,
      productCategory: resolved.productCategory,
      specs: specsList[0] || resolved.specs,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolName.trim()) {
      toast.error('Select or enter a school')
      return
    }
    const deliveryErr = validateSampleDelivery(delivery)
    if (deliveryErr) {
      toast.error(deliveryErr)
      return
    }
    if (rows.length === 0) {
      toast.error('Add at least one product')
      return
    }
    for (const row of rows) {
      if (!row.product || row.quantity < 1) {
        toast.error('Fill product name and quantity for all lines')
        return
      }
    }

    setSubmitting(true)
    try {
      await apiRequest('/sample-requests', {
        method: 'POST',
        body: JSON.stringify({
          purpose,
          school_name: schoolName.trim(),
          dc_order_id: selectedSchoolId || undefined,
          contact_person: contactPerson,
          contact_mobile: contactMobile,
          address,
          location,
          zone,
          ...delivery,
          productDetails: rows.map((r) => ({
            product: r.product,
            product_name: r.product,
            class: r.class,
            productCategory: r.productCategory,
            specs: r.specs,
            quantity: r.quantity,
            strength: r.strength || r.quantity,
            level: r.level,
          })),
        }),
      })
      toast.success('Sample request submitted. It will appear in EMP DC for approval.')
      setRows([])
      setPurpose('To show schools')
      setSelectedSchoolId('')
      setSchoolName('')
      setDelivery(emptySampleDelivery())
      onSuccess?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit sample request')
    } finally {
      setSubmitting(false)
    }
  }

  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

  return (
    <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label>Purpose</Label>
          <Input
            className="bg-white"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose of sample request"
          />
        </div>

        <div className="space-y-3 border rounded-lg p-4 bg-white">
          <Label className="text-base font-semibold">School *</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-600">Select from My Clients</Label>
              <Select
                value={selectedSchoolId || undefined}
                onValueChange={applySchool}
                disabled={loadingSchools}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={loadingSchools ? 'Loading schools…' : 'Select school'} />
                </SelectTrigger>
                <SelectContent>
                  {schoolOptions.map((s) => (
                    <SelectItem key={s.dcOrderId} value={s.dcOrderId}>
                      {s.school_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-neutral-600">School name *</Label>
              <Input
                className="bg-white"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="School name"
              />
            </div>
            <div>
              <Label className="text-xs">Contact person</Label>
              <Input
                className="bg-white"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Contact mobile</Label>
              <Input
                className="bg-white"
                value={contactMobile}
                onChange={(e) => setContactMobile(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Address</Label>
              <Textarea
                className="bg-white"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input className="bg-white" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Zone</Label>
              <Input className="bg-white" value={zone} onChange={(e) => setZone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-3 border rounded-lg p-4 bg-white">
          <Label className="text-base font-semibold">Delivery address (same as My Clients)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Property / door no.</Label>
              <Input
                className="bg-white"
                value={delivery.property_number}
                onChange={(e) => setDelivery({ ...delivery, property_number: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Floor</Label>
              <Input
                className="bg-white"
                value={delivery.floor}
                onChange={(e) => setDelivery({ ...delivery, floor: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Tower / block</Label>
              <Input
                className="bg-white"
                value={delivery.tower_block}
                onChange={(e) => setDelivery({ ...delivery, tower_block: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Nearby landmark</Label>
              <Input
                className="bg-white"
                value={delivery.nearby_landmark}
                onChange={(e) => setDelivery({ ...delivery, nearby_landmark: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Area *</Label>
              <Input
                className="bg-white"
                value={delivery.area}
                onChange={(e) => setDelivery({ ...delivery, area: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input
                className="bg-white"
                value={delivery.city}
                onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border rounded-lg p-4 bg-white">
          <Label className="text-base font-semibold">Transport details *</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Transport name *</Label>
              <Input
                className="bg-white"
                value={delivery.transport_name}
                onChange={(e) => setDelivery({ ...delivery, transport_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Transport location *</Label>
              <Input
                className="bg-white"
                value={delivery.transport_location}
                onChange={(e) => setDelivery({ ...delivery, transport_location: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Transportation landmark</Label>
              <Input
                className="bg-white"
                value={delivery.transportation_landmark}
                onChange={(e) =>
                  setDelivery({ ...delivery, transportation_landmark: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Pincode *</Label>
              <Input
                className="bg-white"
                value={delivery.pincode}
                onChange={(e) => setDelivery({ ...delivery, pincode: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-base font-semibold">Products * (same as DC)</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, newRow()])}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500 p-4 bg-white rounded border text-center">
              No products added. Click &quot;Add Product&quot; to add products.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={row.id} className="p-3 bg-white rounded border grid grid-cols-1 gap-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Product</Label>
                        <Select value={row.product} onValueChange={(v) => onProductSelect(index, v)}>
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {productNames.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Class</Label>
                        <Select value={row.class} onValueChange={(v) => updateRow(index, { class: v })}>
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableClasses.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {hasProductCategories(row.product) && (
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select
                            value={row.productCategory || ''}
                            onValueChange={(v) => updateRow(index, { productCategory: v })}
                          >
                            <SelectTrigger className="bg-white h-9">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {getProductCategories(row.product).map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {hasProductSpecs(row.product) && (
                        <div>
                          <Label className="text-xs">Specs</Label>
                          <Select value={row.specs} onValueChange={(v) => updateRow(index, { specs: v })}>
                            <SelectTrigger className="bg-white h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getProductSpecs(row.product).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Level</Label>
                        <Select value={row.level} onValueChange={(v) => updateRow(index, { level: v })}>
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getProductLevels(row.product).map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          className="bg-white h-9"
                          value={row.quantity}
                          onChange={(e) => {
                            const q = parseInt(e.target.value, 10) || 1
                            updateRow(index, { quantity: q, strength: q })
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Strength</Label>
                        <Input
                          type="number"
                          min={0}
                          className="bg-white h-9"
                          value={row.strength}
                          onChange={(e) =>
                            updateRow(index, { strength: parseInt(e.target.value, 10) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-6"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || rows.length === 0}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
