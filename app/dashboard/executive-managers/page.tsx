import { redirect } from 'next/navigation'

/** Executive Managers are managed under Users → Active Employees (role: Executive Manager). */
export default function ExecutiveManagersPage() {
  redirect('/dashboard/employees/active')
}
