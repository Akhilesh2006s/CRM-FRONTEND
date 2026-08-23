/** Timestamps that mark a DC being submitted into (or advanced in) the pipeline. */
const SUBMISSION_FIELDS = [
  'completedAt',
  'warehouseProcessedAt',
  'listedAt',
  'managerRequestedAt',
  'sentToManagerAt',
  'submittedAt',
  'poSubmittedAt',
  'updatedAt',
  'createdAt',
] as const

function timeMs(value: unknown): number {
  if (!value) return 0
  const t = new Date(value as string | number | Date).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Latest submission/stage event on a DC or list row. Never uses dcDate (form date). */
export function dcSubmissionTimeMs(doc: object | null | undefined): number {
  if (!doc) return 0
  const rec = doc as Record<string, unknown>
  let max = 0
  for (const field of SUBMISSION_FIELDS) {
    const t = timeMs(rec[field])
    if (t > max) max = t
  }
  return max
}

export function sortDcsNewestFirst<T>(docs: T[] | null | undefined): T[] {
  return (Array.isArray(docs) ? docs : []).slice().sort((a, b) => {
    return dcSubmissionTimeMs(b as object) - dcSubmissionTimeMs(a as object)
  })
}
