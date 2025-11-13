'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { MapPin, Building2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Employee = {
  _id: string
  name: string
  email: string
  phone?: string
  mobile?: string
  assignedCity?: string
  assignedArea?: string
  role: string
}

export default function AssignAreasPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [assignAreaDialogOpen, setAssignAreaDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [area, setArea] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (currentUser.role !== 'Executive') {
      toast.error('Access denied. Executive role required.')
      router.push('/dashboard')
      return
    }
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      // Filter to show only employees with assigned cities
      const employeesWithCities = (data || []).filter(emp => emp.assignedCity)
      setEmployees(employeesWithCities)
    } catch (err: any) {
      toast.error('Failed to load employees')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openAssignAreaDialog = (employee: Employee) => {
    setSelectedEmployee(employee)
    setArea(employee.assignedArea || '')
    setAssignAreaDialogOpen(true)
  }

  const handleAssignArea = async () => {
    if (!selectedEmployee || !area.trim()) {
      toast.error('Please enter an area')
      return
    }

    setAssigning(true)
    try {
      await apiRequest('/executive-managers/assign-area', {
        method: 'PUT',
        body: JSON.stringify({ employeeId: selectedEmployee._id, area: area.trim() }),
      })
      toast.success(`Area assigned successfully to ${selectedEmployee.name}`)
      setAssignAreaDialogOpen(false)
      loadEmployees()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign area')
    } finally {
      setAssigning(false)
    }
  }

  const uniqueCities = Array.from(new Set(employees.map(emp => emp.assignedCity).filter(Boolean)))

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCity = !cityFilter || emp.assignedCity === cityFilter
    return matchesSearch && matchesCity
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 flex items-center">
        <Building2 className="w-6 h-6 mr-2" />
        Assign Areas to Employees
      </h1>

      {/* Filters */}
      <Card className="p-4 bg-neutral-50 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Search Employees</Label>
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white"
            />
          </div>
          <div>
            <Label>Filter by City</Label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white"
            >
              <option value="">All Cities</option>
              {uniqueCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Employees Table */}
      <Card className="p-4 bg-white border border-neutral-200">
        <h3 className="font-semibold mb-4 flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          Employees with Assigned Cities
        </h3>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No employees found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee._id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.phone || employee.mobile || '-'}</TableCell>
                    <TableCell>{employee.assignedCity || '-'}</TableCell>
                    <TableCell>{employee.assignedArea || <span className="text-neutral-400">Not assigned</span>}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignAreaDialog(employee)}
                      >
                        {employee.assignedArea ? 'Update Area' : 'Assign Area'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={assignAreaDialogOpen} onOpenChange={setAssignAreaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Area to {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Assign or update the area for this employee in {selectedEmployee?.assignedCity}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Area</Label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Enter area name"
                className="bg-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignAreaDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignArea} disabled={assigning}>
                {assigning ? 'Assigning...' : 'Assign Area'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}



