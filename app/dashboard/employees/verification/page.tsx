'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { displayRoleName } from '@/lib/roleLabels'
import { toast } from 'sonner'
import { formatEmployeeCode } from '@/lib/employeeCode'
import Link from 'next/link'

type Approval = {
  roleKey: string
  status: string
  note?: string
  userId?: { name?: string } | string | null
}

type Employee = {
  _id: string
  empCode?: string
  name: string
  email: string
  phone?: string
  mobile?: string
  department?: string
  designation?: string
  dateOfBirth?: string
  dateOfJoining?: string
  role: string
  zone?: string
  cluster?: string
  temporaryAddress?: string
  permanentAddress?: string
  aadhaarUrl?: string
  locationPhotoUrl?: string
  references?: { relation: string; name?: string; mobile: string; aadhaarUrl?: string }[]
  verificationStatus?: string
  approvals?: Approval[]
  executiveManagerId?: { name?: string } | string | null
  verticalManagerId?: { name?: string } | string | null
  onboardingChecklist?: string[]
  onboardingOtherNote?: string
  hasEmployeeRelationship?: boolean | null
  employeeRelationshipDetails?: { fullName?: string; relationship?: string; department?: string; designation?: string }
}

const ROLE_LABELS: Record<string, string> = {
  hr_manager: 'HR Manager',
  zonal_manager: 'Zonal Manager',
  training_head: 'Training Head',
  vertical_manager: 'Product Head',
}

export default function EmployeeVerificationPage() {
  const currentUser = getCurrentUser()
  const isHr = currentUser?.role === 'HR Manager' || currentUser?.role === 'HR Executive'
  const isAdmin =
    currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  const [list, setList] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)

  const canActOn = (roleKey: string) => {
    if (isAdmin || isHr) return true
    if (
      currentUser?.role === 'Executive Manager' ||
      currentUser?.role === 'Manager'
    ) {
      return (
        roleKey === 'zonal_manager' ||
        roleKey === 'vertical_manager' ||
        roleKey === 'training_head'
      )
    }
    return false
  }

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Employee[]>('/employees/verification/pending')
      setList(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load pending verifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const decide = async (
    employeeId: string,
    roleKey: string,
    decision: 'approve' | 'reject'
  ) => {
    if (decision === 'reject' && !String(notes[employeeId] || '').trim()) {
      toast.error('A rejection note is required')
      return
    }
    setActing(`${employeeId}-${roleKey}-${decision}`)
    try {
      await apiRequest(`/employees/${employeeId}/approvals`, {
        method: 'POST',
        body: JSON.stringify({
          roleKey,
          decision,
          note: notes[employeeId] || '',
        }),
      })
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Action failed')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
          {isHr ? 'New Employee Applications' : 'Employee Verification'}
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          {isHr
            ? 'The HR Manager and the employee’s head must both approve. The employee joins Active Employees and can log in only after both approvals.'
            : 'Approve as the employee’s head. The employee can log in only after you and the HR Manager have both approved.'}
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-600">Loading…</div>
      ) : list.length === 0 ? (
        <Card className="p-6 text-sm text-neutral-600">
          {isHr
            ? 'No new employee applications waiting for HR approval.'
            : 'No employees pending verification.'}
        </Card>
      ) : (
        list.map((emp) => (
          <Card
            key={emp._id}
            className="p-4 md:p-6 space-y-4 bg-neutral-50 border border-neutral-200"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{emp.empCode ? `${formatEmployeeCode(emp.empCode)} · ${emp.name}` : emp.name}</h2>
                <p className="text-sm text-neutral-600">
                  {displayRoleName(emp.role)} · {emp.email}
                  {emp.zone ? ` · Zone: ${emp.zone}` : ''}
                  {emp.cluster ? ` · Cluster: ${emp.cluster}` : ''}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-amber-100 text-amber-800">
                {emp.verificationStatus || 'pending'}
              </span>
              {(isAdmin || isHr) && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/employees/edit/${emp._id}`}>Edit employee</Link>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><p className="font-medium">Official company number</p><p className="text-neutral-700">{emp.phone || '—'}</p></div>
              <div><p className="font-medium">Personal mobile</p><p className="text-neutral-700">{emp.mobile || '—'}</p></div>
              <div><p className="font-medium">Department / Designation</p><p className="text-neutral-700">{[emp.department, emp.designation].filter(Boolean).join(' · ') || '—'}</p></div>
              <div><p className="font-medium">Joining date</p><p className="text-neutral-700">{emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '—'}</p></div>
              <div>
                <p className="font-medium">Temporary address</p>
                <p className="text-neutral-700">{emp.temporaryAddress || '—'}</p>
              </div>
              <div>
                <p className="font-medium">Permanent address</p>
                <p className="text-neutral-700">{emp.permanentAddress || '—'}</p>
              </div>
              <div>
                <p className="font-medium">Aadhaar</p>
                {emp.aadhaarUrl ? (
                  <a
                    className="text-blue-600 underline"
                    href={resolveUploadUrl(emp.aadhaarUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View upload
                  </a>
                ) : (
                  '—'
                )}
              </div>
              <div>
                <p className="font-medium">Location</p>
                {emp.locationPhotoUrl ? (
                  <a
                    className="text-blue-600 underline"
                    href={resolveUploadUrl(emp.locationPhotoUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View upload
                  </a>
                ) : (
                  '—'
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="font-medium">Onboarding checklist</p>
                <p className="text-neutral-700">{emp.onboardingChecklist?.length ? emp.onboardingChecklist.join(', ') : '—'}</p>
                {emp.onboardingOtherNote ? <p className="text-neutral-500">Other: {emp.onboardingOtherNote}</p> : null}
              </div>
              <div>
                <p className="font-medium">Employee relationship declaration</p>
                <p className="text-neutral-700">{emp.hasEmployeeRelationship === true ? 'Yes' : emp.hasEmployeeRelationship === false ? 'No' : '—'}</p>
                {emp.hasEmployeeRelationship && emp.employeeRelationshipDetails ? (
                  <p className="text-neutral-600">
                    {[emp.employeeRelationshipDetails.fullName, emp.employeeRelationshipDetails.relationship, emp.employeeRelationshipDetails.department, emp.employeeRelationshipDetails.designation].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>

            {emp.references && emp.references.length > 0 && (
              <div className="text-sm">
                <p className="font-medium mb-1">References</p>
                <ul className="list-disc pl-5 text-neutral-700">
                  {emp.references.map((r, i) => (
                    <li key={i}>
                      {r.relation}
                      {r.name ? ` — ${r.name}` : ''} — {r.mobile}
                      {r.aadhaarUrl ? (
                        <>
                          {' — '}
                          <a
                            className="text-blue-600 underline"
                            href={resolveUploadUrl(r.aadhaarUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Aadhaar
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <p className="font-medium text-sm">Approvals</p>
              {(emp.approvals || []).map((a) => (
                <div
                  key={a.roleKey}
                  className={`flex flex-wrap items-center justify-between gap-2 border rounded bg-white px-3 py-2 text-sm ${
                    a.roleKey === 'hr_manager' && a.status === 'pending'
                      ? 'border-amber-300 ring-1 ring-amber-100'
                      : 'border-neutral-200'
                  }`}
                >
                  <div>
                    <span className="font-medium">
                      {ROLE_LABELS[a.roleKey] || a.roleKey}
                    </span>
                    <span className="ml-2 text-neutral-500">({a.status})</span>
                  </div>
                  {a.status === 'pending' && canActOn(a.roleKey) && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={acting !== null}
                        onClick={() => decide(emp._id, a.roleKey, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={acting !== null}
                        onClick={() => decide(emp._id, a.roleKey, 'reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <Textarea
                className="bg-white"
                placeholder="Approval note (required when rejecting)"
                value={notes[emp._id] || ''}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [emp._id]: e.target.value }))
                }
              />
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
