/** Copied from the web app (lib/dcPaymentDivisors.ts); keep the two in sync. */
import {
  computeBucketAmount,
  roundToTwo,
  type CalculationType,
} from './paymentDivisor'
import { isBillableDcRow } from './dcRowCategory'

export type PaymentBreakdownLine = {
  product: string
  class: string
  category?: string
  section?: string
  program?: string
  stream?: string
  strength: number
  unitPrice: number
  level?: string
  subject?: string
  subjectPackage?: boolean
  [key: string]: unknown
}

const lineStrength = (line: PaymentBreakdownLine) =>
  Number(line.strength) || Number(line.quantity) || 0

const isRelatedLine = (line: PaymentBreakdownLine) => String(line.itemType || '') === 'Related Item'

/** One bucket per product + class + subject so P2 Physics and P2 Maths are not merged.
 * Each related item (Tensmat, Flash Cards ...) is its own bucket, billed at quantity × price. */
const bucketKey = (line: PaymentBreakdownLine) =>
  [
    isRelatedLine(line) ? String(line.specs || '').trim().toLowerCase() : '',
    String(line.product || '').trim(),
    String(line.class || '').trim(),
    String(line.section || '').trim().toLowerCase(),
    String(line.program || '').trim().toLowerCase(),
    String(line.stream || '').trim().toLowerCase(),
    String(line.subject || '').trim().toLowerCase(),
    String(line.itemType || '').trim().toLowerCase(),
  ].join('::')

const packageKey = (line: PaymentBreakdownLine) =>
  [String(line.product || '').trim(), String(line.class || '').trim(),
    String(line.section || '').trim().toLowerCase(),
    String(line.program || '').trim().toLowerCase(),
    String(line.stream || '').trim().toLowerCase(),
    String(line.itemType || '').trim().toLowerCase()].join('::')

/**
 * Adjust per-line totals so each product+class+subject bucket matches
 * (sum strength × unit price) ÷ divisor for level_based / subject_based.
 * Already-split subject rows (P2 Phy and P2 Maths) stay separate so both quantities count.
 */
export function applyPaymentDivisorsToBreakdown(
  allLines: PaymentBreakdownLine[],
  getCalculationType: (productName: string) => CalculationType,
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
): { paymentBreakdown: PaymentBreakdownLine[]; totalAmount: number } {
  // Training Material and Shortage rows are delivered but never billed.
  const freeLines = allLines
    .filter((line) => !isBillableDcRow(line))
    .map((line) => ({ ...line, unitPrice: 0, total: 0 }))
  if (freeLines.length) {
    const billed = applyPaymentDivisorsToBreakdown(
      allLines.filter((line) => isBillableDcRow(line)), getCalculationType, getCatalogFallbackCount)
    return { paymentBreakdown: [...billed.paymentBreakdown, ...freeLines], totalAmount: billed.totalAmount }
  }
  const lines = allLines
  if (!lines.length) {
    return { paymentBreakdown: [], totalAmount: 0 }
  }

  const buckets = new Map<string, PaymentBreakdownLine[]>()
  for (const line of lines) {
    const k = bucketKey(line)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push(line)
  }

  const keyToBucketTotal = new Map<string, number>()
  const keyToSumStrength = new Map<string, number>()
  const packageSubjects = new Map<string, Set<string>>()
  // Deliverables (CW / HW, Workbook / Phonetic Book ...) follow the product's billing setting,
  // not its name: Subject-based products charge each deliverable; every other billing type
  // includes them at no extra cost (the student pays the product price once).
  const isPackageLine = (line: PaymentBreakdownLine) =>
    Boolean(line.subject) && getCalculationType(String(line.product || '')) !== 'subject_based'
  for (const line of lines) {
    if (!isPackageLine(line)) continue
    const key = packageKey(line)
    const subjects = packageSubjects.get(key) || new Set<string>()
    subjects.add(String(line.subject).trim().toLowerCase())
    packageSubjects.set(key, subjects)
  }
  const packageBuckets = new Map<string, string[]>()
  const packageRawTotals = new Map<string, number>()

  for (const [k, bucketLines] of buckets) {
    const productName = bucketLines[0]?.product || ''
    // IIT prices are agreed for each school/class/section/program row, not a
    // catalog subject package; no catalog-level divisor may reduce this rate.
    const ct = /\bIIT\b/i.test(productName) ? 'normal' : getCalculationType(productName)
    const fallback = getCatalogFallbackCount(productName, ct)
    const unitPrice = Math.max(
      0,
      ...bucketLines.map((l) => Number(l.unitPrice) || 0)
    )
    const sumStrength = bucketLines.reduce(
      (s, l) => s + lineStrength(l),
      0
    )
    const bucketTotal = computeBucketAmount({
      calculationType: ct,
      rows: bucketLines.map((l) => ({
        strength: lineStrength(l),
        level: l.level,
        subject: l.subject,
        price: Number(l.unitPrice) || 0,
      })),
      unitPrice,
      catalogFallbackCount: fallback,
    })
    // Multiple specs (e.g. CW + HW) are books in one billed package; a related item is its own line.
    const specCount = isRelatedLine(bucketLines[0]) ? 1 : new Set(bucketLines.map((line) =>
      String(line.specs || '').trim().toLowerCase())).size || 1
    const afterSpecs = roundToTwo(bucketTotal / specCount)
    const pkgKey = packageKey(bucketLines[0])
    const subjectCount = bucketLines.some((line) => isPackageLine(line))
      ? Math.max(1, packageSubjects.get(pkgKey)?.size || 1) : 1
    keyToBucketTotal.set(k, roundToTwo(afterSpecs / subjectCount))
    if (subjectCount > 1) {
      packageBuckets.set(pkgKey, [...(packageBuckets.get(pkgKey) || []), k])
      packageRawTotals.set(pkgKey, (packageRawTotals.get(pkgKey) || 0) + afterSpecs)
    }
    keyToSumStrength.set(k, sumStrength)
  }

  // Keep the full package amount exact when dividing cents over subject rows.
  for (const [pkgKey, keys] of packageBuckets) {
    const subjectCount = packageSubjects.get(pkgKey)?.size || 1
    const expected = roundToTwo((packageRawTotals.get(pkgKey) || 0) / subjectCount)
    const allocated = roundToTwo(keys.reduce((sum, key) => sum + (keyToBucketTotal.get(key) || 0), 0))
    const last = keys[keys.length - 1]
    keyToBucketTotal.set(last, roundToTwo((keyToBucketTotal.get(last) || 0) + expected - allocated))
  }

  const remainingByBucket = new Map(keyToBucketTotal)
  const remainingStrengthByBucket = new Map(keyToSumStrength)
  const paymentBreakdown = lines.map((line) => {
    const k = bucketKey(line)
    const bucketTotal = keyToBucketTotal.get(k) ?? 0
    const sumS = keyToSumStrength.get(k) ?? 0
    const str = lineStrength(line)
    const remainingStrength = remainingStrengthByBucket.get(k) || 0
    const total = remainingStrength > 0
      ? remainingStrength === str
        ? remainingByBucket.get(k) || 0
        : roundToTwo((bucketTotal * str) / sumS)
      : 0
    remainingByBucket.set(k, roundToTwo((remainingByBucket.get(k) || 0) - total))
    remainingStrengthByBucket.set(k, remainingStrength - str)
    return { ...line, total }
  })

  const totalAmount = roundToTwo(
    [...keyToBucketTotal.values()].reduce((a, b) => a + b, 0)
  )

  return { paymentBreakdown, totalAmount }
}

/**
 * Row totals as billed (deliverables of a package charged once, free rows ₹0) for DC / order rows
 * that carry quantity and unit_price / price. Use this for every `total` sent to the server.
 */
export function withBilledTotals<T extends Record<string, any>>(
  rows: T[],
  getCalculationType: (productName: string) => CalculationType,
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number = () => 0,
): T[] {
  const lines = rows.map((row, index) => ({
    ...row,
    __row: index,
    product: String(row.product || row.productName || row.product_name || ''),
    class: String(row.class ?? ''),
    strength: Number(row.quantity) || Number(row.strength) || 0,
    unitPrice: Number(row.unit_price) || Number(row.unitPrice) || Number(row.price) || 0,
  })) as unknown as PaymentBreakdownLine[]
  const { paymentBreakdown } = applyPaymentDivisorsToBreakdown(lines, getCalculationType, getCatalogFallbackCount)
  const totals = new Map(paymentBreakdown.map((line) => [Number(line.__row), Number(line.total) || 0]))
  return rows.map((row, index) => ({ ...row, total: totals.get(index) ?? 0 }))
}
