'use client'

import type { ReactNode } from 'react'
import { ymdToDmy } from '@/lib/dateFormat'
import { displayRoleName } from '@/lib/roleLabels'
import { formatEmployeeCode } from '@/lib/employeeCode'
import { employeeDocHref, employeeDocName } from '@/lib/employeeDocs'

type NamedRef = { _id: string; name?: string; role?: string }
type ProductRef = { _id: string; productName: string }

/** Stored date shown as DD/MM/YYYY on the Indian calendar ('' when missing). */
export function employeeDateText(value: unknown): string {
  if (!value) return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return ymdToDmy(text)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return ymdToDmy(new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10))
}

const idOf = (value: any) => String(value?._id || value || '')
const rupees = (value: unknown) =>
  Number(value) > 0 ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''
const yesNo = (value: unknown) => (value === true ? 'Yes' : value === false ? 'No' : '')

function Empty() {
  return <span className="text-neutral-400">—</span>
}

function Field({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  const blank = value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : undefined}>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-neutral-900">{blank ? <Empty /> : value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-700">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  )
}

function DocLink({ url }: { url?: string }) {
  if (!url) return null
  return (
    <a href={employeeDocHref(url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
      View / open ({employeeDocName(url)})
    </a>
  )
}

const doc = (url?: string) => (url ? <DocLink url={url} /> : '')
const chips = (items: string[]) => (items.length ? <Chips items={items} /> : '')

function Chips({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-800">
          {item}
        </span>
      ))}
    </div>
  )
}

/**
 * Every detail entered when the employee was created, grouped into sections with
 * readable labels. `employees` and `products` turn stored ids into names.
 */
export function EmployeeDetailsView({
  employee,
  employees = [],
  products = [],
}: {
  employee: Record<string, any>
  employees?: NamedRef[]
  products?: ProductRef[]
}) {
  const e = employee || {}
  const personName = (value: any) => {
    const id = idOf(value)
    if (!id) return ''
    if (value && typeof value === 'object' && value.name) return String(value.name)
    const found = employees.find((p) => p._id === id)
    return found ? `${found.name}${found.role ? ` (${displayRoleName(found.role)})` : ''}` : 'Employee not in the active list'
  }
  const productName = (value: any) => {
    const id = idOf(value)
    return products.find((p) => p._id === id)?.productName || (value?.productName ? String(value.productName) : 'Product')
  }
  const zones: string[] = Array.isArray(e.zones) && e.zones.length ? e.zones : e.zone ? [e.zone] : []
  const references: any[] = Array.isArray(e.references) ? e.references : []
  const relationship = e.employeeRelationshipDetails || {}
  const bank = e.bankDetails || {}
  const tagged: any[] = Array.isArray(e.taggedEmployeeIds) ? e.taggedEmployeeIds : []
  const assignedProducts: any[] = Array.isArray(e.assignedProductIds) ? e.assignedProductIds : []
  const ctc = Number(e.yearlySalary) || 0
  const status = e.isActive === false ? 'Inactive' : 'Active'

  return (
    <div className="space-y-4">
      <Section title="Personal details">
        <Field label="Full name" value={e.name} />
        <Field label="First name" value={e.firstName} />
        <Field label="Last name" value={e.lastName} />
        <Field label="Employee code" value={formatEmployeeCode(e.empCode, '')} />
        <Field label="Email" value={e.email} />
        <Field label="Date of birth" value={employeeDateText(e.dateOfBirth)} />
        <Field label="Date of joining" value={employeeDateText(e.dateOfJoining)} />
        <Field label="Status" value={status} />
      </Section>

      <Section title="Contact">
        <Field label="Company contact number" value={e.phone && e.phone !== '0' ? e.phone : ''} />
        <Field label="Personal mobile" value={e.mobile} />
      </Section>

      <Section title="Emergency contacts / references">
        {references.length === 0 ? (
          <Field label="References" value="" wide />
        ) : (
          references.map((ref, index) => (
            <div key={index} className="rounded border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-600">Reference {index + 1}</div>
              <dl className="space-y-2">
                <Field label="Relationship" value={ref?.relation} />
                <Field label="Name" value={ref?.name} />
                <Field label="Mobile" value={ref?.mobile} />
                <Field label="Aadhaar" value={doc(ref?.aadhaarUrl)} />
              </dl>
            </div>
          ))
        )}
      </Section>

      <Section title="Relatives / friends in the company">
        <Field label="Declared a connection" value={yesNo(e.hasEmployeeRelationship)} />
        {e.hasEmployeeRelationship === true && (
          <>
            <Field label="Full name" value={relationship.fullName} />
            <Field label="Relationship" value={relationship.relationship} />
            <Field label="Department" value={relationship.department} />
            <Field label="Designation" value={relationship.designation} />
          </>
        )}
      </Section>

      <Section title="Addresses">
        <Field label="Permanent address" value={e.permanentAddress} wide />
        <Field label="Temporary / current address" value={e.temporaryAddress || e.address1} wide />
        <Field label="Pincode" value={e.pincode} />
        <Field label="City" value={e.city} />
        <Field label="District" value={e.district} />
        <Field label="State" value={e.state} />
      </Section>

      <Section title="Work">
        <Field label="User type / role" value={displayRoleName(e.role)} />
        <Field label="Designation" value={e.designation} />
        <Field label="Department" value={e.department} />
        <Field label={zones.length > 1 ? 'Zones' : 'Zone'} value={chips(zones)} />
        <Field label="Cluster" value={e.cluster} />
        <Field label="Reporting manager" value={personName(e.executiveManagerId)} />
        {(e.role === 'Trainer' || (Array.isArray(e.trainerProducts) && e.trainerProducts.length > 0)) && (
          <>
            <Field label="Trainer products" value={chips(Array.isArray(e.trainerProducts) ? e.trainerProducts : [])} />
            <Field label="Product Head" value={personName(e.verticalManagerId)} />
          </>
        )}
        {(e.role === 'Manager' || assignedProducts.length > 0) && (
          <Field label="Assigned products" value={chips(assignedProducts.map(productName))} />
        )}
        <Field label="Tagged employees" value={chips(tagged.map(personName).filter(Boolean))} wide />
        <Field label="Onboarding checklist" value={chips(Array.isArray(e.onboardingChecklist) ? e.onboardingChecklist : [])} wide />
        {e.onboardingOtherNote ? <Field label="Onboarding note (Others)" value={e.onboardingOtherNote} wide /> : null}
      </Section>

      <Section title="Payroll / CTC">
        <Field label="CTC (per year)" value={rupees(ctc)} />
        <Field label="CTC per month" value={ctc > 0 ? rupees(Math.round(ctc / 12)) : ''} />
        <Field label="Monthly take-home" value={rupees(e.monthlyTakeHome)} />
        <Field label="UAN (PF)" value={e.uanNumber} />
        <Field label="ESI number" value={e.esiNumber} />
        <Field label="PF applicable" value={yesNo(typeof e.pfApplicable === 'boolean' ? e.pfApplicable : Boolean(e.uanNumber))} />
        <Field label="ESI applicable" value={yesNo(typeof e.esiApplicable === 'boolean' ? e.esiApplicable : Boolean(e.esiNumber))} />
        <Field label="Professional tax applicable" value={yesNo(e.ptApplicable !== false)} />
        <Field label="Monthly TDS" value={rupees(e.monthlyTds)} />
      </Section>

      <Section title="Bank details">
        <Field label="Account holder name" value={bank.accountHolderName} />
        <Field label="Account number" value={bank.accountNumber} />
        <Field label="IFSC" value={bank.ifsc} />
        <Field label="Bank name" value={bank.bankName} />
        <Field label="Branch" value={bank.branch} />
        <Field label="Passbook / cancelled cheque" value={doc(e.bankPassbookUrl)} />
      </Section>

      <Section title="Documents">
        <Field label="Aadhaar" value={doc(e.aadhaarUrl)} />
        <Field label="Location" value={doc(e.locationPhotoUrl)} />
        <Field label="Passport size photo" value={doc(e.passportPhotoUrl)} />
        <Field label="Bank passbook" value={doc(e.bankPassbookUrl)} />
        {references.map((ref, index) => (
          <Field key={index} label={`Reference ${index + 1} Aadhaar`} value={doc(ref?.aadhaarUrl)} />
        ))}
      </Section>

      {(e.offboardingStatus || (Array.isArray(e.offboardingChecklist) && e.offboardingChecklist.length > 0)) && (
        <Section title="Offboarding">
          <Field label="Status" value={e.offboardingStatus} />
          <Field label="Checklist" value={chips(Array.isArray(e.offboardingChecklist) ? e.offboardingChecklist : [])} wide />
        </Section>
      )}

      <Section title="Record">
        <Field label="Added on" value={employeeDateText(e.createdAt)} />
        <Field label="Last updated" value={employeeDateText(e.updatedAt)} />
      </Section>
    </div>
  )
}
