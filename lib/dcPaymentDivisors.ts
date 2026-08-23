import {
  computeBucketAmount,
  roundToTwo,
  type CalculationType,
} from '@/lib/paymentDivisor'

export type PaymentBreakdownLine = {
  product: string
  class: string
  strength: number
  unitPrice: number
  level?: string
  subject?: string
  [key: string]: unknown
}

const lineStrength = (line: PaymentBreakdownLine) =>
  Number(line.strength) || Number(line.quantity) || 0

/** One bucket per product + class + subject so P2 Physics and P2 Maths are not merged. */
const bucketKey = (line: PaymentBreakdownLine) =>
  [
    String(line.product || '').trim(),
    String(line.class || '').trim(),
    String(line.subject || '').trim().toLowerCase(),
  ].join('::')

/**
 * Adjust per-line totals so each product+class+subject bucket matches
 * (sum strength × unit price) ÷ divisor for level_based / subject_based.
 * Already-split subject rows (P2 Phy and P2 Maths) stay separate so both quantities count.
 */
export function applyPaymentDivisorsToBreakdown(
  lines: PaymentBreakdownLine[],
  getCalculationType: (productName: string) => CalculationType,
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
): { paymentBreakdown: PaymentBreakdownLine[]; totalAmount: number } {
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

  for (const [k, bucketLines] of buckets) {
    const productName = bucketLines[0]?.product || ''
    const ct = getCalculationType(productName)
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
    keyToBucketTotal.set(k, bucketTotal)
    keyToSumStrength.set(k, sumStrength)
  }

  const paymentBreakdown = lines.map((line) => {
    const k = bucketKey(line)
    const bucketTotal = keyToBucketTotal.get(k) ?? 0
    const sumS = keyToSumStrength.get(k) ?? 0
    const str = lineStrength(line)
    const total =
      sumS > 0 ? roundToTwo((bucketTotal * str) / sumS) : 0
    return { ...line, total }
  })

  const totalAmount = roundToTwo(
    [...keyToBucketTotal.values()].reduce((a, b) => a + b, 0)
  )

  return { paymentBreakdown, totalAmount }
}
