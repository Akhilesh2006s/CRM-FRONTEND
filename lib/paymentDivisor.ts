export type CalculationType = 'normal' | 'level_based' | 'subject_based'

const ALLOWED_CALC = new Set(['normal', 'none', 'level_based', 'subject_based'])

export function normalizeCalculationType(t: string | undefined | null): CalculationType {
  const v = String(t || 'normal').toLowerCase()
  if (!ALLOWED_CALC.has(v)) return 'normal'
  return (v === 'none' ? 'normal' : v) as CalculationType
}

const normalizeLevel = (level: unknown) =>
  String(level || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

const isRealLevel = (level: unknown) => {
  const n = normalizeLevel(level)
  return Boolean(n) && n !== '-' && n !== 'n/a' && n !== 'none'
}

const normalizeSubject = (subject: unknown) =>
  String(subject || '')
    .trim()
    .toLowerCase()

export function resolveDivisor(opts: {
  calculationType: string | undefined | null
  rows: Array<{ strength?: number; level?: string; subject?: string }>
  catalogFallbackCount?: number
}): number {
  const ct = normalizeCalculationType(opts.calculationType)
  if (ct === 'normal') return 1

  const activeRows = (opts.rows || []).filter((r) => (Number(r.strength) || 0) > 0)

  if (ct === 'level_based') {
    const levels = new Set<string>()
    activeRows.forEach((r) => {
      if (isRealLevel(r.level)) levels.add(normalizeLevel(r.level))
    })
    let d = levels.size
    if (d === 0 && opts.catalogFallbackCount) d = Number(opts.catalogFallbackCount) || 0
    return Math.max(1, d)
  }

  if (ct === 'subject_based') {
    const subjects = new Set<string>()
    activeRows.forEach((r) => {
      const n = normalizeSubject(r.subject)
      if (n) subjects.add(n)
    })
    // Each line already carries its own subject quantity (Edit PO: P2 Phy 10 + P2 Maths 10).
    // Do not divide again by subject count — that would count P2 as 10 instead of 20.
    if (subjects.size > 0 && subjects.size === activeRows.length) {
      return 1
    }
    let d = subjects.size
    if (d === 0 && opts.catalogFallbackCount) d = Number(opts.catalogFallbackCount) || 0
    return Math.max(1, d)
  }

  return 1
}

export function computeBucketAmount(opts: {
  calculationType: string | undefined | null
  rows: Array<{ strength?: number; level?: string; subject?: string; price?: number }>
  unitPrice: number
  catalogFallbackCount?: number
}): number {
  const ct = normalizeCalculationType(opts.calculationType)
  const price = Number(opts.unitPrice) || 0

  if (ct === 'normal') {
    const sum = (opts.rows || []).reduce((s, r) => {
      const st = Number(r.strength) || 0
      const pr = Number(r.price !== undefined ? r.price : opts.unitPrice) || 0
      return s + st * pr
    }, 0)
    return roundToTwo(sum)
  }

  const sumStrength = (opts.rows || []).reduce(
    (s, r) => s + (Number(r.strength) || 0),
    0
  )
  const divisor = resolveDivisor({
    calculationType: ct,
    rows: opts.rows || [],
    catalogFallbackCount: opts.catalogFallbackCount,
  })
  return roundToTwo((sumStrength * price) / divisor)
}

export function roundToTwo(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
