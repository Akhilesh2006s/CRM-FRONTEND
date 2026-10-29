/** Employee salary account (web: components/employees/BankDetailsFields.tsx). */
export type BankDetailsForm = {
  bankAccountHolderName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  bankBranch: string;
};

export const emptyBankDetails = (): BankDetailsForm => ({
  bankAccountHolderName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  bankBranch: '',
});

export function bankDetailsFromEmployee(emp: any): BankDetailsForm {
  const b = emp?.bankDetails || {};
  return {
    bankAccountHolderName: String(b.accountHolderName || ''),
    bankAccountNumber: String(b.accountNumber || ''),
    bankIfsc: String(b.ifsc || ''),
    bankName: String(b.bankName || ''),
    bankBranch: String(b.branch || ''),
  };
}

/** Error message, or null when the bank details are blank or complete. */
export function bankDetailsError(v: BankDetailsForm): string | null {
  const account = v.bankAccountNumber.replace(/\s+/g, '');
  const ifsc = v.bankIfsc.replace(/\s+/g, '').toUpperCase();
  if (!account && !ifsc) return null;
  if (!account || !ifsc) return 'Enter both the bank account number and the IFSC';
  if (!/^\d{6,20}$/.test(account)) return 'Bank account number must be 6 to 20 digits';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return 'IFSC must be 11 characters, like SBIN0001234';
  return null;
}

export function bankDetailsPayload(v: BankDetailsForm) {
  return {
    bankDetails: {
      accountHolderName: v.bankAccountHolderName.trim(),
      accountNumber: v.bankAccountNumber.replace(/\s+/g, ''),
      ifsc: v.bankIfsc.replace(/\s+/g, '').toUpperCase(),
      bankName: v.bankName.trim(),
      branch: v.bankBranch.trim(),
    },
  };
}
