import { colors } from '../../theme/colors';

export const ALL_PAYMENT_MODES = ['Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other'];

export const inr = (n: any) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

export function fmtDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Mirrors getPaymentDetails() in web app/dashboard/payments/done/page.tsx */
export function paymentDetailsText(p: any): string {
  const m = p?.paymentMethod;
  if (m === 'UPI' && p.upiId) return `UPI ID: ${p.upiId}`;
  if (m === 'NEFT/RTGS' && p.transactionId) return `Txn ID: ${p.transactionId}${p.ifscCode ? ` | IFSC: ${p.ifscCode}` : ''}`;
  if (m === 'Cheque' && p.chequeNumber) return `Cheque No: ${p.chequeNumber}${p.bankName ? ` | Bank: ${p.bankName}` : ''}`;
  if (m === 'Bank Transfer' && p.transactionId) return `Txn ID: ${p.transactionId}${p.bankName ? ` | Bank: ${p.bankName}` : ''}`;
  if ((m === 'Credit Card' || m === 'Debit Card') && p.cardLast4) return `Card: ****${p.cardLast4}${p.bankName ? ` | ${p.bankName}` : ''}`;
  if (m === 'Online Payment' && p.transactionId) return `Txn ID: ${p.transactionId}${p.paymentGateway ? ` | Gateway: ${p.paymentGateway}` : ''}`;
  if (m === 'Other' && p.otherDetails) return p.otherDetails;
  if (p?.referenceNumber) return `Ref: ${p.referenceNumber}`;
  if (p?.refNo) return `Ref: ${p.refNo}`;
  return '-';
}

/** Hold / Rejected show the admin's reason; other statuses show the BDE's remarks. */
export function paymentRemarks(p: any): string {
  if (p?.status === 'Rejected' || p?.status === 'Hold') {
    return p.rejectionReason || p.adminRemarks || p.description || '-';
  }
  return p?.description || '-';
}

export function statusColors(status?: string): { fg: string; bg: string } {
  switch (status) {
    case 'Approved':
      return { fg: colors.success, bg: colors.successLight };
    case 'Hold':
      return { fg: '#C2410C', bg: '#FFEDD5' };
    case 'Rejected':
      return { fg: colors.error, bg: colors.errorLight };
    default:
      return { fg: colors.warning, bg: colors.warningLight };
  }
}

export function nameOf(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.name || v.zoneName || v.clusterName || '';
}
