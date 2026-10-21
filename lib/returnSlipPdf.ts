import jsPDF from 'jspdf'

type ReturnLine = {
  product?: string
  class?: string
  productCategory?: string
  level?: string
  subject?: string
  specs?: string
  soldQty?: number
  returnQty?: number
  receivedQty?: number
  condition?: string
  reason?: string
  remarks?: string
}

export type ReturnSlipData = {
  returnId?: string
  saleId?: string
  returnType?: string
  status?: string
  executiveName?: string
  customerName?: string
  schoolCode?: string
  returnDate?: string
  lrNumber?: string
  transport?: string
  products?: ReturnLine[]
}

const text = (v: unknown) => (v == null || v === '' ? '-' : String(v))

/** Stock return slip (header + one row per returned line), opened in a new tab to print or save. */
export function printReturnSlip(ret: ReturnSlipData, opts: { showReceived?: boolean } = {}) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  let y = 15

  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Stock Return Slip', pageWidth / 2, y, { align: 'center' })
  y += 10

  pdf.setFontSize(10)
  const left: Array<[string, unknown]> = [
    ['Return ID', ret.returnId],
    ['Sale / DC', ret.saleId],
    ['Return Type', ret.returnType],
    ['Status', ret.status],
  ]
  const right: Array<[string, unknown]> = [
    ['School', ret.customerName],
    ['School Code', ret.schoolCode],
    ['BDE', ret.executiveName],
    ['Return Date', ret.returnDate ? new Date(ret.returnDate).toLocaleDateString('en-IN') : ''],
  ]
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    for (const [col, pair] of [[14, left[i]], [pageWidth / 2 + 4, right[i]]] as const) {
      if (!pair) continue
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${pair[0]}:`, col, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(text(pair[1]), col + 28, y)
    }
    y += 6
  }
  if (ret.lrNumber || ret.transport) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('LR / Transport:', 14, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`${text(ret.lrNumber)} / ${text(ret.transport)}`, 42, y)
    y += 6
  }
  y += 4

  const cols = opts.showReceived
    ? ['#', 'Product', 'Class', 'Series', 'Deliverables', 'Return', 'Received', 'Condition']
    : ['#', 'Product', 'Class', 'Series', 'Term/Level', 'Deliverables', 'Return Qty', 'Reason']
  const widths = opts.showReceived ? [8, 30, 14, 34, 34, 18, 20, 24] : [8, 30, 14, 34, 22, 32, 20, 22]
  const drawHeader = () => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFillColor(235, 235, 235)
    pdf.rect(12, y - 5, widths.reduce((a, b) => a + b, 0), 7, 'F')
    let x = 14
    cols.forEach((c, i) => {
      pdf.text(c, x, y)
      x += widths[i]
    })
    y += 6
    pdf.setFont('helvetica', 'normal')
  }
  pdf.setFontSize(9)
  drawHeader()
  ;(ret.products || []).forEach((p, idx) => {
    if (y > 280) {
      pdf.addPage()
      y = 15
      drawHeader()
    }
    const values = opts.showReceived
      ? [idx + 1, p.product, p.class, p.productCategory, p.subject || p.specs, p.returnQty, p.receivedQty, p.condition]
      : [idx + 1, p.product, p.class, p.productCategory, p.level, p.subject || p.specs, p.returnQty, p.reason]
    let x = 14
    values.forEach((v, i) => {
      const cell = pdf.splitTextToSize(text(v), widths[i] - 2)[0] || ''
      pdf.text(cell, x, y)
      x += widths[i]
    })
    y += 6
  })
  y += 4
  pdf.setFont('helvetica', 'bold')
  const totalReturn = (ret.products || []).reduce((s, p) => s + (Number(p.returnQty) || 0), 0)
  pdf.text(`Total lines: ${(ret.products || []).length}    Total return qty: ${totalReturn}`, 14, y)
  y += 16
  pdf.setFont('helvetica', 'normal')
  pdf.text('BDE signature: ____________________', 14, y)
  pdf.text('Warehouse signature: ____________________', pageWidth / 2 + 4, y)

  const url = pdf.output('bloburl') as unknown as string
  window.open(url, '_blank')
}
