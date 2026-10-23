/**
 * IIT streams are subject combinations configured on the product (Products → Streams), each
 * picked from that product's own subjects, e.g. { name: 'MPC', subjects: ['Maths', 'Physics', 'Chemistry'] }.
 * A combination that is not configured can be entered on the lead as its subjects joined by " + "
 * ("Maths + Biology"). Keep in sync with backend utils/iitStockRows.js.
 */
export type StreamCombo = { name: string; subjects: string[] }

export const CUSTOM_STREAM_SEPARATOR = ' + '

// Older records stored only letter codes (MPC, MBiPC); they are still read the same way.
const LEGACY_TOKENS: [string, string][] = [['bi', 'Biology'], ['b', 'Biology'], ['m', 'Maths'], ['p', 'Physics'], ['c', 'Chemistry']]

/** Subjects of a legacy letter-code stream ("MBiPC"); [] if it is not one. */
export function legacyStreamSubjects(raw: unknown): string[] {
  let rest = String(raw || '').toLowerCase().replace(/[^a-z]/g, '')
  const subjects: string[] = []
  while (rest) {
    const match = LEGACY_TOKENS.find(([token]) => rest.startsWith(token))
    if (!match) return []
    if (!subjects.includes(match[1])) subjects.push(match[1])
    rest = rest.slice(match[0].length)
  }
  return subjects
}

/** @deprecated legacy letter codes only; use streamSubjects with the product's combos. */
export const iitStreamSubjects = legacyStreamSubjects

const norm = (v: unknown) => String(v || '').trim().toLowerCase()

/** A stream entered as "Maths + Biology" (not one of the product's named streams). */
export function isCustomStream(raw: unknown): boolean {
  return String(raw || '').includes('+')
}

export function customStreamName(subjects: string[]): string {
  return subjects.map((s) => s.trim()).filter(Boolean).join(CUSTOM_STREAM_SEPARATOR)
}

/** Subjects in a stream: the product's named combination, a "A + B" combination, or a legacy code. */
export function streamSubjects(raw: unknown, combos: StreamCombo[] = []): string[] {
  const name = norm(raw)
  if (!name) return []
  const combo = combos.find((c) => norm(c.name) === name)
  if (combo) return combo.subjects
  if (isCustomStream(raw)) return String(raw).split('+').map((s) => s.trim()).filter(Boolean)
  return legacyStreamSubjects(raw)
}

const subjectKey = (subjects: string[]) => subjects.map(norm).filter(Boolean).sort().join('|')

/** The product's streams; products saved before named combinations fall back to their letter codes. */
export function productStreamCombos(product?: { streamCombos?: StreamCombo[]; streams?: string[] } | null): StreamCombo[] {
  const combos = (product?.streamCombos || []).filter((c) => c && String(c.name || '').trim() && (c.subjects || []).length)
  if (combos.length) return combos
  return (product?.streams || [])
    .map((name) => ({ name, subjects: legacyStreamSubjects(name) }))
    .filter((c) => c.subjects.length > 0)
}

/** The configured stream a stored value corresponds to (same name, or the same subjects); '' if none. */
export function matchStream(raw: unknown, combos: StreamCombo[]): string {
  if (!norm(raw)) return ''
  const byName = combos.find((c) => norm(c.name) === norm(raw))
  if (byName) return byName.name
  const key = subjectKey(streamSubjects(raw, combos))
  return (key && combos.find((c) => subjectKey(c.subjects) === key)?.name) || ''
}

/** "MPC — Maths, Physics, Chemistry"; a custom combination already names its subjects. */
export function streamLabel(raw: string, combos: StreamCombo[] = []): string {
  if (isCustomStream(raw)) return raw
  const subjects = streamSubjects(raw, combos)
  return subjects.length ? `${raw} — ${subjects.join(', ')}` : raw
}

/** Short name suggested for a combination: each subject's initial (two letters when initials clash). */
export function suggestStreamName(subjects: string[]): string {
  const used = new Set<string>()
  return subjects
    .map((subject) => {
      const clean = subject.trim()
      let code = clean.charAt(0).toUpperCase()
      if (used.has(code)) code = clean.charAt(0).toUpperCase() + clean.charAt(1).toLowerCase()
      used.add(code)
      return code
    })
    .join('')
}
