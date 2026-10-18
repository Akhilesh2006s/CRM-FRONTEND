'use client'

export type ContractFields = {
  contract_years?: number | null
  contract_start?: string | Date | null
  contract_end?: string | Date | null
}

const fmt = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

/** Whole days from today to the contract end (negative once it has ended). */
export function contractDaysLeft(end: string | Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)
  return Math.round((last.getTime() - today.getTime()) / 86400000)
}

export function contractDueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Ended ${-daysLeft} day${daysLeft === -1 ? '' : 's'} ago`
  if (daysLeft === 0) return 'Ends today'
  return `Ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
}

/** Red once ended, amber within 60 days, green otherwise. */
export function contractDueTone(daysLeft: number): string {
  if (daysLeft < 0) return 'bg-red-100 text-red-700'
  if (daysLeft <= 60) return 'bg-amber-100 text-amber-800'
  return 'bg-green-100 text-green-700'
}

/** "2-year · 16 Dec 2024 – 16 Dec 2026" with a due badge; "—" when no contract is set. */
export function ContractPeriod({ contract, compact = false }: { contract?: ContractFields | null; compact?: boolean }) {
  if (!contract?.contract_end) return <span className="text-neutral-400">—</span>
  const daysLeft = contractDaysLeft(contract.contract_end)
  return (
    <div className="text-xs space-y-1 min-w-[150px]">
      <div className="text-neutral-800">
        {contract.contract_years ? <span className="font-semibold">{contract.contract_years}-year</span> : 'Contract'}
        {!compact && contract.contract_start && <> · {fmt(contract.contract_start)} – {fmt(contract.contract_end)}</>}
        {compact && <> · ends {fmt(contract.contract_end)}</>}
      </div>
      <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${contractDueTone(daysLeft)}`}>
        {contractDueLabel(daysLeft)}
      </span>
    </div>
  )
}
