import { apiRequest } from '@/lib/api'
import { applyPaymentDivisorsToBreakdown } from '@/lib/dcPaymentDivisors'
import type { CalculationType } from '@/lib/paymentDivisor'

export type DcInvoicePaymentLine = {
  product: string
  term?: string
  class: string
  category: string
  specs: string
  subject?: string
  quantity: number
  strength: number
  level: string
  unitPrice: number
  total: number
}

export type DcInvoiceData = {
  schoolInfo: {
    customerName?: string
    schoolCode?: string
    contactName?: string
    mobileNumber?: string
    location?: string
    zone?: string
    email?: string
  }
  paymentBreakdown: DcInvoicePaymentLine[]
  /** Current total bill (products + other charges − discount), same as executive Payments Info */
  totalAmount: number
  /** Sum of product line totals before other charges / discount */
  productsSubtotal?: number
  dcDate?: string
  financialYear?: string
  previousDue?: number
  totalPaidAsOn?: number
  totalReturnValue?: number
  totalDue?: number
  otherCharges?: number
  otherChargesRemarks?: string
  discount?: number
  discountRemarks?: string
  invoicePending?: boolean
  invoicePendingMessage?: string
}

type FetchOpts = {
  getCalculationType: (productName: string) => CalculationType
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
}

async function getProgramInvoiceGate(
  dcOrderId?: string | null,
  productName?: string | null
): Promise<{ invoicePending: boolean; message?: string }> {
  if (!dcOrderId || !productName) return { invoicePending: false }
  try {
    const status = await apiRequest<any>(
      `/program-billing/status/by-dc-order-product?dcOrderId=${encodeURIComponent(
        dcOrderId
      )}&product=${encodeURIComponent(productName)}`
    )
    if (status?.exists && status?.shouldGenerateInvoice === false) {
      return {
        invoicePending: true,
        message: `Invoice not generated yet. Delivered ${status.deliveredLevelsCount || 0} of ${status.totalLevels || 0} required terms.`,
      }
    }
    return { invoicePending: false }
  } catch {
    return { invoicePending: false }
  }
}

function financialYearLabel(): string {
  const y = new Date().getFullYear()
  return `${y}-${String(y + 1).slice(-2)}`
}

/** Payment bill totals — matches executive / My Clients Payments Info */
async function loadPaymentBillTotals(
  dcId: string,
  dcOrder: any | null,
  schoolInfo: DcInvoiceData['schoolInfo'],
  paymentBreakdown: DcInvoicePaymentLine[]
): Promise<{
  previousDue: number
  totalPaidAsOn: number
  totalReturnValue: number
  totalDue: number
  otherCharges: number
  otherChargesRemarks: string
  discount: number
  discountRemarks: string
}> {
  let totalPaidAsOn = 0
  let totalReturnValue = 0
  let previousDue = 0
  const otherCharges = Number(dcOrder?.otherCharges) || 0
  const otherChargesRemarks = String(dcOrder?.otherChargesRemarks || '')
  const discount = Number(dcOrder?.discount) || 0
  const discountRemarks = String(dcOrder?.discountRemarks || '')

  try {
    const payments = await apiRequest<any[]>(`/payments?dcId=${dcId}&status=Approved`).catch(() => [])
    if (payments.length > 0) {
      const sorted = [...payments].sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.createdAt || 0).getTime()
        const dateB = new Date(b.paymentDate || b.createdAt || 0).getTime()
        return dateA - dateB
      })
      totalPaidAsOn = Number(sorted[0]?.amount) || 0
    }

    const dcOrderId = dcOrder?._id
    if (dcOrderId) {
      try {
        const allReturns = await apiRequest<any[]>(`/stock-returns/executive/list`).catch(() => [])
        const returns = allReturns.filter((r: any) => {
          const returnDcOrderId = typeof r.dcOrderId === 'object' ? r.dcOrderId?._id : r.dcOrderId
          return returnDcOrderId === dcOrderId
        })
        const approvedReturns = returns.filter((r: any) =>
          ['Approved', 'Partially Approved', 'Stock Updated', 'Closed'].includes(r.status)
        )
        totalReturnValue = approvedReturns.reduce((sum: number, r: any) => {
          const returnValue =
            r.products?.reduce((productSum: number, product: any) => {
              const approvedQty = Number(product.approvedQty) || 0
              const matchingProduct = paymentBreakdown.find((pb) => {
                const pbName = (pb.product || '').toLowerCase().trim()
                const returnName = (product.product || '').toLowerCase().trim()
                return (
                  pbName === returnName || pbName.includes(returnName) || returnName.includes(pbName)
                )
              })
              const unitPrice = matchingProduct?.unitPrice || 0
              return productSum + approvedQty * unitPrice
            }, 0) || 0
          return sum + returnValue
        }, 0)
      } catch {
        /* warehouse may lack executive returns list */
      }
    }

    const customerName = schoolInfo.customerName || ''
    if (customerName) {
      const allDCs = await apiRequest<any[]>(`/dc/employee/my`).catch(() => [])
      const previousDCs = allDCs.filter((prevDC: any) => {
        const prevCustomerName = prevDC.customerName || prevDC.dcOrderId?.school_name || ''
        return prevCustomerName === customerName && prevDC._id !== dcId
      })

      let previousTotal = 0
      for (const prevDC of previousDCs) {
        if (prevDC.productDetails && Array.isArray(prevDC.productDetails)) {
          previousTotal += prevDC.productDetails.reduce(
            (sum: number, p: any) =>
              sum + (Number(p.total) || (Number(p.price) || 0) * (Number(p.strength) || 0)),
            0
          )
        }
      }

      const previousDCIds = previousDCs.map((d: any) => d._id)
      let previousPaid = 0
      if (previousDCIds.length > 0) {
        const paymentResults = await Promise.all(
          previousDCIds.map((id: string) =>
            apiRequest<any[]>(`/payments?dcId=${id}&status=Approved`).catch(() => [])
          )
        )
        previousPaid = paymentResults.flat().reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      }
      previousDue = Math.max(0, previousTotal - previousPaid)
    }
  } catch {
    /* non-fatal */
  }

  const totalDue = Math.max(0, totalPaidAsOn - totalReturnValue)

  return {
    previousDue,
    totalPaidAsOn,
    totalReturnValue,
    totalDue,
    otherCharges,
    otherChargesRemarks,
    discount,
    discountRemarks,
  }
}

/** Load invoice + payment bill for a DC (My Clients, Term-Wise, Completed DC, etc.). */
export async function fetchDcInvoiceData(dcId: string, opts: FetchOpts): Promise<DcInvoiceData> {
  const fullDC = await apiRequest<any>(`/dc/${dcId}`)

  let schoolInfo: DcInvoiceData['schoolInfo'] = {}
  let paymentBreakdown: DcInvoicePaymentLine[] = []
  let totalAmount = 0
  let dcOrder: any = null

  const dcOrderRef = fullDC.dcOrderId
  const dcOrderId =
    typeof dcOrderRef === 'object' && dcOrderRef?._id
      ? dcOrderRef._id
      : typeof dcOrderRef === 'string'
        ? dcOrderRef
        : null

  if (dcOrderId) {
    dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
    if (dcOrder && !dcOrder._id) dcOrder._id = dcOrderId
    schoolInfo = {
      customerName: dcOrder.school_name || fullDC.customerName || '',
      schoolCode: dcOrder.school_code || '',
      contactName: dcOrder.contact_person || '',
      mobileNumber: dcOrder.contact_mobile || fullDC.customerPhone || '',
      location: dcOrder.location || dcOrder.area || '',
      zone: dcOrder.zone || '',
      email: dcOrder.email || fullDC.customerEmail || '',
    }
  } else {
    schoolInfo = {
      customerName: fullDC.customerName || '',
      mobileNumber: fullDC.customerPhone || '',
    }
  }

  if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
    if (dcOrder?.products && Array.isArray(dcOrder.products) && dcOrder.products.length > 0) {
      const usedIndices = new Set<number>()

      paymentBreakdown = fullDC.productDetails.map((pd: any, index: number) => {
        let matchingProduct: any = null

        if (index < dcOrder.products.length && !usedIndices.has(index)) {
          matchingProduct = dcOrder.products[index]
          usedIndices.add(index)
        } else {
          const dcProductName = (pd.product || '').toLowerCase().trim()
          for (let i = 0; i < dcOrder.products.length; i++) {
            if (usedIndices.has(i)) continue
            const p = dcOrder.products[i]
            const orderProductName = (p.product_name || '').toLowerCase().trim()
            if (
              dcProductName === orderProductName ||
              dcProductName.includes(orderProductName) ||
              orderProductName.includes(dcProductName)
            ) {
              matchingProduct = p
              usedIndices.add(i)
              break
            }
          }
        }

        const unitPrice =
          matchingProduct && matchingProduct.unit_price != null
            ? Number(matchingProduct.unit_price)
            : pd.price != null
              ? Number(pd.price)
              : 0
        const quantity = Number(pd.quantity) || 0
        const strength = Number(pd.strength) || 0
        const total = strength * unitPrice
        totalAmount += total

        return {
          product: pd.product || '',
          class: pd.class || '1',
          category: pd.category || 'New School',
          specs: pd.specs || 'Regular',
          subject: pd.subject || undefined,
          quantity,
          strength,
          level: pd.level || 'L2',
          unitPrice,
          total,
          term: matchingProduct?.term || pd.term || 'Term 1',
        }
      })
    } else {
      paymentBreakdown = fullDC.productDetails.map((p: any) => {
        const price = p.price != null ? Number(p.price) : 0
        const quantity = Number(p.quantity) || 0
        const strength = Number(p.strength) || 0
        const total = strength * price
        totalAmount += total
        return {
          product: p.product || '',
          class: p.class || '1',
          category: p.category || 'New School',
          specs: p.specs || 'Regular',
          subject: p.subject || undefined,
          quantity,
          strength,
          level: p.level || 'L2',
          unitPrice: price,
          total,
          term: p.term || 'Term 1',
        }
      })
    }
  }

  if (paymentBreakdown.length > 0) {
    const adj = applyPaymentDivisorsToBreakdown(
      paymentBreakdown.map((pb) => ({
        ...pb,
        product: pb.product || '',
        class: pb.class || '1',
        strength: Number(pb.strength) || 0,
        unitPrice: Number(pb.unitPrice) || 0,
        level: pb.level,
        subject: pb.subject,
      })),
      opts.getCalculationType,
      opts.getCatalogFallbackCount
    )
    paymentBreakdown = adj.paymentBreakdown as DcInvoicePaymentLine[]
    totalAmount = adj.totalAmount
  }

  const gate = await getProgramInvoiceGate(
    dcOrderId ? String(dcOrderId) : null,
    paymentBreakdown[0]?.product || fullDC.product || null
  )

  const bill =
    gate.invoicePending || paymentBreakdown.length === 0
      ? {
          previousDue: 0,
          totalPaidAsOn: 0,
          totalReturnValue: 0,
          totalDue: 0,
          otherCharges: Number(dcOrder?.otherCharges) || 0,
          otherChargesRemarks: String(dcOrder?.otherChargesRemarks || ''),
          discount: Number(dcOrder?.discount) || 0,
          discountRemarks: String(dcOrder?.discountRemarks || ''),
        }
      : await loadPaymentBillTotals(dcId, dcOrder, schoolInfo, paymentBreakdown)

  const productsSubtotal = totalAmount
  const currentTotalBill = productsSubtotal + bill.otherCharges - bill.discount

  return {
    schoolInfo,
    paymentBreakdown: gate.invoicePending ? [] : paymentBreakdown,
    productsSubtotal: gate.invoicePending ? 0 : productsSubtotal,
    totalAmount: gate.invoicePending ? 0 : currentTotalBill,
    dcDate: fullDC.dcDate || undefined,
    financialYear: financialYearLabel(),
    previousDue: bill.previousDue,
    totalPaidAsOn: bill.totalPaidAsOn,
    totalReturnValue: bill.totalReturnValue,
    totalDue: bill.totalDue,
    otherCharges: bill.otherCharges,
    otherChargesRemarks: bill.otherChargesRemarks,
    discount: bill.discount,
    discountRemarks: bill.discountRemarks,
    invoicePending: gate.invoicePending,
    invoicePendingMessage: gate.message,
  }
}
