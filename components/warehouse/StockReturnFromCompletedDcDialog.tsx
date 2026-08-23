'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const SELECT_IN_DIALOG_CLASS = 'z-[200]'
const MAIN_WAREHOUSE = 'Main Warehouse'
const RETURN_TYPES = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement']
const RETURN_REASONS = [
  'Damaged',
  'Expired',
  'Excess',
  'Wrong item',
  'Replacement',
  'Customer request',
  'Quality issue',
  'Other',
]

function defaultFinYear(d = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth()
  // Apr–Mar financial year
  if (m >= 3) return `${y}-${y + 1}`
  return `${y - 1}-${y}`
}

function selectValueOrUndefined(value: string | undefined | null): string | undefined {
  return value && value.trim() ? value : undefined
}

type CompletedDcRow = {
  _id: string
  dcNo?: string
  schoolName?: string
  schoolCode?: string
  schoolType?: string
  zone?: string
  executive?: string
  transport?: string
  lrNo?: string
  lrDate?: string
  dcId?: string
  isDcOrder?: boolean
  remarks?: string
}

type ProductRow = {
  id: string
  product: string
  class: string
  level: string
  subject: string
  soldQty: number
  returnQty: number
  unitPrice: number
  reason: string
  remarks: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: CompletedDcRow | null
  onSuccess?: () => void
}

export default function StockReturnFromCompletedDcDialog({
  open,
  onOpenChange,
  row,
  onSuccess,
}: Props) {
  const user = useMemo(() => getCurrentUser(), [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dcOrderId, setDcOrderId] = useState('')
  const [saleId, setSaleId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [zone, setZone] = useState('')
  const [town, setTown] = useState('')
  const [address, setAddress] = useState('')
  const [transport, setTransport] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [warehouse, setWarehouse] = useState(MAIN_WAREHOUSE)
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [returnType, setReturnType] = useState('')
  const [lrNumber, setLrNumber] = useState('')
  const [finYear, setFinYear] = useState(() => defaultFinYear())
  const [returnRemarks, setReturnRemarks] = useState('')
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [existingReturns, setExistingReturns] = useState<any[]>([])

  const resetForm = () => {
    setDcOrderId('')
    setSaleId('')
    setCustomerName('')
    setSchoolCode('')
    setSchoolType('')
    setZone('')
    setTown('')
    setAddress('')
    setTransport('')
    setContactPerson('')
    setContactMobile('')
    setWarehouse(MAIN_WAREHOUSE)
    setReturnDate(new Date().toISOString().slice(0, 10))
    setReturnType('')
    setLrNumber('')
    setFinYear(defaultFinYear())
    setReturnRemarks('')
    setProductRows([])
    setExistingReturns([])
  }

  useEffect(() => {
    if (!open || !row) {
      resetForm()
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        let resolvedDcOrderId = ''
        let productsSource: any[] = []

        if (row.dcId) {
          const fullDc = await apiRequest<any>(`/dc/${row.dcId}`)
          const orderRef = fullDc?.dcOrderId
          resolvedDcOrderId =
            typeof orderRef === 'object' && orderRef?._id
              ? String(orderRef._id)
              : orderRef
                ? String(orderRef)
                : ''

          productsSource = Array.isArray(fullDc?.productDetails) ? fullDc.productDetails : []

          setCustomerName(
            (typeof orderRef === 'object' && orderRef?.school_name) ||
              fullDc?.customerName ||
              row.schoolName ||
              ''
          )
          setSchoolCode(
            (typeof orderRef === 'object' && (orderRef?.school_code || orderRef?.dc_code)) ||
              row.schoolCode ||
              ''
          )
          setSchoolType(
            (typeof orderRef === 'object' && orderRef?.school_type) || row.schoolType || ''
          )
          setZone((typeof orderRef === 'object' && orderRef?.zone) || row.zone || '')
          setTown(
            (typeof orderRef === 'object' &&
              (orderRef?.location || orderRef?.city || orderRef?.area)) ||
              ''
          )
          setAddress((typeof orderRef === 'object' && orderRef?.address) || '')
          setTransport(fullDc?.transport || row.transport || '')
          setContactPerson((typeof orderRef === 'object' && orderRef?.contact_person) || '')
          setContactMobile(
            (typeof orderRef === 'object' && orderRef?.contact_mobile) ||
              fullDc?.customerPhone ||
              ''
          )
          setLrNumber(fullDc?.lrNo || row.lrNo || '')
          setSaleId(
            (typeof orderRef === 'object' && orderRef?.dc_code) ||
              row.dcNo ||
              String(fullDc?._id || row._id)
          )
        } else if (row.isDcOrder) {
          resolvedDcOrderId = String(row._id)
        }

        if (resolvedDcOrderId) {
          try {
            const order = await apiRequest<any>(`/dc-orders/${resolvedDcOrderId}`)
            setCustomerName(order.school_name || row.schoolName || '')
            setSchoolCode(order.school_code || order.dc_code || row.schoolCode || '')
            setSchoolType(order.school_type || row.schoolType || '')
            setZone(order.zone || row.zone || '')
            setTown(order.location || order.city || order.area || '')
            setAddress(order.address || '')
            setTransport(order.transport_name || row.transport || '')
            setContactPerson(order.contact_person || '')
            setContactMobile(order.contact_mobile || '')
            setSaleId(order.dc_code || order._id || row.dcNo || '')
            if (Array.isArray(order.products) && order.products.length > 0 && productsSource.length === 0) {
              productsSource = order.products.map((p: any) => ({
                product: p.product_name,
                productName: p.product_name,
                class: p.class,
                level: p.level,
                subject: p.subject,
                quantity: p.quantity,
                strength: p.quantity,
                unit_price: p.unit_price,
              }))
            }
          } catch {
            // Keep values already set from DC
          }

          try {
            const list = await apiRequest<any[]>(
              `/stock-returns/executive/list?dcOrderId=${encodeURIComponent(resolvedDcOrderId)}`
            )
            if (!cancelled) setExistingReturns(Array.isArray(list) ? list : [])
          } catch {
            if (!cancelled) setExistingReturns([])
          }
        }

        if (!cancelled) {
          setDcOrderId(resolvedDcOrderId)
          const mapped: ProductRow[] = (productsSource || []).map((p: any, idx: number) => ({
            id: `product-${idx}-${Date.now()}`,
            product: p.product || p.productName || p.product_name || '',
            class: String(p.class || ''),
            level: String(p.level || ''),
            subject: String(p.subject || ''),
            soldQty: Number(p.quantity || p.strength || p.deliverableQuantity || p.soldQty || 0),
            returnQty: 0,
            unitPrice: Number(p.unit_price || p.unitPrice || 0),
            reason: '',
            remarks: '',
          }))
          setProductRows(mapped)
          if (mapped.length === 0) {
            toast.info('No products found on this DC. Add a product line to continue.')
          }
        }
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load DC details for stock return')
        onOpenChange(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, row, onOpenChange])

  const updateProductRow = (id: string, field: keyof ProductRow, value: string | number) => {
    setProductRows((rows) =>
      rows.map((rowItem) => {
        if (rowItem.id !== id) return rowItem
        const updated = { ...rowItem, [field]: value }
        if (field === 'returnQty') {
          const qty = Number(value) || 0
          if (qty > updated.soldQty) {
            toast.error('Return quantity cannot exceed sold quantity')
            return rowItem
          }
          updated.returnQty = Math.max(0, qty)
        }
        return updated
      })
    )
  }

  const addProductRow = () => {
    setProductRows((rows) => [
      ...rows,
      {
        id: `product-${Date.now()}`,
        product: '',
        class: '',
        level: '',
        subject: '',
        soldQty: 0,
        returnQty: 0,
        unitPrice: 0,
        reason: '',
        remarks: '',
      },
    ])
  }

  const removeProductRow = (id: string) => {
    setProductRows((rows) => rows.filter((r) => r.id !== id))
  }

  const validate = (): boolean => {
    if (!dcOrderId) {
      toast.error('DC Order is missing for this completed DC')
      return false
    }
    if (!customerName.trim()) {
      toast.error('Customer / outlet name is required')
      return false
    }
    if (!returnDate) {
      toast.error('Return Date is required')
      return false
    }
    if (!returnType) {
      toast.error('Return Type is required')
      return false
    }
    if (!warehouse.trim()) {
      toast.error('Warehouse is required')
      return false
    }
    if (!lrNumber.trim()) {
      toast.error('LR No is required')
      return false
    }
    if (!finYear.trim()) {
      toast.error('Fin Year is required')
      return false
    }
    if (productRows.length === 0) {
      toast.error('Please add at least one product')
      return false
    }

    // Only products with Return Qty > 0 are being returned; ignore 0 / empty.
    const returningLines = productRows.filter((line) => Number(line.returnQty) > 0)
    if (returningLines.length === 0) {
      toast.error('Please enter a return quantity for at least one product.')
      return false
    }

    for (const line of returningLines) {
      if (!line.product.trim()) {
        toast.error('Product name is required for returned products')
        return false
      }
      if (!line.reason) {
        toast.error(`Please provide a reason for ${line.product || 'the returned product'}`)
        return false
      }
      if (line.returnQty > line.soldQty) {
        toast.error('Return quantity cannot exceed sold quantity')
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const products = productRows
        .filter((r) => Number(r.returnQty) > 0)
        .map((r) => ({
          product: r.product.trim(),
          class: r.class,
          level: r.level,
          subject: r.subject,
          soldQty: Number(r.soldQty) || 0,
          returnQty: Number(r.returnQty) || 0,
          unitPrice: Number(r.unitPrice) || 0,
          reason: r.reason,
          remarks: r.remarks,
        }))
      const totalQuantity = products.reduce((sum, p) => sum + (p.returnQty || 0), 0)

      await apiRequest('/stock-returns/executive', {
        method: 'POST',
        body: JSON.stringify({
          returnId: `RET-${user?._id || 'wh'}-${Date.now()}`,
          executiveId: user?._id,
          executiveName: user?.name || 'Warehouse',
          customerName: customerName.trim(),
          saleId,
          dcOrderId,
          warehouse,
          returnDate,
          returnType,
          lrNumber: lrNumber.trim(),
          finYear: finYear.trim(),
          schoolType: schoolType.trim(),
          schoolCode: schoolCode.trim(),
          transport: transport.trim(),
          town: town.trim(),
          address: address.trim(),
          zone: zone.trim(),
          contactPerson: contactPerson.trim(),
          contactMobile: contactMobile.trim(),
          remarks: returnRemarks.trim(),
          products,
          totalItems: products.length,
          totalQuantity,
          status: 'Submitted',
        }),
      })

      toast.success('Stock return submitted successfully')
      onOpenChange(false)
      onSuccess?.()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit stock return')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[920px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Return</DialogTitle>
          <DialogDescription>
            Create a stock return for completed DC {row?.dcNo || row?.schoolName || ''}. Enter return
            quantities, reasons, and submit.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-neutral-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading DC details…
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-base font-semibold">Basic Return Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>DC No</Label>
                  <Input value={row?.dcNo || saleId || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Created By</Label>
                  <Input value={user?.name || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Customer / Outlet *</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <Label>Warehouse *</Label>
                  <Select value={selectValueOrUndefined(warehouse)} onValueChange={setWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_IN_DIALOG_CLASS}>
                      <SelectItem value={MAIN_WAREHOUSE}>{MAIN_WAREHOUSE}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Return Date *</Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Return Type *</Label>
                  <Select value={selectValueOrUndefined(returnType)} onValueChange={setReturnType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select return type" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_IN_DIALOG_CLASS}>
                      {RETURN_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>LR No *</Label>
                  <Input
                    value={lrNumber}
                    onChange={(e) => setLrNumber(e.target.value)}
                    placeholder="Enter LR number"
                  />
                </div>
                <div>
                  <Label>Fin Year *</Label>
                  <Input
                    value={finYear}
                    onChange={(e) => setFinYear(e.target.value)}
                    placeholder="YYYY-YYYY"
                  />
                </div>
                <div>
                  <Label>School Code</Label>
                  <Input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input value={zone} onChange={(e) => setZone(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={returnRemarks}
                    onChange={(e) => setReturnRemarks(e.target.value)}
                    placeholder="Optional remarks"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Return Products *</h3>
                <Button type="button" size="sm" variant="outline" onClick={addProductRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Sold Qty</TableHead>
                      <TableHead>Return Qty *</TableHead>
                      <TableHead>Reason *</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-neutral-500 py-6">
                          No products. Click Add Product to create a return line.
                        </TableCell>
                      </TableRow>
                    ) : (
                      productRows.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="min-w-[160px]">
                            <Input
                              value={line.product}
                              onChange={(e) => updateProductRow(line.id, 'product', e.target.value)}
                              placeholder="Product"
                            />
                          </TableCell>
                          <TableCell className="w-[100px]">
                            <Input
                              type="number"
                              min={0}
                              value={line.soldQty}
                              onChange={(e) =>
                                updateProductRow(line.id, 'soldQty', Number(e.target.value || 0))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-[110px]">
                            <Input
                              type="number"
                              min={0}
                              max={line.soldQty}
                              value={line.returnQty}
                              onChange={(e) =>
                                updateProductRow(line.id, 'returnQty', Number(e.target.value || 0))
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <Select
                              value={selectValueOrUndefined(line.reason)}
                              onValueChange={(v) => updateProductRow(line.id, 'reason', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent className={SELECT_IN_DIALOG_CLASS}>
                                {RETURN_REASONS.map((reason) => (
                                  <SelectItem key={reason} value={reason}>
                                    {reason}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <Input
                              value={line.remarks}
                              onChange={(e) => updateProductRow(line.id, 'remarks', e.target.value)}
                              placeholder="Remarks"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeProductRow(line.id)}
                              aria-label="Remove product"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {existingReturns.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-base font-semibold">Existing returns for this DC</h3>
                <ul className="text-sm text-neutral-700 space-y-1">
                  {existingReturns.slice(0, 5).map((item) => (
                    <li key={item._id}>
                      {item.returnId || `#${item.returnNumber}`} — {item.status} —{' '}
                      {item.returnDate
                        ? new Date(item.returnDate).toLocaleDateString()
                        : '-'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Return'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
