/** Matches backend `Leave.leaveType` enum in `backend/models/Leave.js`. */
export const LEAVE_TYPE_OPTIONS = [
  { label: 'Casual Leave', value: 'Casual Leave' },
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Earned Leave', value: 'Annual Leave' },
  { label: 'Other', value: 'Other' },
] as const;

const LABEL_BY_VALUE: Record<string, string> = {
  'Sick Leave': 'Sick Leave',
  'Annual Leave': 'Earned Leave',
  'Casual Leave': 'Casual Leave',
  'Emergency Leave': 'Emergency Leave',
  Other: 'Other',
};

export function leaveTypeLabel(value?: string | null): string {
  if (!value) return '-';
  return LABEL_BY_VALUE[value] ?? value;
}
