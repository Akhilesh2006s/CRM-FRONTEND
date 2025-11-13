'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { PlusCircle, Users, Eye, UserPlus } from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

type ExecutiveManager = {
  _id: string
  name: string
  email: string
  phone?: string
  mobile?: string
  department?: string
  employeeCount?: number
}

type Employee = {
  _id: string
  name: string
  email: string
  role: string
  assignedCity?: string
  assignedArea?: string
  executiveManagerId?: string
}

export default function ExecutiveManagersPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [managers, setManagers] = useState<ExecutiveManager[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedManager, setSelectedManager] = useState<ExecutiveManager | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin')) {
      toast.error('Access denied. Admin privileges required.')
      router.push('/dashboard')
      return
    }
    loadManagers()
  }, [])

  const loadManagers = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<ExecutiveManager[]>('/executive-managers')
      setManagers(data || [])
    } catch (err: any) {
      toast.error('Failed to load Executive Managers')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openAssignDialog = async (manager: ExecutiveManager) => {
    setSelectedManager(manager)
    setSelectedEmployeeIds([])
    setAssignDialogOpen(true)
    try {
      // Load all active employees
      const allEmployees = await apiRequest<Employee[]>('/employees?isActive=true')
      console.log('All employees:', allEmployees.length)
      
      // Filter: Only Executive role (or old Employee role), not assigned to any Executive Manager
      const unassignedEmployees = allEmployees.filter(
        emp => {
          const isExecutive = emp.role === 'Executive' || emp.role === 'Employee' // Support old Employee role
          const notAssigned = !emp.executiveManagerId
          const notManager = emp.role !== 'Executive Manager' && emp.role !== 'Admin' && emp.role !== 'Super Admin'
          return isExecutive && notAssigned && notManager
        }
      )
      
      console.log('Unassigned executives:', unassignedEmployees.length)
      setEmployees(unassignedEmployees)
    } catch (err: any) {
      toast.error('Failed to load employees')
      console.error(err)
    }
  }

  const handleAssignEmployees = async () => {
    if (!selectedManager || selectedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setAssigning(true)
    try {
      await apiRequest(`/executive-managers/${selectedManager._id}/assign-employees`, {
        method: 'PUT',
        body: JSON.stringify({ employeeIds: selectedEmployeeIds }),
      })
      toast.success(`Successfully assigned ${selectedEmployeeIds.length} employee(s) to ${selectedManager.name}`)
      setAssignDialogOpen(false)
      loadManagers()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign employees')
    } finally {
      setAssigning(false)
    }
  }

  const filteredManagers = managers.filter(manager =>
    manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    manager.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Executive Managers</h1>
        <Link href="/dashboard/executive-managers/new">
          <Button>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Executive Manager
          </Button>
        </Link>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <div className="mb-4">
          <Input
            placeholder="Search Executive Managers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredManagers.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No Executive Managers found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredManagers.map((manager) => (
              <Card key={manager._id} className="p-4 bg-white border border-neutral-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{manager.name}</h3>
                    <p className="text-sm text-neutral-600">{manager.email}</p>
                    {manager.phone && <p className="text-sm text-neutral-600">{manager.phone}</p>}
                    {manager.department && <p className="text-sm text-neutral-500">{manager.department}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm">{manager.employeeCount || 0} Employees</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/executive-managers/${manager._id}/dashboard`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAssignDialog(manager)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Assign Employees
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Employees to {selectedManager?.name}</DialogTitle>
            <DialogDescription>
              Select employees to assign to this Executive Manager
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {employees.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-neutral-500 mb-2">No unassigned employees available</p>
                <p className="text-xs text-neutral-400 mb-3">
                  All employees with Executive role are already assigned to other managers, or you need to create more employees.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link href="/dashboard/employees/active">
                    <Button variant="outline" size="sm">
                      View All Employees
                    </Button>
                  </Link>
                  <Link href="/dashboard/employees/new">
                    <Button variant="outline" size="sm">
                      Create New Employee
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-neutral-500">
                    Showing {employees.length} unassigned employee(s) with Executive role
                  </p>
                  <Link href="/dashboard/employees/active">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View All Employees
                    </Button>
                  </Link>
                </div>
                {employees.map((employee) => (
                  <div key={employee._id} className="flex items-center space-x-2 p-2 border rounded hover:bg-neutral-50">
                    <Checkbox
                      checked={selectedEmployeeIds.includes(employee._id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEmployeeIds([...selectedEmployeeIds, employee._id])
                        } else {
                          setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== employee._id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-sm text-neutral-600">{employee.email} • {employee.role === 'Employee' ? 'Executive' : employee.role}</p>
                      {employee.assignedCity && (
                        <p className="text-xs text-neutral-500">City: {employee.assignedCity}</p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignEmployees} disabled={assigning || selectedEmployeeIds.length === 0}>
              {assigning ? 'Assigning...' : `Assign ${selectedEmployeeIds.length} Employee(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

