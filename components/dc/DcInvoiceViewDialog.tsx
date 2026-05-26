'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DcInvoiceData } from '@/lib/dcInvoiceData'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceData: DcInvoiceData | null
  showPaymentsLink?: boolean
}

function fmt(amount?: number) {
  return `₹${(amount ?? 0).toFixed(2)}`
}

function BillRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex justify-between items-center py-3 px-4 text-sm border-b last:border-b-0 ${
        highlight ? 'bg-blue-50 font-semibold' : 'even:bg-white odd:bg-neutral-50/80'
      }`}
    >
      <span className="text-neutral-600">{label}</span>
      <span className="text-neutral-900 tabular-nums">{value}</span>
    </div>
  )
}

export default function DcInvoiceViewDialog({
  open,
  onOpenChange,
  invoiceData,
  showPaymentsLink = true,
}: Props) {
  const router = useRouter()
  const subtotal = invoiceData?.productsSubtotal ?? invoiceData?.totalAmount ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Payment Bill — {invoiceData?.schoolInfo?.customerName || 'Client'}
          </DialogTitle>
          <DialogDescription>
            {invoiceData?.financialYear
              ? `Payments info (${invoiceData.financialYear}) — same totals as executive dashboard`
              : 'Invoice totals and product breakdown for this DC'}
          </DialogDescription>
        </DialogHeader>

        {invoiceData && (
          <div className="space-y-6 py-4">
            {/* Payment bill summary (executive Payments Info fields) */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-neutral-100 px-4 py-3 border-b">
                <h3 className="font-semibold text-lg">
                  Payment Bill
                  {invoiceData.financialYear ? (
                    <span className="text-sm font-normal text-neutral-500 ml-2">
                      FY {invoiceData.financialYear}
                    </span>
                  ) : null}
                </h3>
              </div>
              <div>
                <BillRow label="School Name" value={invoiceData.schoolInfo.customerName || '-'} />
                <BillRow label="Previous Due" value={fmt(invoiceData.previousDue)} />
                {invoiceData.invoicePending && (
                  <div className="p-4 bg-amber-50 border-b text-amber-800 text-sm">
                    {invoiceData.invoicePendingMessage || 'Invoice not generated yet'}
                  </div>
                )}
                <BillRow
                  label="Current Total Bill"
                  value={fmt(invoiceData.totalAmount)}
                  highlight
                />
                <BillRow label="Total Paid As On" value={fmt(invoiceData.totalPaidAsOn)} />
                <BillRow label="Total Return Value" value={fmt(invoiceData.totalReturnValue)} />
                <BillRow label="Total Due" value={fmt(invoiceData.totalDue)} highlight />
                <BillRow label="Other Charges" value={fmt(invoiceData.otherCharges)} />
                <BillRow
                  label="Other Charges Remarks"
                  value={invoiceData.otherChargesRemarks || '-'}
                />
                <BillRow label="Discount" value={fmt(invoiceData.discount)} />
                <BillRow label="Discount Remarks" value={invoiceData.discountRemarks || '-'} />
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-neutral-50">
              <h3 className="font-semibold text-lg mb-3">School Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-neutral-600">School Name:</span>
                  <span className="ml-2 font-medium">
                    {invoiceData.schoolInfo.customerName || '-'}
                  </span>
                </div>
                {invoiceData.schoolInfo.schoolCode && (
                  <div>
                    <span className="text-neutral-600">School Code:</span>
                    <span className="ml-2 font-medium">{invoiceData.schoolInfo.schoolCode}</span>
                  </div>
                )}
                {invoiceData.schoolInfo.contactName && (
                  <div>
                    <span className="text-neutral-600">Contact Person:</span>
                    <span className="ml-2 font-medium">{invoiceData.schoolInfo.contactName}</span>
                  </div>
                )}
                {invoiceData.schoolInfo.mobileNumber && (
                  <div>
                    <span className="text-neutral-600">Mobile:</span>
                    <span className="ml-2 font-medium">{invoiceData.schoolInfo.mobileNumber}</span>
                  </div>
                )}
                {invoiceData.schoolInfo.location && (
                  <div>
                    <span className="text-neutral-600">Location:</span>
                    <span className="ml-2 font-medium">{invoiceData.schoolInfo.location}</span>
                  </div>
                )}
                {invoiceData.schoolInfo.zone && (
                  <div>
                    <span className="text-neutral-600">Zone:</span>
                    <span className="ml-2 font-medium">{invoiceData.schoolInfo.zone}</span>
                  </div>
                )}
                {invoiceData.dcDate && (
                  <div>
                    <span className="text-neutral-600">DC Date:</span>
                    <span className="ml-2 font-medium">
                      {new Date(invoiceData.dcDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-neutral-100 px-4 py-3 border-b">
                <h3 className="font-semibold text-lg">Products &amp; Pricing</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 border-b">
                      <th className="py-3 px-4 text-left font-semibold">Product</th>
                      <th className="py-3 px-4 text-left font-semibold">Term</th>
                      <th className="py-3 px-4 text-left font-semibold">Class</th>
                      <th className="py-3 px-4 text-left font-semibold">Category</th>
                      <th className="py-3 px-4 text-left font-semibold">Specs</th>
                      <th className="py-3 px-4 text-right font-semibold">Strength</th>
                      <th className="py-3 px-4 text-right font-semibold">Unit Price</th>
                      <th className="py-3 px-4 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.paymentBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-neutral-500">
                          No product lines to display
                        </td>
                      </tr>
                    ) : (
                      invoiceData.paymentBreakdown.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-neutral-50">
                          <td className="py-3 px-4 font-medium">{item.product}</td>
                          <td className="py-3 px-4">{item.term || 'Term 1'}</td>
                          <td className="py-3 px-4">{item.class}</td>
                          <td className="py-3 px-4">{item.category}</td>
                          <td className="py-3 px-4">{item.specs}</td>
                          <td className="py-3 px-4 text-right">{item.strength}</td>
                          <td className="py-3 px-4 text-right">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-semibold">
                            ₹{item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                    {!invoiceData.invoicePending && invoiceData.paymentBreakdown.length > 0 && (
                      <>
                        <tr className="bg-neutral-50 border-t font-medium">
                          <td colSpan={7} className="py-3 px-4 text-right">
                            Products Subtotal:
                          </td>
                          <td className="py-3 px-4 text-right">₹{subtotal.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-neutral-100 border-t-2 border-neutral-400 font-bold">
                          <td colSpan={7} className="py-4 px-4 text-right">
                            Current Total Bill:
                          </td>
                          <td className="py-4 px-4 text-right text-lg">
                            ₹{invoiceData.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {showPaymentsLink && (
            <Button
              onClick={() => {
                onOpenChange(false)
                router.push('/dashboard/payments')
              }}
            >
              View in Payments
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
