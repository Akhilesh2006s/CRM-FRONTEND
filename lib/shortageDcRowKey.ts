const STUDENT_ENROLLMENT_CATEGORIES = new Set([
  'new students',
  'existing students',
  'both',
  'new school',
  'existing school',
  'shortage',
])

function normalizeProductForKey(name = '') {
  let s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (s.startsWith('vedh')) {
    s = `vedic${s.slice(4)}`
  }
  return s.replace(/maths$/, 'math')
}

function skuPart(row: {
  productCategory?: string
  specs?: string
  category?: string
}) {
  const pc = String(row.productCategory || '').trim().toLowerCase()
  if (pc && !STUDENT_ENROLLMENT_CATEGORIES.has(pc)) return pc
  const specs = String(row.specs || '').trim().toLowerCase()
  if (specs && specs !== 'regular') return specs
  return ''
}

export function shortageParentRowKey(row: {
  product?: string
  productName?: string
  class?: string
  term?: string
  productCategory?: string
  specs?: string
  category?: string
}) {
  const product = normalizeProductForKey(row.product || row.productName || '')
  const cls = String(row.class || '').trim().toLowerCase()
  const term = String(row.term || 'Term 1').trim().toLowerCase()
  const sku = skuPart(row)
  return sku ? `${product}::${cls}::${term}::${sku}` : `${product}::${cls}::${term}`
}
