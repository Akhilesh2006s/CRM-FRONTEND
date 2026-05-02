/**
 * Student type / follow-up DC options (Raise DC UI). Only "Shortage" is wired end-to-end elsewhere.
 */
export const STUDENT_TYPE_OPTIONS = [
  'NA',
  'Training-Material',
  'New Students',
  'Old Students',
  'Excess',
  'Exchange',
  'Shortage',
  'Excess-OldStudents',
  'Excess-NewStudents',
] as const

export type StudentTypeOption = (typeof STUDENT_TYPE_OPTIONS)[number]

/** Radix Select requires a concrete value; this item means "no selection" in parent state. */
export const STUDENT_TYPE_PLACEHOLDER = '__student_type_none__'

export function isShortageStudentType(value: string | undefined | null): boolean {
  return (value || '').trim() === 'Shortage'
}

/** Value passed to Select `value` from stored map entry (empty = placeholder). */
export function followUpStudentTypeSelectValue(stored: string | undefined): string {
  return stored && stored.length > 0 ? stored : STUDENT_TYPE_PLACEHOLDER
}

export function parseFollowUpStudentTypeSelectValue(v: string): string {
  return v === STUDENT_TYPE_PLACEHOLDER ? '' : v
}
