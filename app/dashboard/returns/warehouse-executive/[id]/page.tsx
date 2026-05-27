'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { useProducts } from '@/hooks/useProducts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { PlusCircle, ChevronRight, Loader2 } from 'lucide-react'

type DcOrderRef = {
  _id?: string
  school_name?: string
  school_code?: string
  contact_person?: string
  contact_mobile?: string
  address?: string
  zone?: string
  location?: string
  city?: string
  area?: string
  cluster_code?: string
  transport_name?: string
}

type StockReturnDetail = {
  _id: string
  returnId: string
  returnNumber?: number
  status: string
  returnDate?: string
  lrNumber?: string
  lrDate?: string
  remarks?: string
  whReturnRemarks?: string
  transport?: string
  town?: string
  address?: string
  zone?: string
  cluster?: string
  contactPerson?: string
  contactMobile?: string
  schoolCode?: string
  customerName?: string
  executiveRemarks?: string
  dcOrderId?: DcOrderRef | string
  products?: Array<{
    product: string
    level?: string
    returnQty: number
    receivedQty?: number
    reason?: string
  }>
}

type ProductLine = {
  id: string
  product: string
  productName: string
  qty: number
  returnQty: number
  reason: string
}

function toDateInput(value?: string | Date | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function canVerify(status: string) {
  return status === 'Submitted' || status === 'Sent Back'
}

function selectValue(v: string) {
  const t = (v || '').trim()
  return t.length > 0 ? t : undefined
}

export default function WarehouseExecutiveReturnUpdatePage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id || '')
  const { products: catalog, getProductLevels } = useProducts()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<StockReturnDetail | null>(null)

  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [town, setTown] = useState('')
  const [address, setAddress] = useState('')
  const [zone, setZone] = useState('')
  const [cluster, setCluster] = useState('')
  const [moreRemarks, setMoreRemarks] = useState('')

  const [returnDate, setReturnDate] = useState('')
  const [whReturnRemarks, setWhReturnRemarks] = useState('')
  const [lrDate, setLrDate] = useState('')
  const [returnRemarks, setReturnRemarks] = useState('')
  const [transport, setTransport] = useState('')
  const [lrNumber, setLrNumber] = useState('')
  const [lines, setLines] = useState<ProductLine[]>([])

  const readOnly = detail ? !canVerify(detail.status) : true
  const productNames = useMemo(() => catalog.map((p) => p.productName), [catalog])

  const loadDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await apiRequest<StockReturnDetail>(`/stock-returns/warehouse-executive/${id}`)
      setDetail(data)
      const dc = data.dcOrderId && typeof data.dcOrderId === 'object' ? data.dcOrderId : null

      setSchoolName(dc?.school_name || data.customerName || '')
      setSchoolCode(data.schoolCode || dc?.school_code || '')
      setContactPerson(data.contactPerson || dc?.contact_person || '')
      setContactMobile(data.contactMobile || dc?.contact_mobile || '')
      setTown(data.town || dc?.city || dc?.area || dc?.location || '')
      setAddress(data.address || dc?.address || '')
      setZone(data.zone || dc?.zone || '')
      setCluster(data.cluster || dc?.cluster_code || '')
      setMoreRemarks(data.remarks || '')

      setReturnDate(toDateInput(data.returnDate))
      setWhReturnRemarks(data.whReturnRemarks || '')
      setLrDate(toDateInput(data.lrDate || data.returnDate))
      setReturnRemarks(data.executiveRemarks || data.remarks || '')
      setTransport(data.transport || dc?.transport_name || '')
      setLrNumber(data.lrNumber || '')

      const rows: ProductLine[] = (data.products || []).map((p, idx) => ({
        id: `line-${idx}`,
        product: p.product || '',
        productName: p.level || '',
        qty: Number(p.receivedQty ?? p.returnQty) || 0,
        returnQty: Number(p.returnQty) || 0,
        reason: p.reason || 'Excess',
      }))
      setLines(rows.length > 0 ? rows : [{ id: 'line-0', product: '', productName: '', qty: 0, returnQty: 0, reason: 'Excess' }])
    } catch (e: any) {
      toast.error(e.message || 'Failed to load return')
      router.push('/dashboard/returns/warehouse-executive')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  const buildPayload = () => ({
    returnDate: returnDate || undefined,
    lrNumber,
    lrDate: lrDate || undefined,
    remarks: moreRemarks,
    whReturnRemarks,
    transport,
    town,
    address,
    zone,
    cluster,
    contactPerson,
    contactMobile,
    schoolCode,
    products: lines
      .filter((l) => l.product.trim())
      .map((l) => ({
        product: l.product,
        productName: l.productName,
        level: l.productName,
        returnQty: l.returnQty,
        receivedQty: l.qty,
        qty: l.qty,
        reason: l.reason || 'Excess',
        condition: l.qty > 0 ? 'Sellable' : '',
      })),
  })

  const handleSave = async () => {
    if (!detail || readOnly) return
    setSaving(true)
    try {
      await apiRequest(`/stock-returns/${detail._id}/warehouse-save`, {
        method: 'PUT',
        body: JSON.stringify(buildPayload()),
      })
      toast.success('Return update saved')
      await loadDetail()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitToAdmin = async () => {
    if (!detail || readOnly) return
    if (!returnDate) {
      toast.error('Return date is required')
      return
    }
    const validLines = lines.filter((l) => l.product.trim())
    if (validLines.length === 0) {
      toast.error('Add at least one product')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest(`/stock-returns/${detail._id}/warehouse-verify`, {
        method: 'PUT',
        body: JSON.stringify(buildPayload()),
      })
      toast.success('Submitted to Warehouse Manager')
      router.push('/dashboard/returns/warehouse-executive')
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const addLine = () => {
    setLines([
      ...lines,
      { id: `line-${Date.now()}`, product: '', productName: '', qty: 0, returnQty: 0, reason: 'Excess' },
    ])
  }

  const updateLine = (lineId: string, patch: Partial<ProductLine>) => {
    setLines(lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-neutral-600">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading return…
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Stock Return Update</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Return No. {detail.returnNumber ?? detail.returnId}
            {readOnly && (
              <span className="ml-2 text-amber-700">({detail.status} — view only)</span>
            )}
          </p>
        </div>
        <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
          <Link href="/dashboard" className="hover:text-neutral-800">
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/dashboard/returns/warehouse-executive" className="hover:text-neutral-800">
            Stock
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-neutral-800">Stock Return Update</span>
        </nav>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 border border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 pb-2 border-b">School Information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>School Name</Label>
              <Input value={schoolName} readOnly className="bg-neutral-50 mt-1" />
            </div>
            <div>
              <Label>School Code</Label>
              <Input
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                readOnly={readOnly}
                className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
              />
            </div>
            <div>
              <Label>Contact Person Name</Label>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                readOnly={readOnly}
                className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Contact Mobile</Label>
              <Input
                value={contactMobile}
                onChange={(e) => setContactMobile(e.target.value)}
                readOnly={readOnly}
                className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4 pb-2 border-b">More Information</h2>
          <div className="space-y-4">
            <div>
              <Label>Town</Label>
              <Input
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="Town"
                readOnly={readOnly}
                className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                rows={3}
                readOnly={readOnly}
                className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Zone</Label>
                <Input
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  readOnly={readOnly}
                  className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
                />
              </div>
              <div>
                <Label>Cluster</Label>
                <Input
                  value={cluster}
                  onChange={(e) => setCluster(e.target.value)}
                  readOnly={readOnly}
                  className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
                />
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={moreRemarks}
                onChange={(e) => setMoreRemarks(e.target.value)}
                placeholder="Remarks"
                rows={2}
                readOnly={readOnly}
                className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 border border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4 pb-2 border-b">
          Stock Return Information Update
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <Label>Return Date</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
            />
          </div>
          <div>
            <Label>LR Date</Label>
            <Input
              type="date"
              value={lrDate}
              onChange={(e) => setLrDate(e.target.value)}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
            />
          </div>
          <div>
            <Label>LR No</Label>
            <Input
              value={lrNumber}
              onChange={(e) => setLrNumber(e.target.value)}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
            />
          </div>
          <div>
            <Label>Transport</Label>
            <Input
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Return Remarks</Label>
            <Textarea
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              rows={2}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label>WH Return Remarks</Label>
            <Textarea
              value={whReturnRemarks}
              onChange={(e) => setWhReturnRemarks(e.target.value)}
              rows={2}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
            />
          </div>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left font-semibold">Product</th>
                <th className="py-2 px-3 text-left font-semibold">Product Name</th>
                <th className="py-2 px-3 text-left font-semibold w-28">Qty</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const levelOptions = line.product ? getProductLevels(line.product) : []
                return (
                  <tr key={line.id} className="border-b">
                    <td className="py-2 px-3">
                      <Select
                        value={selectValue(line.product)}
                        onValueChange={(v) =>
                          updateLine(line.id, { product: v, productName: '' })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger className="w-full min-w-[140px]">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-3">
                      {levelOptions.length > 0 ? (
                        <Select
                          value={selectValue(line.productName)}
                          onValueChange={(v) => updateLine(line.id, { productName: v })}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="w-full min-w-[140px]">
                            <SelectValue placeholder="Select name" />
                          </SelectTrigger>
                          <SelectContent>
                            {levelOptions.map((lvl) => (
                              <SelectItem key={lvl} value={lvl}>
                                {lvl}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={line.productName}
                          onChange={(e) => updateLine(line.id, { productName: e.target.value })}
                          placeholder="Product name / level"
                          readOnly={readOnly}
                          className={readOnly ? 'bg-neutral-50' : ''}
                        />
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        min={0}
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.id, { qty: Number(e.target.value) || 0 })
                        }
                        readOnly={readOnly}
                        className={readOnly ? 'bg-neutral-50' : ''}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addLine}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Add
          </Button>
        )}
      </Card>

      <div className="sticky bottom-0 bg-white border border-neutral-200 rounded-lg shadow-sm px-6 py-4 flex items-center justify-between gap-4 mt-4">
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/returns/warehouse-executive')}>
          Back to list
        </Button>
        <div className="flex items-center gap-3">
          {!readOnly && (
            <>
              <Button type="button" variant="secondary" onClick={handleSave} disabled={saving || submitting}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" onClick={handleSubmitToAdmin} disabled={saving || submitting}>
                {submitting ? 'Submitting…' : 'Submit to Admin'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
