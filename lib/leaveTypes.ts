/** Matches backend `Leave.leaveType` enum in `backend/models/Leave.js`. */
export const LEAVE_TYPE_ENUM = [
  'Sick Leave',
  'Annual Leave',
  'Casual Leave',
  'Emergency Leave',
  'Other',
] as const

export type LeaveTypeValue = (typeof LEAVE_TYPE_ENUM)[number]

/**
 * Request-form options: UI label vs stored enum value.
 * "Earned Leave" is the display name for schema value "Annual Leave".
 */
export const LEAVE_TYPE_OPTIONS: { label: string; value: LeaveTypeValue }[] = [
  { label: 'Casual Leave', value: 'Casual Leave' },
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Earned Leave', value: 'Annual Leave' },
  { label: 'Other', value: 'Other' },
]

const LABEL_BY_VALUE: Record<string, string> = {
  'Sick Leave': 'Sick Leave',
  'Annual Leave': 'Earned Leave',
  'Casual Leave': 'Casual Leave',
  'Emergency Leave': 'Emergency Leave',
  'Other': 'Other',
}

/** Map a stored enum value to the UI label without changing the record. */
export function leaveTypeLabel(value?: string | null): string {
  if (!value) return '-'
  return LABEL_BY_VALUE[value] ?? value
}
