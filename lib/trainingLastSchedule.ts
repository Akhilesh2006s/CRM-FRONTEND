type ScheduleRow = {
  _id?: string
  status?: string
  subject?: string
  term?: string
  trainingDate?: string
  serviceDate?: string
  completionDate?: string
}

export type LastScheduleInfo = {
  /** e.g. "Last training date" */
  fieldLabel: string
  formattedDate: string
  detail?: string
}

function formatScheduleDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function rowCompletedDate(row: ScheduleRow, type: 'training' | 'service'): number {
  const raw =
    row.completionDate ||
    (type === 'training' ? row.trainingDate : row.serviceDate) ||
    ''
  return new Date(raw).getTime() || 0
}

async function fetchRowsForSchool(
  apiRequest: <T>(url: string) => Promise<T>,
  type: 'training' | 'service',
  schoolCode?: string,
  schoolName?: string
): Promise<ScheduleRow[]> {
  const code = schoolCode?.trim()
  const name = schoolName?.trim()
  if (!code && !name) return []

  const paths: string[] = []
  if (code) paths.push(`schoolCode=${encodeURIComponent(code)}`)
  if (name) paths.push(`schoolName=${encodeURIComponent(name)}`)

  const endpoint = type === 'training' ? '/training' : '/services'
  const byId = new Map<string, ScheduleRow>()

  for (const q of paths) {
    try {
      const rows = await apiRequest<ScheduleRow[]>(`${endpoint}?${q}`)
      ;(Array.isArray(rows) ? rows : []).forEach((row) => {
        const id = row._id || JSON.stringify(row)
        if (!byId.has(id)) byId.set(id, row)
      })
    } catch {
      /* try next query */
    }
  }

  return Array.from(byId.values())
}

/**
 * Latest completed training/service for a school. Returns null if none completed.
 * When `subject` is set, only completed rows for that product are considered.
 */
export async function fetchLastCompletedSchedule(
  apiRequest: <T>(url: string) => Promise<T>,
  opts: {
    schoolCode?: string
    schoolName?: string
    type: 'training' | 'service'
    subject?: string
  }
): Promise<LastScheduleInfo | null> {
  const rows = await fetchRowsForSchool(
    apiRequest,
    opts.type,
    opts.schoolCode,
    opts.schoolName
  )

  let completed = rows.filter((r) => r.status === 'Completed')
  const subject = opts.subject?.trim()
  if (subject) {
    completed = completed.filter(
      (r) => String(r.subject || '').trim().toLowerCase() === subject.toLowerCase()
    )
  }

  if (completed.length === 0) return null

  const latest = completed.reduce((a, b) =>
    rowCompletedDate(b, opts.type) > rowCompletedDate(a, opts.type) ? b : a
  )

  const dateIso =
    latest.completionDate ||
    (opts.type === 'training' ? latest.trainingDate : latest.serviceDate) ||
    ''
  const formattedDate = formatScheduleDate(dateIso)
  if (!formattedDate) return null

  const fieldLabel =
    opts.type === 'training' ? 'Last training date' : 'Last service date'

  const parts: string[] = []
  if (latest.subject) parts.push(latest.subject)
  if (latest.term) parts.push(latest.term)

  return {
    fieldLabel,
    formattedDate,
    detail: parts.length > 0 ? parts.join(' · ') : undefined,
  }
}
