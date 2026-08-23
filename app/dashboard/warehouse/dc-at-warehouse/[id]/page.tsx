'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * Map a DC model document (GET /dc/:id) into the warehouse View DC form shape.
 * Used when the route id is a DC._id (e.g. from Search DC) rather than a DcOrder._id.
 */
function mapDcModelToWarehouseView(doc: any) {
  const order =
    doc?.dcOrderId && typeof doc.dcOrderId === 'object' ? doc.dcOrderId : null
  const employee =
    doc?.employeeId && typeof doc.employeeId === 'object' ? doc.employeeId : null
  const assigned =
    order?.assigned_to && typeof order.assigned_to === 'object'
      ? order.assigned_to
      : null

  const productRows = Array.isArray(doc?.productDetails)
    ? doc.productDetails
    : Array.isArray(doc?.products)
      ? doc.products
      : []

  const items = productRows.map((p: any) => ({
    product: p.product || p.product_name || p.productName || '',
    class: p.class ?? '',
    category: p.category || '',
    productName: p.productName || p.product_name || p.product || '',
    qty: Number(p.quantity ?? p.qty ?? p.strength ?? 0) || 0,
    whQty: Number(p.whQty ?? p.deliverableQuantity ?? 0) || 0,
  }))

  return {
    _id: doc._id,
    dcNo:
      order?.dc_code ||
      doc.dc_code ||
      doc.dcNo ||
      (doc._id ? `DC-${String(doc._id).slice(-6)}` : ''),
    dcDate: doc.dcDate || doc.createdAt || '',
    dcCategory: doc.dcCategory || '',
    schoolName: order?.school_name || doc.customerName || doc.schoolName || '',
    schoolCode: order?.school_code || doc.schoolCode || '',
    schoolType: order?.school_type || doc.schoolType || '',
    contactPersonName:
      order?.contact_person || doc.contactPersonName || doc.contact_person || '',
    contactMobile:
      order?.contact_mobile ||
      doc.customerPhone ||
      doc.contactMobile ||
      doc.contact_mobile ||
      '',
    town: order?.location || doc.town || '',
    address:
      order?.address ||
      order?.location ||
      doc.customerAddress ||
      doc.address ||
      '',
    zone: order?.zone || doc.zone || '',
    cluster: order?.cluster_code || order?.cluster || doc.cluster || '',
    executive:
      employee?.name ||
      assigned?.name ||
      (typeof doc.executive === 'string' ? doc.executive : '') ||
      '',
    dcRemarks: doc.dcRemarks || doc.deliveryNotes || '',
    remarks: order?.remarks || doc.remarks || '',
    dcNotes: doc.dcNotes || '',
    items,
  }
}

export default function DcFormUpdatePage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '').toString()
  const search = useSearchParams()
  const isEdit = (search?.get('mode') || '') === 'edit'
  const [dc, setDc] = useState<any | null>(null)
  const [productOptions, setProductOptions] = useState<string[]>([])
  const CATEGORY_OPTIONS = ['New Students', 'Old Students', 'Reorder']
  const CLASS_OPTIONS = Array.from({ length: 12 }).map((_, i) => i + 1)
  const PRODUCT_NAME_OPTIONS = [
    'STAR JUNIOR LEVEL-2',
    'STAR JUNIOR LEVEL-4',
    'JUNIOR LEVEL-2',
    'JUNIOR LEVEL-4',
    'SENIOR LEVEL-2',
    'VOLUME 2',
    'VOLUME 4',
  ]

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        // Prefer warehouse DcOrder-shaped payload (DC @ Warehouse list uses DcOrder ids)
        const data = await apiRequest<any>(`/warehouse/dc/${id}`)
        if (!cancelled) setDc(data)
      } catch {
        // Search DC navigates with DC model _id — fall back to GET /dc/:id and map fields
        try {
          const raw = await apiRequest<any>(`/dc/${id}`)
          if (!cancelled) setDc(mapDcModelToWarehouseView(raw))
        } catch {
          if (!cancelled) setDc(null)
        }
      }
      if (isEdit && !cancelled) {
        try {
          const opts = await apiRequest<any>(`/metadata/inventory-options`)
          if (Array.isArray(opts?.products)) setProductOptions(opts.products)
        } catch (_) {}
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6">
      <Card className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">DC Form Update</h1>
        <p className="text-sm text-neutral-600">DC No: {dc?.dcNo}</p>

        {/* School Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-4 space-y-3">
            <div className="font-medium">School Information</div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-neutral-500">School Type (read-only)</div>
                <Input value={dc?.schoolType || ''} readOnly />
              </div>
              <div>
                <div className="text-xs text-neutral-500">School Name</div>
                <Input value={dc?.schoolName || ''} onChange={(e) => setDc({ ...dc, schoolName: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">School Code</div>
                <Input value={dc?.schoolCode || ''} onChange={(e) => setDc({ ...dc, schoolCode: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Contact Person Name</div>
                <Input value={dc?.contactPersonName || ''} onChange={(e) => setDc({ ...dc, contactPersonName: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Contact Mobile</div>
                <Input value={dc?.contactMobile || ''} onChange={(e) => setDc({ ...dc, contactMobile: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Executive (read-only)</div>
                <Input value={dc?.executive || ''} readOnly />
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="font-medium">More Information</div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-neutral-500">Town</div>
                <Input value={dc?.town || ''} onChange={(e) => setDc({ ...dc, town: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Address</div>
                <Input value={dc?.address || ''} onChange={(e) => setDc({ ...dc, address: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Zone</div>
                <Input value={dc?.zone || ''} onChange={(e) => setDc({ ...dc, zone: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Cluster</div>
                <Input value={dc?.cluster || ''} onChange={(e) => setDc({ ...dc, cluster: e.target.value })} readOnly={!isEdit} />
              </div>
              <div>
                <div className="text-xs text-neutral-500">Remarks</div>
                <Input value={dc?.remarks || ''} onChange={(e) => setDc({ ...dc, remarks: e.target.value })} readOnly={!isEdit} />
              </div>
            </div>
          </Card>
        </div>

        {/* DC Information Update */}
        <Card className="p-4 space-y-4">
          <div className="font-medium">DC Information Update</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-neutral-500">DC Date</div>
              <Input type="date" value={dc?.dcDate ? new Date(dc.dcDate).toISOString().slice(0,10) : ''} onChange={(e) => setDc({ ...dc, dcDate: e.target.value })} readOnly={!isEdit} />
            </div>
            <div>
              <div className="text-xs text-neutral-500">DC Remarks</div>
              <Input value={dc?.dcRemarks || ''} onChange={(e) => setDc({ ...dc, dcRemarks: e.target.value })} readOnly={!isEdit} />
            </div>
            <div>
              <div className="text-xs text-neutral-500">DC Category (read-only)</div>
              <Input value={dc?.dcCategory || ''} readOnly />
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
                      {isEdit ? (
                        <select className="w-full border rounded px-2 py-1" value={it.product || ''} onChange={(e) => {
                          const items = [...(dc?.items || [])]; items[idx] = { ...items[idx], product: e.target.value }; setDc({ ...dc, items })
                        }}>
                          {[it.product, ...productOptions].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((p: string) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <Input value={it.product} readOnly />
                      )}
                    </td>
                    <td className="py-1 pr-4">
                      {isEdit ? (
                        <select className="w-full border rounded px-2 py-1" value={it.class ?? ''} onChange={(e) => {
                          const items = [...(dc?.items || [])]; items[idx] = { ...items[idx], class: Number(e.target.value) || 0 }; setDc({ ...dc, items })
                        }}>
                          {[it.class, ...CLASS_OPTIONS].filter((v) => v !== undefined).filter((v, i, a) => a.indexOf(v) === i).map((c: any) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <Input value={it.class} readOnly />
                      )}
                    </td>
                    <td className="py-1 pr-4">
                      {isEdit ? (
                        <select className="w-full border rounded px-2 py-1" value={it.category || ''} onChange={(e) => {
                          const items = [...(dc?.items || [])]; items[idx] = { ...items[idx], category: e.target.value }; setDc({ ...dc, items })
                        }}>
                          {[it.category, ...CATEGORY_OPTIONS].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <Input value={it.category} readOnly />
                      )}
                    </td>
                    <td className="py-1 pr-4">
                      {isEdit ? (
                        <select className="w-full border rounded px-2 py-1" value={it.productName || ''} onChange={(e) => {
                          const items = [...(dc?.items || [])]; items[idx] = { ...items[idx], productName: e.target.value }; setDc({ ...dc, items })
                        }}>
                          {[it.productName, ...PRODUCT_NAME_OPTIONS].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((n: string) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      ) : (
                        <Input value={it.productName} readOnly />
                      )}
                    </td>
                    <td className="py-1 pr-4">
                      {isEdit ? (
                        <Input type="number" value={it.qty} onChange={(e) => {
                          const items = [...(dc?.items || [])]; items[idx] = { ...items[idx], qty: Number(e.target.value) || 0 }; setDc({ ...dc, items })
                        }} />
                      ) : (
                        <Input value={it.qty} readOnly />
                      )}
                    </td>
                    <td className="py-1 pr-4"><Input type="number" value={it.whQty ?? 0} onChange={(e) => {
                      const items = [...(dc?.items || [])]
                      items[idx] = { ...items[idx], whQty: Number(e.target.value) }
                      setDc({ ...dc, items })
                    }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={async () => {
              const payload: any = {
                schoolName: dc?.schoolName,
                schoolCode: dc?.schoolCode,
                contactPersonName: dc?.contactPersonName,
                contactMobile: dc?.contactMobile,
                town: dc?.town,
                address: dc?.address,
                zone: dc?.zone,
                cluster: dc?.cluster,
                remarks: dc?.remarks,
                dcNotes: dc?.dcNotes,
                dcRemarks: dc?.dcRemarks,
              }
              if (isEdit) {
                payload.fullItems = true
                payload.items = (dc?.items || []).map((it: any) => ({
                  product: it.product,
                  class: it.class,
                  category: it.category,
                  productName: it.productName,
                  qty: it.qty,
                  whQty: it.whQty ?? 0,
                }))
              } else {
                payload.items = (dc?.items || []).map((it: any) => ({ whQty: it.whQty }))
              }
              await apiRequest(`/warehouse/dc/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
            }}>Save</Button>
          </div>
        </Card>
      </Card>
    </div>
  )
}
