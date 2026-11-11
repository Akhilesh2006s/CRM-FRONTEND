/**
 * Employee form wording and rules shared by the app form (src/screens/Employees/EmployeeNewScreen.tsx).
 * The web keeps an identical copy in lib/employeeHrms.ts; the backend rules
 * live in backend/utils/employeeFields.js.
 */

/** Onboarding checklist, in this order. */
export const ONBOARDING_ITEMS = [
  'Offer Letter',
  'Product Training',
  'Management Interaction',
  'Account Session',
  'Trainer Kit',
  'Marketing Kit (BDE)',
  'App Training',
  'SIM',
  'ID Cards',
  'Visiting Cards',
  'Laptop',
  'Others',
] as const

const LEGACY_ONBOARDING_ITEMS: Record<string, string> = {
  'Visiting cards': 'Visiting Cards',
  'Id cards': 'ID Cards',
  Sim: 'SIM',
  'Training Manuals': 'Trainer Kit',
}

/** Saved checklist → current item names, in checklist order. */
export function onboardingFromSaved(saved: unknown): string[] {
  const picked = (Array.isArray(saved) ? saved : []).map((item) => {
    const name = String(item || '').trim()
    return LEGACY_ONBOARDING_ITEMS[name] || name
  })
  return ONBOARDING_ITEMS.filter((item) => picked.includes(item))
}

/** Products not yet ticked under Product Training. */
export function productsLeftForTraining(productNames: string[], ticked: string[]): string[] {
  const done = new Set(ticked.map((name) => name.toLowerCase()))
  return productNames.filter((name) => !done.has(name.toLowerCase()))
}

/** Problem with the onboarding checklist, or null. */
export function onboardingError(checklist: string[], ticked: string[], otherNote: string, productNames: string[]): string | null {
  if (checklist.length < 2) return 'Select at least two onboarding checklist items'
  if (checklist.includes('Product Training') && productsLeftForTraining(productNames, ticked).length) {
    return 'Tick every product before Product Training'
  }
  if (checklist.includes('Others') && !otherNote.trim()) return 'Enter what the Others onboarding item is'
  return null
}

export type PermanentAddressDetails = {
  doorNo: string
  street: string
  villageTownCity: string
  landmark: string
  pincode: string
  mandal: string
  district: string
  state: string
}

/** Permanent address parts with their labels; every part except District is required. */
export const PERMANENT_ADDRESS_FIELDS: { key: keyof PermanentAddressDetails; label: string; required: boolean }[] = [
  { key: 'doorNo', label: 'Door / House No.', required: true },
  { key: 'street', label: 'Street Name / Locality', required: true },
  { key: 'villageTownCity', label: 'Village / Town / City', required: true },
  { key: 'landmark', label: 'Landmark', required: true },
  { key: 'pincode', label: 'PIN Code', required: true },
  { key: 'mandal', label: 'Mandal / Sub-District', required: true },
  { key: 'district', label: 'District', required: false },
  { key: 'state', label: 'State', required: true },
]

export function emptyPermanentAddress(): PermanentAddressDetails {
  return { doorNo: '', street: '', villageTownCity: '', landmark: '', pincode: '', mandal: '', district: '', state: '' }
}

export function permanentAddressFromSaved(saved: any): PermanentAddressDetails {
  const out = emptyPermanentAddress()
  for (const { key } of PERMANENT_ADDRESS_FIELDS) out[key] = String(saved?.[key] || '')
  return out
}

export function isBlankPermanentAddress(details: PermanentAddressDetails): boolean {
  return PERMANENT_ADDRESS_FIELDS.every(({ key }) => !details[key].trim())
}

/** One-line address, the same text the backend stores in permanentAddress. */
export function formatPermanentAddress(details: PermanentAddressDetails): string {
  const parts = (['doorNo', 'street', 'landmark', 'villageTownCity', 'mandal', 'district', 'state'] as const)
    .map((key) => details[key].trim())
    .filter(Boolean)
  const pin = details.pincode.trim()
  return `${parts.join(', ')}${pin ? ` - ${pin}` : ''}`
}

/** Problem with an address (permanent or temporary; both have the same parts), or null. */
export function permanentAddressError(details: PermanentAddressDetails, title = 'Permanent address'): string | null {
  for (const { key, label, required } of PERMANENT_ADDRESS_FIELDS) {
    if (required && !details[key].trim()) return `${title}: ${label} is required`
  }
  if (!/^\d{6}$/.test(details.pincode.trim())) return `${title}: PIN Code must contain 6 digits`
  return null
}

/** Designation shown for a connected employee: their designation, else their user type. */
const ROLE_LABELS: Record<string, string> = {
  'Executive Manager': 'Zonal Manager',
  Manager: 'Product Manager',
  Executive: 'BDE',
  'Sales BDE': 'BDE',
  Employee: 'BDE',
}
export function employeeDesignation(employee: { role?: string; designation?: string } | null | undefined): string {
  if (!employee) return ''
  const designation = String(employee.designation || '').trim()
  if (designation) return designation
  const role = String(employee.role || '')
  return ROLE_LABELS[role] || role
}
