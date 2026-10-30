'use client'

import { useParams } from 'next/navigation'
import { EmployeeForm } from '@/components/employees/EmployeeForm'

/** Edit every detail entered when the employee was created (password excluded; use Reset Password). */
export default function EditEmployeePage() {
  const params = useParams()
  const id = String(params?.id || '')
  if (!id) return <div className="p-6">Employee not found</div>
  return <EmployeeForm key={id} mode="edit" employeeId={id} />
}
