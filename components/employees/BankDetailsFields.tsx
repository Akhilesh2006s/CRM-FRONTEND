'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Salary account; the Finance Executive's bank sheet pays expenses and advances into it. */
export type BankDetails = {
  accountHolderName: string
  accountNumber: string
  ifsc: string
  bankName: string
  branch: string
}

export const emptyBankDetails = (): BankDetails => ({
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  branch: '',
})

export function bankDetailsFromEmployee(emp: Record<string, any>): BankDetails {
  const b = emp?.bankDetails || {}
  return {
    accountHolderName: String(b.accountHolderName || ''),
    accountNumber: String(b.accountNumber || ''),
    ifsc: String(b.ifsc || ''),
    bankName: String(b.bankName || ''),
    branch: String(b.branch || ''),
  }
}

/** Error message, or null when the bank details are blank or complete. */
export function bankDetailsError(v: BankDetails): string | null {
  const account = v.accountNumber.replace(/\s+/g, '')
  const ifsc = v.ifsc.replace(/\s+/g, '').toUpperCase()
  if (!account && !ifsc) return null
  if (!account || !ifsc) return 'Enter both the bank account number and the IFSC'
  if (!/^\d{6,20}$/.test(account)) return 'Bank account number must be 6 to 20 digits'
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return 'IFSC must be 11 characters, like SBIN0001234'
  return null
}

export function bankDetailsPayload(v: BankDetails) {
  return {
    bankDetails: {
      accountHolderName: v.accountHolderName.trim(),
      accountNumber: v.accountNumber.replace(/\s+/g, ''),
      ifsc: v.ifsc.replace(/\s+/g, '').toUpperCase(),
      bankName: v.bankName.trim(),
      branch: v.branch.trim(),
    },
  }
}

export function BankDetailsFields({ value, onChange }: { value: BankDetails; onChange: (next: BankDetails) => void }) {
  const set = (patch: Partial<BankDetails>) => onChange({ ...value, ...patch })
  return (
    <div className="md:col-span-2 rounded-lg border border-neutral-200 p-3 space-y-3">
      <div>
        <div className="font-semibold text-neutral-900 text-sm">Bank details</div>
        <p className="text-xs text-neutral-500">Expenses and advances are paid into this account through the bank sheet.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="bankAccountHolder">Account holder name</Label>
          <Input id="bankAccountHolder" className="bg-white text-neutral-900" value={value.accountHolderName} onChange={(e) => set({ accountHolderName: e.target.value })} placeholder="As in the bank account" />
        </div>
        <div>
          <Label htmlFor="bankAccountNumber">Account number</Label>
          <Input id="bankAccountNumber" inputMode="numeric" maxLength={20} className="bg-white text-neutral-900" value={value.accountNumber} onChange={(e) => set({ accountNumber: e.target.value.replace(/\D/g, '') })} placeholder="6 to 20 digits" />
        </div>
        <div>
          <Label htmlFor="bankIfsc">IFSC</Label>
          <Input id="bankIfsc" maxLength={11} className="bg-white text-neutral-900 uppercase" value={value.ifsc} onChange={(e) => set({ ifsc: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() })} placeholder="e.g. SBIN0001234" />
        </div>
        <div>
          <Label htmlFor="bankName">Bank name</Label>
          <Input id="bankName" className="bg-white text-neutral-900" value={value.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="e.g. State Bank of India" />
        </div>
        <div>
          <Label htmlFor="bankBranch">Branch</Label>
          <Input id="bankBranch" className="bg-white text-neutral-900" value={value.branch} onChange={(e) => set({ branch: e.target.value })} placeholder="Branch name" />
        </div>
      </div>
    </div>
  )
}
