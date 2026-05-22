export const PAYMENT_STATUS_OPTIONS = ['Pending', 'Approved', 'Hold', 'Rejected'] as const

export const PAYMENT_METHOD_OPTIONS = [
  'Cash',
  'UPI',
  'NEFT/RTGS',
  'Cheque',
  'Bank Transfer',
  'Credit Card',
  'Debit Card',
  'Online Payment',
  'Other',
] as const

export const DONE_PAGE_STATUS_OPTIONS = ['all', 'Approved'] as const
