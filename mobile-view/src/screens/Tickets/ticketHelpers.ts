/** Shared bits of web components/tickets/TicketsInbox.tsx. */
export type TicketPerson = { name?: string; role?: string; designation?: string; trainerProducts?: string[] };

export type Ticket = {
  _id: string;
  raisedBy?: TicketPerson | string | null;
  subject: string;
  description: string;
  schoolName?: string;
  schoolCode?: string;
  status: 'Open' | 'Resolved';
  resolutionNote?: string;
  createdAt: string;
};

/** Stored ticket status → the label used everywhere in the app. */
export function ticketStatusLabel(status: Ticket['status']) {
  return status === 'Resolved' ? 'Solved' : 'Pending';
}

const BDE_ROLES = new Set(['Executive', 'Sales BDE', 'Employee', 'BDE']);

export function personName(value?: TicketPerson | string | null) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name || '—';
}

/** The raiser's own designation (e.g. "Abacus Trainer"); falls back to their role. */
export function personDesignation(value?: TicketPerson | string | null) {
  if (!value || typeof value === 'string') return '—';
  const designation = String(value.designation || '').trim();
  if (designation) return designation;
  const role = String(value.role || '').trim();
  if (role === 'Trainer' && value.trainerProducts?.length) return `${value.trainerProducts.join(' / ')} Trainer`;
  return BDE_ROLES.has(role) ? 'BDE' : role || '—';
}

export function fmtTicketDate(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
