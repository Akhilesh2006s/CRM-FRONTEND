/**
 * Attendance row status: "Review" while the manager has to check it (e.g. End Day done the next
 * day, or a check-out that did not match the check-in), "Rejected" when they rejected it.
 * Same as web Team Attendance.
 */
type Row = { endTime?: string | null; reviewStatus?: string | null };

export function attendanceBadge(row: Row, ended: string, open: string): string {
  if (row.reviewStatus === 'pending') return 'Review';
  if (row.reviewStatus === 'rejected') return 'Rejected';
  return row.endTime ? ended : open;
}

export function attendanceTone(row: Row): 'warning' | 'error' | 'neutral' | 'success' {
  if (row.reviewStatus === 'pending') return 'warning';
  if (row.reviewStatus === 'rejected') return 'error';
  return row.endTime ? 'neutral' : 'success';
}
