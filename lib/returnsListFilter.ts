export type ReturnsListFilterState = {
  search: string
  status: string
  finYear: string
  executive: string
  schoolName: string
  schoolCode: string
  fromDate: string
  toDate: string
}

export const EMPTY_RETURNS_FILTERS: ReturnsListFilterState = {
  search: '',
  status: 'all',
  finYear: 'all',
  executive: 'all',
  schoolName: '',
  schoolCode: '',
  fromDate: '',
  toDate: '',
}

export type ReturnsFilterRow = {
  returnNumber?: number | string
  returnId?: string
  lrNumber?: string
  finYear?: string
  status?: string
  returnStatus?: string
  executiveName?: string
  createdBy?: { name?: string }
  customerName?: string
  schoolCode?: string
  remarks?: string
  executiveRemarks?: string
  returnDate?: string
  createdAt?: string
  dcOrderId?: string | { school_name?: string; school_code?: string }
  leadId?: { school_name?: string }
}

function rowStatus(row: ReturnsFilterRow): string {
  return (row.status || row.returnStatus || '').trim()
}

function rowExecutive(row: ReturnsFilterRow): string {
  return (row.executiveName || row.createdBy?.name || '').trim()
}

function rowSchoolName(row: ReturnsFilterRow): string {
  const dc = row.dcOrderId
  if (dc && typeof dc === 'object' && dc.school_name) return dc.school_name.trim()
  if (row.leadId?.school_name) return row.leadId.school_name.trim()
  return (row.customerName || '').trim()
}

function rowSchoolCode(row: ReturnsFilterRow): string {
  if (row.schoolCode?.trim()) return row.schoolCode.trim()
  const dc = row.dcOrderId
  if (dc && typeof dc === 'object' && dc.school_code) return dc.school_code.trim()
  return ''
}

function rowDate(row: ReturnsFilterRow): Date | null {
  const raw = row.returnDate || row.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function uniqueReturnStatuses(rows: ReturnsFilterRow[]): string[] {
  return Array.from(new Set(rows.map(rowStatus).filter(Boolean))).sort()
}

export function uniqueReturnFinYears(rows: ReturnsFilterRow[]): string[] {
  return Array.from(new Set(rows.map((r) => (r.finYear || '').trim()).filter(Boolean))).sort().reverse()
}

export function uniqueReturnExecutives(rows: ReturnsFilterRow[]): string[] {
  return Array.from(new Set(rows.map(rowExecutive).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}

export function applyReturnsFilters<T extends ReturnsFilterRow>(
  rows: T[],
  filters: ReturnsListFilterState
): T[] {
  const search = filters.search.trim().toLowerCase()
  const schoolName = filters.schoolName.trim().toLowerCase()
  const schoolCode = filters.schoolCode.trim().toLowerCase()
  const from = filters.fromDate ? new Date(filters.fromDate) : null
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`) : null

  return rows.filter((row) => {
    const status = rowStatus(row)
    if (filters.status !== 'all' && status !== filters.status) return false

    const year = (row.finYear || '').trim()
    if (filters.finYear !== 'all' && year !== filters.finYear) return false

    const executive = rowExecutive(row)
    if (filters.executive !== 'all' && executive !== filters.executive) return false

    const name = rowSchoolName(row)
    if (schoolName && !name.toLowerCase().includes(schoolName)) return false

    const code = rowSchoolCode(row)
    if (schoolCode && !code.toLowerCase().includes(schoolCode)) return false

    if (from || to) {
      const d = rowDate(row)
      if (!d) return false
      if (from && d < from) return false
      if (to && d > to) return false
    }

    if (search) {
      const haystack = [
        String(row.returnNumber ?? ''),
        row.returnId || '',
        row.lrNumber || '',
        name,
        code,
        executive,
        row.remarks || '',
        row.executiveRemarks || '',
        status,
        year,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }

    return true
  })
}
