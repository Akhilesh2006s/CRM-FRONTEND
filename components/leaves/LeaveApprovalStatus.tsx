'use client'

/**
 * Dual-approval status for a leave: overall badge, a one-line summary
 * ("Approved by Zonal Manager, pending HR Manager") and each approver's decision.
 */

type Person = { _id?: string; name?: string; role?: string } | string | null | undefined

export type LeaveApproval = {
  slot: 'zonal_manager' | 'product_head' | 'admin' | 'hr_manager' | string
  label?: string
  approverId?: Person
  status: 'Pending' | 'Approved' | 'Rejected'
  decidedBy?: Person
  decidedAt?: string | null
  remarks?: string
  override?: boolean
  legacy?: boolean
}

export type LeaveApprovalFields = {
  status: string
  approvals?: LeaveApproval[]
  approvalSummary?: string
  rejectionReason?: string
  canDecide?: boolean
  decidableSlots?: string[]
  decisionIsOverride?: boolean
  canOverride?: boolean
}

const SLOT_LABELS: Record<string, string> = {
  zonal_manager: 'Zonal Manager',
  product_head: 'Product Head',
  admin: 'Admin',
  hr_manager: 'HR Manager',
}

const personName = (p: Person) => (!p ? '' : typeof p === 'string' ? '' : p.name || '')

export const slotLabel = (slot: string) => SLOT_LABELS[slot] || slot

export function leaveStatusBadgeClass(status: string) {
  if (status === 'Approved') return 'bg-green-100 text-green-700'
  if (status === 'Rejected') return 'bg-red-100 text-red-700'
  return 'bg-yellow-100 text-yellow-700'
}

function decisionText(a: LeaveApproval) {
  if (a.status === 'Pending') {
    const assigned = personName(a.approverId)
    if ((a.slot === 'zonal_manager' || a.slot === 'product_head') && !a.approverId) {
      return `Pending — no ${slotLabel(a.slot)} assigned (Admin can decide)`
    }
    return assigned ? `Pending — ${assigned}` : 'Pending'
  }
  const by = personName(a.decidedBy)
  const when = a.decidedAt ? new Date(a.decidedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  return [a.status, by && `by ${by}`, when && `on ${when}`].filter(Boolean).join(' ')
}

export function LeaveApprovalStatus({
  leave,
  compact = false,
}: {
  leave: LeaveApprovalFields
  compact?: boolean
}) {
  const approvals = leave.approvals || []
  const legacy = approvals.some((a) => a.legacy)
  return (
    <div className="space-y-1 text-left">
      <span
        className={`inline-flex px-2 py-1 rounded-full text-xs ${leaveStatusBadgeClass(leave.status)}`}
      >
        {leave.status}
      </span>
      {leave.approvalSummary && leave.approvalSummary !== leave.status && (
        <div className="text-xs text-neutral-700">{leave.approvalSummary}</div>
      )}
      {!compact && !legacy && approvals.length > 0 && (
        <ul className="text-xs text-neutral-600 space-y-0.5">
          {approvals.map((a) => (
            <li key={a.slot}>
              <span className="font-medium">{a.label || slotLabel(a.slot)}:</span>{' '}
              <span
                className={
                  a.status === 'Approved'
                    ? 'text-green-700'
                    : a.status === 'Rejected'
                      ? 'text-red-700'
                      : 'text-yellow-700'
                }
              >
                {decisionText(a)}
              </span>
              {a.override && <span className="ml-1 text-neutral-500">(Admin override)</span>}
              {a.remarks && <div className="pl-2 text-neutral-500">“{a.remarks}”</div>}
            </li>
          ))}
        </ul>
      )}
      {legacy && leave.status === 'Rejected' && leave.rejectionReason && (
        <div className="text-xs text-neutral-500">Reason: {leave.rejectionReason}</div>
      )}
    </div>
  )
}
