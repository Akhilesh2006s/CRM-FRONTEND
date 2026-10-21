import { redirect } from 'next/navigation'

/** "Employee Requests" is now "Employee Verification" (one queue for Admin, Super Admin and HR). */
export default function EmployeeRequestsPage() {
  redirect('/dashboard/employees/verification')
}
