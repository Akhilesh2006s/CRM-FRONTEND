/** IIT subject combinations. The list comes from the product's Streams in Products;
 * these defaults are used only until streams are configured there. */
export const DEFAULT_IIT_STREAMS = ['MPC', 'BiPC', 'MBiPC']

const TOKENS: [string, string][] = [['bi', 'Biology'], ['b', 'Biology'], ['m', 'Maths'], ['p', 'Physics'], ['c', 'Chemistry']]

/** Subjects in a combination, e.g. "MBiPC" → Maths, Biology, Physics, Chemistry; [] if unrecognised. */
export function iitStreamSubjects(raw: unknown): string[] {
  let rest = String(raw || '').toLowerCase().replace(/[^a-z]/g, '')
  const subjects: string[] = []
  while (rest) {
    const match = TOKENS.find(([token]) => rest.startsWith(token))
    if (!match) return []
    if (!subjects.includes(match[1])) subjects.push(match[1])
    rest = rest.slice(match[0].length)
  }
  return subjects
}

const streamKey = (raw: unknown) => {
  const subjects = iitStreamSubjects(raw)
  return subjects.length ? subjects.slice().sort().join('|') : String(raw || '').trim().toLowerCase()
}

/** The configured option a stored stream corresponds to (any spelling/order of the same subjects); '' if none. */
export function matchIitStream(raw: unknown, options: string[]): string {
  if (!String(raw || '').trim()) return ''
  const key = streamKey(raw)
  return options.find((option) => streamKey(option) === key) || ''
}

/** Option label: "MBiPC — Maths, Biology, Physics, Chemistry". */
export function iitStreamLabel(stream: string): string {
  const subjects = iitStreamSubjects(stream)
  return subjects.length ? `${stream} — ${subjects.join(', ')}` : stream
}
