/**
 * Dual-approval helpers for leaves — ported from web components/leaves/LeaveApprovalStatus.tsx
 * and app/dashboard/leaves/pending/page.tsx.
 */

export type LeavePerson = { _id?: string; name?: string; role?: string } | string | null | undefined;

export type LeaveApproval = {
  slot: 'zonal_manager' | 'product_head' | 'admin' | 'hr_manager' | string;
  label?: string;
  approverId?: LeavePerson;
  status: 'Pending' | 'Approved' | 'Rejected';
  decidedBy?: LeavePerson;
  decidedAt?: string | null;
  remarks?: string;
  override?: boolean;
  legacy?: boolean;
};

export type LeaveApprovalFields = {
  status: string;
  approvals?: LeaveApproval[];
  approvalSummary?: string;
  rejectionReason?: string;
  canDecide?: boolean;
  decidableSlots?: string[];
  decisionIsOverride?: boolean;
  canOverride?: boolean;
};

const SLOT_LABELS: Record<string, string> = {
  zonal_manager: 'Zonal Manager',
  product_head: 'Product Head',
  admin: 'Admin',
  hr_manager: 'HR Manager',
};

export const personName = (p: LeavePerson) => (!p ? '' : typeof p === 'string' ? '' : p.name || '');

export const slotLabel = (slot: string) => SLOT_LABELS[slot] || slot;

export function leaveStatusColors(status: string): { bg: string; text: string } {
  if (status === 'Approved') return { bg: '#DCFCE7', text: '#15803D' };
  if (status === 'Rejected') return { bg: '#FEE2E2', text: '#B91C1C' };
  return { bg: '#FEF9C3', text: '#A16207' };
}

export function decisionText(a: LeaveApproval): string {
  if (a.status === 'Pending') {
    const assigned = personName(a.approverId);
    if ((a.slot === 'zonal_manager' || a.slot === 'product_head') && !a.approverId) {
      return `Pending — no ${slotLabel(a.slot)} assigned (Admin can decide)`;
    }
    return assigned ? `Pending — ${assigned}` : 'Pending';
  }
  const by = personName(a.decidedBy);
  const when = a.decidedAt ? new Date(a.decidedAt).toLocaleDateString() : '';
  return [a.status, by && `by ${by}`, when && `on ${when}`].filter(Boolean).join(' ');
}

/** Admin can approve every pending slot at once when their own decision would not finish it. */
export function showOverride(l: LeaveApprovalFields): boolean {
  if (!l.canOverride) return false;
  const pending = (l.approvals || []).filter((a) => a.status === 'Pending').map((a) => a.slot);
  const mine = l.decidableSlots || [];
  return pending.some((slot) => !mine.includes(slot));
}

/** "Admin override: HR Manager" / "As Zonal Manager" */
export function decisionRoleText(l: LeaveApprovalFields): string {
  return `${l.decisionIsOverride ? 'Admin override: ' : 'As '}${(l.decidableSlots || []).map(slotLabel).join(' & ')}`;
}

export function waitingText(l: LeaveApprovalFields, isOwn = false): string {
  if (isOwn) return 'Your own leave';
  const pending = (l.approvals || []).filter((a) => a.status === 'Pending');
  if (pending.length === 0) return l.approvalSummary || '—';
  return `Waiting for ${pending.map((a) => a.label || slotLabel(a.slot)).join(' & ')}`;
}

/** Leaves waiting on this viewer's decision come first. */
export function sortDecidableFirst<T extends LeaveApprovalFields>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(!!b.canDecide) - Number(!!a.canDecide));
}
