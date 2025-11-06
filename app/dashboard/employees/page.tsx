'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type Employee = { _id: string; name?: string; email?: string; department?: string; status?: string }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Employee[]>('/employees')
        setEmployees(data as any)
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Employees</h1>
      <Card className="p-4 text-sm">
        {!loading && employees.length === 0 && 'No employees found.'}
        {employees.slice(0, 30).map((e) => (
          <div key={e._id} className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b last:border-0 py-2">
            <div className="font-medium text-neutral-900">{e.name || 'Employee'}</div>
            <div className="text-neutral-600">{e.email || '-'}</div>
            <div className="text-neutral-600">{e.department || '-'}</div>
            <div className="text-neutral-500">{e.status || 'Active'}</div>
          </div>
        ))}
      </Card>
    </div>
  )
}


