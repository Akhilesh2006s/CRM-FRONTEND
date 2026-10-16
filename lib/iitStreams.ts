/** Fixed IIT subject combinations. Keep in sync with backend/utils/iitStockRows.js. */
export const IIT_STREAM_OPTIONS = [
  { value: 'MPC', label: 'MPC — Maths, Physics, Chemistry' },
  { value: 'BiPC', label: 'BiPC — Biology, Physics, Chemistry' },
  { value: 'MBiPC', label: 'MBiPC — Maths, Biology, Physics, Chemistry' },
] as const

const TOKENS: [string, string][] = [['bi', 'B'], ['b', 'B'], ['m', 'M'], ['p', 'P'], ['c', 'C']]

function subjectKey(raw: string): string {
  let rest = raw.toLowerCase().replace(/[^a-z]/g, '')
  const letters = new Set<string>()
  while (rest) {
    const match = TOKENS.find(([token]) => rest.startsWith(token))
    if (!match) return ''
    letters.add(match[1])
    rest = rest.slice(match[0].length)
  }
  return [...letters].sort().join('')
}

/** Map any spelling of a combination (e.g. "MPCBi", "mbipc") to its standard option; '' if unknown. */
export function canonicalIitStream(raw: unknown): string {
  const key = subjectKey(String(raw || ''))
  if (!key) return ''
  return IIT_STREAM_OPTIONS.find((option) => subjectKey(option.value) === key)?.value || ''
}
