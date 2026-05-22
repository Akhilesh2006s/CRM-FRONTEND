'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SCHOOL_TYPE_OPTIONS, loadZoneClusterOptions } from '@/lib/warehouseOptions'
import { toast } from 'sonner'

export default function DcFormUpdatePage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '').toString()
  const search = useSearchParams()
  const router = useRouter()
  const isEdit = (search?.get('mode') || '') === 'edit'
  const isView = (search?.get('mode') || '') === 'view'
  const readOnly = isView || !isEdit

  const [dc, setDc] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})

  useEffect(() => {
    loadZoneClusterOptions()
      .then(({ zones: z, clustersByZone: map }) => {
        setZones(z)
        setClustersByZone(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const data = await apiRequest<any>(`/warehouse/dc/${id}`)
        setDc(data)
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load DC')
      }
    })()
  }, [id])

  const zoneOptions = useMemo(() => zones.map((z) => ({ value: z, label: z })), [zones])
  const clusterOptions = useMemo(() => {
    const z = dc?.zone || ''
    return (clustersByZone[z] || []).map((c) => ({ value: c, label: c }))
  }, [dc?.zone, clustersByZone])

  async function handleSave() {
    if (!dc || readOnly) return
    setSaving(true)
    try {
      await apiRequest(`/warehouse/dc/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          dcNo: dc.dcNo,
          schoolName: dc.schoolName,
          schoolCode: dc.schoolCode,
          schoolType: dc.schoolType,
          contactPersonName: dc.contactPersonName,
          contactMobile: dc.contactMobile,
          town: dc.town,
          address: dc.address,
          zone: dc.zone,
          cluster_code: dc.cluster,
          remarks: dc.remarks,
          dcNotes: dc.dcNotes,
          dcRemarks: dc.dcRemarks,
          dcDate: dc.dcDate,
        }),
      })
      toast.success('DC updated')
      router.push('/dashboard/warehouse/dc-at-warehouse')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save DC')
    } finally {
      setSaving(false)
    }
  }

  if (!dc) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-6">Loading DC…</Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6">
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">DC Form Update</h1>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-4 space-y-3">
            <div className="font-medium">School Information</div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>DC Number</Label>
                <Input
                  value={dc.dcNo || ''}
                  onChange={(e) => setDc({ ...dc, dcNo: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>School Type</Label>
                {readOnly ? (
                  <Input value={dc.schoolType || ''} readOnly />
                ) : (
                  <Select
                    value={dc.schoolType || ''}
                    onValueChange={(v) => setDc({ ...dc, schoolType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select School Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHOOL_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <Label>School Name</Label>
                <Input
                  value={dc.schoolName || ''}
                  onChange={(e) => setDc({ ...dc, schoolName: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>School Code</Label>
                <Input
                  value={dc.schoolCode || ''}
                  onChange={(e) => setDc({ ...dc, schoolCode: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>Contact Person Name</Label>
                <Input
                  value={dc.contactPersonName || ''}
                  onChange={(e) => setDc({ ...dc, contactPersonName: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>Contact Mobile</Label>
                <Input
                  value={dc.contactMobile || ''}
                  onChange={(e) => setDc({ ...dc, contactMobile: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>Executive</Label>
                <Input value={dc.executive || ''} readOnly className="bg-neutral-50" />
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="font-medium">More Information</div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>Town</Label>
                <Input
                  value={dc.town || ''}
                  onChange={(e) => setDc({ ...dc, town: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input
                  value={dc.address || ''}
                  onChange={(e) => setDc({ ...dc, address: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>Zone</Label>
                {readOnly ? (
                  <Input value={dc.zone || ''} readOnly />
                ) : (
                  <SearchableSelect
                    value={dc.zone || ''}
                    onValueChange={(v) => setDc({ ...dc, zone: v, cluster: '' })}
                    placeholder="Select Zone"
                    searchPlaceholder="Search zones…"
                    options={zoneOptions}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Cluster</Label>
                {readOnly ? (
                  <Input value={dc.cluster || ''} readOnly />
                ) : (
                  <SearchableSelect
                    value={dc.cluster || ''}
                    onValueChange={(v) => setDc({ ...dc, cluster: v })}
                    placeholder={dc.zone ? 'Select Cluster' : 'Select zone first'}
                    searchPlaceholder="Search clusters…"
                    options={clusterOptions}
                    disabled={!dc.zone}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Remarks</Label>
                <Input
                  value={dc.remarks || ''}
                  onChange={(e) => setDc({ ...dc, remarks: e.target.value })}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 space-y-4">
          <div className="font-medium">DC Information</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>DC Date</Label>
              <Input
                type="date"
                value={dc.dcDate ? new Date(dc.dcDate).toISOString().slice(0, 10) : ''}
                onChange={(e) => setDc({ ...dc, dcDate: e.target.value })}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label>DC Remarks</Label>
              <Input
                value={dc.dcRemarks || ''}
                onChange={(e) => setDc({ ...dc, dcRemarks: e.target.value })}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label>DC Category</Label>
              <Input value={dc.dcCategory || ''} readOnly className="bg-neutral-50" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Product Name</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">WH Qty</th>
                </tr>
              </thead>
              <tbody>
                {dc?.items?.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-1 pr-4">
                      <Input value={it.product || ''} readOnly className="min-w-[120px]" />
                    </td>
                    <td className="py-1 pr-4">
                      <Input value={it.class ?? ''} readOnly />
                    </td>
                    <td className="py-1 pr-4">
                      <Input value={it.category || ''} readOnly />
                    </td>
                    <td className="py-1 pr-4">
                      <Input value={it.productName || ''} readOnly />
                    </td>
                    <td className="py-1 pr-4">
                      <Input value={it.qty ?? ''} readOnly />
                    </td>
                    <td className="py-1 pr-4">
                      <Input value={it.whQty ?? 0} readOnly />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Card>
    </div>
  )
}
