import jsPDF from 'jspdf'
import { dcRowCategoryOrDefault, isSpecimenRow } from '@/lib/dcRowCategory'

/** Columns the warehouse can choose for the Delivery Challan table. */
export const DC_PRINT_COLUMNS = [
  { key: 'class', label: 'Class', width: 14 },
  { key: 'category', label: 'Category', width: 32 },
  { key: 'product', label: 'Product', width: 38 },
  { key: 'series', label: 'Series', width: 38 },
  { key: 'level', label: 'Term / Level', width: 24 },
  { key: 'deliverables', label: 'Deliverables', width: 38 },
  { key: 'specs', label: 'Specs', width: 30 },
  { key: 'qty', label: 'Quantity', width: 20 },
] as const

/** Header blocks the warehouse can show or hide (DC No and Date always print). */
export const DC_PRINT_SECTIONS = [
  { key: 'school', label: 'School details (name, type, phone)' },
  { key: 'address', label: 'Delivery address' },
  { key: 'transit', label: 'Transit information (transport, LR, boxes)' },
  { key: 'transportTo', label: 'Transport To (who collects)' },
] as const

export type DcPrintColumn = (typeof DC_PRINT_COLUMNS)[number]['key']
export type DcPrintSection = (typeof DC_PRINT_SECTIONS)[number]['key']
export type DcPrintOptions = { columns: DcPrintColumn[]; sections: DcPrintSection[] }

/** Default printout: Category, Series, Deliverables and Quantity, with the school and transit blocks. */
export const DEFAULT_DC_PRINT_OPTIONS: DcPrintOptions = {
  columns: ['category', 'series', 'deliverables', 'qty'],
  sections: ['school', 'address', 'transit', 'transportTo'],
}

const STORAGE_KEY = 'dcPrintOptions'

export function loadDcPrintOptions(): DcPrintOptions {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const saved = raw ? JSON.parse(raw) : null
    const columns = (saved?.columns || []).filter((c: string) => DC_PRINT_COLUMNS.some((d) => d.key === c))
    const sections = (saved?.sections || []).filter((c: string) => DC_PRINT_SECTIONS.some((d) => d.key === c))
    if (!columns.length) return DEFAULT_DC_PRINT_OPTIONS
    return { columns: columns.includes('qty') ? columns : [...columns, 'qty'], sections }
  } catch {
    return DEFAULT_DC_PRINT_OPTIONS
  }
}

export function saveDcPrintOptions(options: DcPrintOptions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    /* preference only */
  }
}

export type DcTransit = {
  transport?: string
  transportArea?: string
  lrNo?: string
  boxes?: string | number
  lrDate?: string
  remarks?: string
}

type Line = Record<DcPrintColumn, string>

/** Table lines for the challan: one per DC row, plus the Abacus kit items. */
export function dcChallanLines(fullDC: any): Line[] {
  const lines: Line[] = []
  for (const p of fullDC?.productDetails || []) {
    const qty = Number(p.quantity) || 0
    const product = p.productName || p.product || ''
    if (!product || qty <= 0) continue
    const specimen = isSpecimenRow(p)
    lines.push({
      class: String(p.class || '-'),
      category: fullDC.dcType === 'shortage' ? 'Shortage' : specimen ? 'Training Material' : dcRowCategoryOrDefault(p.category),
      product,
      series: String(p.productCategory || '-'),
      level: String(p.level || p.term || '-'),
      deliverables: String(p.subject || (specimen ? p.specs : '') || p.stream || '-'),
      specs: String(p.specs || '-'),
      qty: String(qty),
    })
  }
  const kit = fullDC?.abacusMaterials || {}
  for (const [name, q] of [['Student Abacus', kit.studentAbacusQuantity], ['Master Abacus', kit.masterAbacusQuantity], ['Flash Cards', kit.flashCardSetsQuantity]]) {
    if (Number(q) > 0) {
      lines.push({ class: 'NA', category: 'Training Material', product: `Abacus ${name}`, series: '-', level: '-', deliverables: name, specs: '-', qty: String(Number(q)) })
    }
  }
  return lines
}

/** Delivery Challan PDF with only the chosen columns and header blocks. */
export function buildDcChallanPdf(fullDC: any, transit: DcTransit, options: DcPrintOptions = DEFAULT_DC_PRINT_OPTIONS): jsPDF {
  const order = typeof fullDC?.dcOrderId === 'object' && fullDC.dcOrderId ? fullDC.dcOrderId : {}
  const show = (s: DcPrintSection) => options.sections.includes(s)
  const columns = DC_PRINT_COLUMNS.filter((c) => options.columns.includes(c.key))
  const lines = dcChallanLines(fullDC)
  const totalQty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0)

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const left = 10
  const right = pageWidth / 2 + 5

  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text('II Floor, A.N.K Towers,', left, 20)
  pdf.text('KPHB Colony, Hyderabad-72', left, 24)
  pdf.text('Land line: 040-64592499', left, 28)
  pdf.text('Mobile: 09348 0999 33', left, 32)

  let y = 42
  pdf.setFillColor(0, 102, 204)
  pdf.rect(left, y, pageWidth - 20, 10, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Delivery Challan', pageWidth / 2, y + 7, { align: 'center' })
  y += 18

  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  const dcNo = fullDC?.dc_code || fullDC?.dcNo || String(fullDC?._id || '').slice(-6)
  const dcDate = fullDC?.dcDate ? new Date(fullDC.dcDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const leftLines: string[] = [`DC No: ${dcNo}`, `DC Date: ${dcDate}`]
  if (show('school')) {
    const code = order.school_code ? ` (${order.school_code})` : ''
    leftLines.push(`School: ${order.school_name || fullDC?.customerName || ''}${code}`)
    leftLines.push(`School Type: ${order.school_type || 'Existing'}`)
    leftLines.push(`Phone: ${order.contact_mobile || fullDC?.customerPhone || ''}`)
  }
  if (show('address')) {
    const parts = [order.transport_location, order.transport_name, order.transportation_landmark, order.pincode].filter(Boolean)
    leftLines.push(`Address: ${parts.length ? parts.join(', ') : order.address || ''}`)
  }
  const rightLines: string[] = []
  if (show('transit')) {
    rightLines.push(`Transport: ${transit.transport || ''}`)
    rightLines.push(`Transport Area: ${transit.transportArea || ''}`)
    rightLines.push(`LR No: ${transit.lrNo || ''}`)
    rightLines.push(`#Boxes: ${transit.boxes || ''}`)
    rightLines.push(`LR Date: ${transit.lrDate ? new Date(transit.lrDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}`)
    if (transit.remarks) rightLines.push(`Remarks: ${transit.remarks}`)
  }
  if (show('transportTo') && (order.transport_to_name || order.transport_to)) {
    const kind = { BDE: 'BDE', School: 'School', Trainer: 'Trainer' }[String(order.transport_to)] || ''
    rightLines.push(`Transport To: ${[kind, order.transport_to_name].filter(Boolean).join(' - ')}`)
    if (order.transport_to_mobile) rightLines.push(`Mobile: ${order.transport_to_mobile}`)
  }

  const block = (title: string, x: number, rows: string[], width: number) => {
    let by = y
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, x, by)
    pdf.setFont('helvetica', 'normal')
    by += 6
    for (const r of rows) {
      const wrapped = pdf.splitTextToSize(r, width)
      pdf.text(wrapped, x, by)
      by += 5 * wrapped.length
    }
    return by
  }
  const leftEnd = block('DC Information', left, leftLines, rightLines.length ? pageWidth / 2 - 15 : pageWidth - 20)
  const rightEnd = rightLines.length ? block('Transit Information', right, rightLines, pageWidth / 2 - 15) : y
  y = Math.max(leftEnd, rightEnd) + 8

  // Table: chosen columns, stretched to the page width.
  const tableWidth = pageWidth - 20
  const natural = columns.reduce((s, c) => s + c.width, 0)
  const widths = columns.map((c) => (c.width / natural) * tableWidth)
  const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((s, w) => s + w, 0))
  const header = () => {
    pdf.setFillColor(240, 240, 240)
    pdf.rect(left, y, tableWidth, 8, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    columns.forEach((c, i) => pdf.text(c.label, xs[i] + 1, y + 5))
    y += 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
  }
  header()
  for (const line of lines) {
    const cells = columns.map((c, i) => pdf.splitTextToSize(line[c.key] || '-', widths[i] - 2))
    const rowHeight = Math.max(6, Math.max(...cells.map((c) => c.length)) * 3.5 + 2)
    if (y + rowHeight > pageHeight - 40) {
      pdf.addPage()
      y = 20
      header()
    }
    cells.forEach((text, i) => pdf.text(text, xs[i] + 1, y + 4))
    y += rowHeight
  }
  y += 2
  pdf.setFillColor(240, 240, 240)
  pdf.rect(left, y, tableWidth, 8, 'F')
  pdf.setFont('helvetica', 'bold')
  const qtyIndex = columns.findIndex((c) => c.key === 'qty')
  pdf.text('Total', xs[Math.max(0, qtyIndex - 1)] + 1, y + 5)
  if (qtyIndex >= 0) pdf.text(String(totalQty), xs[qtyIndex] + 1, y + 5)

  const footY = pageHeight - 20
  pdf.setFillColor(0, 102, 204)
  pdf.rect(left, footY, pageWidth - 20, 10, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(7)
  pdf.text('CRM  update company address in settings before printing', pageWidth / 2, footY + 6, { align: 'center' })
  return pdf
}

/** The challan as a data URL (stored on the DC as its PDF). */
export async function dcChallanDataUrl(fullDC: any, transit: DcTransit, options?: DcPrintOptions): Promise<string> {
  const blob = buildDcChallanPdf(fullDC, transit, options).output('blob')
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
