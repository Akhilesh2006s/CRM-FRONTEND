'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Users, TrendingUp, Package, ShoppingCart, Calendar, MapPin, Building2, UserPlus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { INDIAN_STATES, STATE_CITIES, getCitiesForState } from '@/lib/indianStatesCities'

type DashboardData = {
  totalEmployees: number
  managerState?: string | null
  employeesByZone: Record<string, number>
  employeesByArea: Record<string, number>
  totalLeads: number
  leadsByStatus: Record<string, number>
  totalDCs: number
  dcsByStatus: Record<string, number>
  totalSales: number
  totalLeaves: number
  leavesByStatus: Record<string, number>
  employeeDetails: EmployeeDetail[]
}

type EmployeeDetail = {
  _id: string
  name: string
  email: string
  phone?: string
  assignedCity?: string
  assignedArea?: string
  role: string
  department?: string
  totalLeads: number
  totalDCs: number
  totalSales: number
  totalLeaves: number
  pendingLeaves: number
}

export default function ExecutiveManagerDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const managerId = params.managerId as string
  const currentUser = getCurrentUser()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [assignZoneDialogOpen, setAssignZoneDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null)
  const [zone, setZone] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignEmployeesDialogOpen, setAssignEmployeesDialogOpen] = useState(false)
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeDetail[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [updateManagerStateDialogOpen, setUpdateManagerStateDialogOpen] = useState(false)
  const [managerStateInput, setManagerStateInput] = useState('')
  const [availableZones, setAvailableZones] = useState<string[]>([])

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    loadDashboard()
  }, [fromDate, toDate])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      let url = `/executive-managers/${managerId}/dashboard`
      const params = new URLSearchParams()
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (params.toString()) url += `?${params.toString()}`
      
      const data = await apiRequest<DashboardData>(url)
      setDashboardData(data)
    } catch (err: any) {
      toast.error('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openAssignZoneDialog = (employee: EmployeeDetail) => {
    setSelectedEmployee(employee)
    
    // Get Executive Manager's state (from dashboard data)
    const managerState = dashboardData?.managerState || ''
    
    // Get available zones (cities) from the manager's state
    if (managerState) {
      const zones = getCitiesForState(managerState)
      setAvailableZones(zones)
      setZone(employee.assignedCity || '')
    } else {
      setAvailableZones([])
      setZone('')
    }
    
    setAssignZoneDialogOpen(true)
  }

  const openAssignEmployeesDialog = async () => {
    setSelectedEmployeeIds([])
    setAssignEmployeesDialogOpen(true)
    setLoadingEmployees(true)
    try {
      // Load all active employees
      const allEmployees = await apiRequest<any[]>('/employees?isActive=true')
      console.log('All employees loaded:', allEmployees.length)
      
      // Filter: Only Executive role, not assigned to any Executive Manager, exclude other roles
      const unassignedEmployees = allEmployees.filter(
        (emp: any) => {
          const isExecutive = emp.role === 'Executive' || emp.role === 'Employee' // Support old Employee role
          const notAssigned = !emp.executiveManagerId
          const notManager = emp.role !== 'Executive Manager' && emp.role !== 'Admin' && emp.role !== 'Super Admin'
          return isExecutive && notAssigned && notManager
        }
      )
      
      console.log('Unassigned executives:', unassignedEmployees.length)
      console.log('Unassigned employees details:', unassignedEmployees.map((e: any) => ({ name: e.name, role: e.role, executiveManagerId: e.executiveManagerId })))
      
      setAvailableEmployees(unassignedEmployees.map((emp: any) => ({
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        assignedCity: emp.assignedCity,
        assignedArea: emp.assignedArea,
        role: emp.role === 'Employee' ? 'Executive' : emp.role, // Show as Executive
        department: emp.department,
        totalLeads: 0,
        totalDCs: 0,
        totalSales: 0,
        totalLeaves: 0,
        pendingLeaves: 0,
      })))
    } catch (err: any) {
      toast.error('Failed to load employees')
      console.error('Error loading employees:', err)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleAssignEmployees = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setAssigning(true)
    try {
      await apiRequest(`/executive-managers/${managerId}/assign-employees`, {
        method: 'PUT',
        body: JSON.stringify({ employeeIds: selectedEmployeeIds }),
      })
      toast.success(`Successfully assigned ${selectedEmployeeIds.length} employee(s)`)
      setAssignEmployeesDialogOpen(false)
      loadDashboard()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign employees')
    } finally {
      setAssigning(false)
    }
  }

  const handleAssignZone = async () => {
    if (!selectedEmployee) {
      toast.error('No employee selected')
      return
    }

    if (!zone || !zone.trim()) {
      toast.error('Please select a zone (city)')
      return
    }

    setAssigning(true)
    try {
      await apiRequest('/executive-managers/assign-zone', {
        method: 'PUT',
        body: JSON.stringify({ 
          employeeId: selectedEmployee._id, 
          zone: zone.trim(),
        }),
      })
      toast.success(`Zone assigned successfully to ${selectedEmployee.name}`)
      setAssignZoneDialogOpen(false)
      setZone('')
      loadDashboard()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign zone')
    } finally {
      setAssigning(false)
    }
  }

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>
  }

  if (!dashboardData) {
    return <div className="text-center py-8">No data available</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/executive-managers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Managers
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Executive Manager Dashboard</h1>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button onClick={openAssignEmployeesDialog}>
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Employees
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setManagerStateInput(dashboardData?.managerState || '')
                  setUpdateManagerStateDialogOpen(true)
                }}
              >
                <MapPin className="w-4 h-4 mr-2" />
                {dashboardData?.managerState ? 'Update State' : 'Set State'}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push(`/dashboard/executive-managers/${managerId}/leaves`)}>
            <Calendar className="w-4 h-4 mr-2" />
            Manage Leaves
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-4 bg-neutral-50 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white"
            />
          </div>
          <div>
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setFromDate(''); setToDate(''); }}>
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Employees</p>
              <p className="text-2xl font-bold">{dashboardData.totalEmployees}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Leads</p>
              <p className="text-2xl font-bold">{dashboardData.totalLeads}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total DCs</p>
              <p className="text-2xl font-bold">{dashboardData.totalDCs}</p>
            </div>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Sales</p>
              <p className="text-2xl font-bold">{dashboardData.totalSales}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-white border border-neutral-200">
          <h3 className="font-semibold mb-3 flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            Employees by Zone
          </h3>
          <div className="space-y-2">
            {Object.keys(dashboardData.employeesByZone).length === 0 ? (
              <p className="text-sm text-neutral-500">No zone assignments yet</p>
            ) : (
              Object.entries(dashboardData.employeesByZone).map(([zone, count]) => (
                <div key={zone} className="flex justify-between items-center">
                  <span className="text-sm">{zone}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Employee Details Table */}
      <Card className="p-4 bg-white border border-neutral-200">
        <h3 className="font-semibold mb-4">Employee Performance Details</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>DCs</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Leaves</TableHead>
                <TableHead>Pending Leaves</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardData.employeeDetails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-neutral-500">
                    No employees assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                dashboardData.employeeDetails.map((employee) => (
                  <TableRow key={employee._id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.assignedCity || '-'}</TableCell>
                    <TableCell>{employee.totalLeads}</TableCell>
                    <TableCell>{employee.totalDCs}</TableCell>
                    <TableCell>{employee.totalSales}</TableCell>
                    <TableCell>{employee.totalLeaves}</TableCell>
                    <TableCell>
                      {employee.pendingLeaves > 0 ? (
                        <span className="text-orange-600 font-semibold">{employee.pendingLeaves}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignZoneDialog(employee)}
                      >
                        Assign Zone
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={assignZoneDialogOpen} onOpenChange={setAssignZoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Zone to {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Assign or update the zone (city) for this employee. Zones are cities from the Executive Manager's assigned state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Zone (City) *</Label>
              {!dashboardData?.managerState ? (
                <>
                  <Input
                    value={zone}
                    disabled
                    className="bg-neutral-100 cursor-not-allowed"
                    placeholder="Executive Manager's state must be set first"
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Executive Manager's state is not set. Please update the manager's state first.
                  </p>
                </>
              ) : availableZones.length === 0 ? (
                <Input
                  value={zone}
                  disabled
                  className="bg-neutral-100 cursor-not-allowed"
                  placeholder="No zones available for this state"
                />
              ) : (
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select zone (city)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableZones.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {dashboardData?.managerState && availableZones.length > 0 && (
                <p className="text-xs text-neutral-500 mt-1">
                  {availableZones.length} zone(s) available from {dashboardData.managerState}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setAssignZoneDialogOpen(false)
                setZone('')
              }}>Cancel</Button>
              <Button onClick={handleAssignZone} disabled={assigning || !zone}>
                {assigning ? 'Assigning...' : 'Assign Zone'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignEmployeesDialogOpen} onOpenChange={setAssignEmployeesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Employees to Executive Manager</DialogTitle>
            <DialogDescription>
              Select employees (Executives) to assign to this Executive Manager
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loadingEmployees ? (
              <div className="text-center py-4">Loading employees...</div>
            ) : availableEmployees.length === 0 ? (
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
                    Showing {availableEmployees.length} unassigned employee(s) with Executive role
                  </p>
                  <Link href="/dashboard/employees/active">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View All Employees
                    </Button>
                  </Link>
                </div>
                {availableEmployees.map((employee) => (
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
                      <p className="text-sm text-neutral-600">{employee.email} • {employee.role}</p>
                      {employee.assignedCity && (
                        <p className="text-xs text-neutral-500">City: {employee.assignedCity}</p>
                      )}
                      {employee.department && (
                        <p className="text-xs text-neutral-500">Dept: {employee.department}</p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAssignEmployeesDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignEmployees} disabled={assigning || selectedEmployeeIds.length === 0}>
              {assigning ? 'Assigning...' : `Assign ${selectedEmployeeIds.length} Employee(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Manager State Dialog */}
      <Dialog open={updateManagerStateDialogOpen} onOpenChange={setUpdateManagerStateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Executive Manager's State</DialogTitle>
            <DialogDescription>
              Set or update the state for this Executive Manager. Cities in this state will become zones that can be assigned to employees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>State *</Label>
              <Select value={managerStateInput} onValueChange={setManagerStateInput}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {managerStateInput && (
                <p className="text-xs text-neutral-500 mt-1">
                  {getCitiesForState(managerStateInput).length} zone(s) (cities) available in {managerStateInput}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setUpdateManagerStateDialogOpen(false)
                setManagerStateInput('')
              }}>Cancel</Button>
              <Button 
                onClick={async () => {
                  if (!managerStateInput.trim()) {
                    toast.error('Please select a state')
                    return
                  }
                  setAssigning(true)
                  try {
                    await apiRequest(`/executive-managers/${managerId}/state`, {
                      method: 'PUT',
                      body: JSON.stringify({ state: managerStateInput.trim() }),
                    })
                    toast.success('Executive Manager state updated successfully')
                    setUpdateManagerStateDialogOpen(false)
                    setManagerStateInput('')
                    loadDashboard()
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to update state')
                  } finally {
                    setAssigning(false)
                  }
                }} 
                disabled={assigning}
              >
                {assigning ? 'Updating...' : 'Update State'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

