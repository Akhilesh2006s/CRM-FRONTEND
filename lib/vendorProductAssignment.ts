export type AssignedVendor = { _id?: string; name: string }

export type PartnerAssignment = {
  _id?: string
  name?: string
  partnerAssignedProducts?: Array<string | { _id?: string; productName?: string }>
}

function productKey(name: string): string {
  return String(name || '').trim().toLowerCase()
}

export function productVendorMapFromPartners(
  partners: PartnerAssignment[] | undefined,
  productIdToName?: Map<string, string> | Record<string, string>
): Map<string, AssignedVendor[]> {
  const map = new Map<string, AssignedVendor[]>()
  for (const partner of Array.isArray(partners) ? partners : []) {
    const name = String(partner?.name || '').trim()
    if (!name) continue
    const vendor: AssignedVendor = { _id: partner._id, name }
    const products = Array.isArray(partner.partnerAssignedProducts)
      ? partner.partnerAssignedProducts
      : []
    for (const product of products) {
      let pname = ''
      if (typeof product === 'object' && product) {
        pname = String(product.productName || '').trim()
      } else if (product) {
        const id = String(product)
        pname = productIdToName instanceof Map
          ? String(productIdToName.get(id) || '')
          : String((productIdToName as Record<string, string> | undefined)?.[id] || '')
      }
      const key = productKey(pname)
      if (!key) continue
      const list = map.get(key) || []
      if (!list.some((v) => v.name.toLowerCase() === name.toLowerCase())) list.push(vendor)
      map.set(key, list)
    }
  }
  return map
}

export function productVendorMapFromNameRecord(
  productVendors?: Record<string, string[]> | null
): Map<string, AssignedVendor[]> {
  const map = new Map<string, AssignedVendor[]>()
  if (!productVendors || typeof productVendors !== 'object') return map
  for (const [rawKey, names] of Object.entries(productVendors)) {
    const key = productKey(rawKey)
    if (!key) continue
    const list = map.get(key) || []
    for (const name of Array.isArray(names) ? names : []) {
      const n = String(name || '').trim()
      if (!n) continue
      if (!list.some((v) => v.name.toLowerCase() === n.toLowerCase())) list.push({ name: n })
    }
    if (list.length) map.set(key, list)
  }
  return map
}

export function mergeVendorMaps(
  ...maps: Array<Map<string, AssignedVendor[]>>
): Map<string, AssignedVendor[]> {
  const out = new Map<string, AssignedVendor[]>()
  for (const map of maps) {
    if (!(map instanceof Map)) continue
    for (const [key, list] of map.entries()) {
      const existing = out.get(key) || []
      for (const vendor of list) {
        const n = String(vendor?.name || '').trim()
        if (!n) continue
        if (!existing.some((v) => v.name.toLowerCase() === n.toLowerCase())) {
          existing.push({ _id: vendor._id, name: n })
        }
      }
      if (existing.length) out.set(key, existing)
    }
  }
  return out
}

export function vendorMapFromApiPayloads(payloads: {
  partners?: PartnerAssignment[] | unknown
  productVendors?: Record<string, string[]> | null
  warehouseProductVendors?: Record<string, string[]> | null
  products?: Array<{ _id?: string; productName?: string }>
}): Map<string, AssignedVendor[]> {
  const partners = Array.isArray(payloads.partners) ? payloads.partners : []
  const idToName = new Map<string, string>()
  for (const product of Array.isArray(payloads.products) ? payloads.products : []) {
    const id = String(product?._id || '').trim()
    const name = String(product?.productName || '').trim()
    if (id && name) idToName.set(id, name)
  }
  return mergeVendorMaps(
    productVendorMapFromPartners(partners, idToName),
    productVendorMapFromNameRecord(payloads.productVendors),
    productVendorMapFromNameRecord(payloads.warehouseProductVendors)
  )
}

export function vendorsForProduct(
  productName: string,
  map: Map<string, AssignedVendor[]>
): AssignedVendor[] {
  return map.get(productKey(productName)) || []
}

export function mappedVendorName(
  productName: string,
  map: Map<string, AssignedVendor[]>,
  current?: string
): string {
  const assigned = vendorsForProduct(productName, map)
  if (!assigned.length) return String(current || '').trim()
  const cur = String(current || '').trim().toLowerCase()
  const match = assigned.find((v) => v.name.toLowerCase() === cur)
  return (match || assigned[0]).name
}

function inventoryListMergeKey(item: {
  productName?: string
  category?: string
  level?: string
  specs?: string
  subject?: string
  supplier?: string
}): string {
  return [
    String(item.productName || '').trim().toLowerCase(),
    String(item.category || '').trim().toLowerCase(),
    String(item.level || '').trim().toLowerCase(),
    String(item.specs || '').trim().toLowerCase(),
    String(item.subject || '').trim().toLowerCase(),
    String(item.supplier || '').trim().toLowerCase(),
  ].join('|')
}

/** Rewrite vendor from product assignments and merge rows that become the same SKU. */
export function remapAndMergeInventoryRows<T extends {
  _id?: string
  productName?: string
  category?: string
  level?: string
  specs?: string
  subject?: string
  supplier?: string
  currentStock?: number
}>(items: T[], vendorMap: Map<string, AssignedVendor[]>): T[] {
  const groups = new Map<string, T>()
  for (const item of Array.isArray(items) ? items : []) {
    const supplier = mappedVendorName(item.productName || '', vendorMap, item.supplier) || item.supplier
    const next = { ...item, supplier }
    const key = inventoryListMergeKey(next)
    const prev = groups.get(key)
    if (!prev) {
      groups.set(key, next)
      continue
    }
    groups.set(key, {
      ...prev,
      currentStock: (Number(prev.currentStock) || 0) + (Number(next.currentStock) || 0),
    })
  }
  return Array.from(groups.values())
}
