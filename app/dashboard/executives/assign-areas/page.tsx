'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { canAccessPath } from '@/lib/access'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
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
  zone?: string
  cluster?: string
  role: string
}

type Zone = { _id: string; name: string }
type Cluster = { _id: string; name: string }
type School = { _id?: string; schoolName?: string; school_name?: string; name?: string; pincode?: string }

const ASSIGN_AREAS_PATH = '/dashboard/executives/assign-areas'

export default function AssignAreasPage() {
  const router = useRouter()
  const { user, permissionsReady, isSuperAdmin } = usePermissions()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [assignAreaDialogOpen, setAssignAreaDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [selectedCluster, setSelectedCluster] = useState('')
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [assigning, setAssigning] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)

  const loadEmployees = async () => {
    setLoading(true)
    try {
      const [response, zonesRaw] = await Promise.all([
        apiRequest<any>('/employees?isActive=true'),
        apiRequest<Zone[]>('/zones').catch(() => []),
      ])
      const list = Array.isArray(response) ? response : response?.data || []
      setEmployees(list)
      setZones(Array.isArray(zonesRaw) ? zonesRaw : [])
    } catch (err: any) {
      toast.error('Failed to load employees')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!permissionsReady) return

    if (!user) {
      router.push('/auth/login')
      return
    }

    const role = String(user.role || '').trim()
    const canAccess =
      isSuperAdmin ||
      role === 'Executive' ||
      role === 'Super Admin' ||
      canAccessPath(user, ASSIGN_AREAS_PATH)

    if (!canAccess) {
      toast.error('Access denied. You do not have permission to Assign Areas.')
      router.push('/dashboard')
      return
    }

    setAccessChecked(true)
    loadEmployees()
  }, [permissionsReady, user, isSuperAdmin, router])

  useEffect(() => {
    const loadClusters = async () => {
      if (!selectedZoneId) {
        setClusters([])
        return
      }
      try {
        const data = await apiRequest<Cluster[]>(`/zones/${selectedZoneId}/clusters`)
        setClusters(Array.isArray(data) ? data : [])
      } catch {
        setClusters([])
      }
    }
    loadClusters()
  }, [selectedZoneId])

  useEffect(() => {
    const loadSchools = async () => {
      if (!selectedCluster) {
        setSchools([])
        return
      }
      try {
        const list = await apiRequest<School[]>(
          `/schools?cluster=${encodeURIComponent(selectedCluster)}`
        )
        setSchools(Array.isArray(list) ? list : [])
      } catch {
        setSchools([])
      }
    }
    loadSchools()
  }, [selectedCluster])

  const openAssignAreaDialog = (employee: Employee) => {
    setSelectedEmployee(employee)
    const zoneMatch = zones.find(
      (z) => z.name === employee.zone || z.name === employee.assignedCity
    )
    setSelectedZoneId(zoneMatch?._id || '')
    setSelectedCluster(employee.cluster || employee.assignedArea || '')
    setAssignAreaDialogOpen(true)
  }

  const handleAssignArea = async () => {
    if (!selectedEmployee || !selectedCluster.trim()) {
      toast.error('Select a cluster to assign')
      return
    }
    const zoneName = zones.find((z) => z._id === selectedZoneId)?.name || selectedEmployee.zone || ''

    setAssigning(true)
    try {
      await apiRequest('/executive-managers/assign-area', {
        method: 'PUT',
        body: JSON.stringify({
          employeeId: selectedEmployee._id,
          cluster: selectedCluster.trim(),
          area: selectedCluster.trim(),
          zone: zoneName || undefined,
        }),
      })
      toast.success(`Cluster assigned to ${selectedEmployee.name}`)
      setAssignAreaDialogOpen(false)
      loadEmployees()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign cluster')
    } finally {
      setAssigning(false)
    }
  }

  const uniqueCities = Array.from(
    new Set(employees.map((emp) => emp.assignedCity || emp.zone).filter(Boolean))
  ) as string[]

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCity =
      !cityFilter || emp.assignedCity === cityFilter || emp.zone === cityFilter
    return matchesSearch && matchesCity
  })

  if (!permissionsReady || !accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-neutral-500 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 flex items-center">
          <Building2 className="w-6 h-6 mr-2" />
          Assign Areas (Clusters)
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Assign an existing cluster (and its schools) to an employee. New schools added to that cluster will fall under the same assignment.
        </p>
      </div>

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
            <Label>Filter by Zone / City</Label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-white"
            >
              <option value="">All</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white border border-neutral-200">
        <h3 className="font-semibold mb-4 flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          Employees
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
                  <TableHead>Zone</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee._id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.phone || employee.mobile || '-'}</TableCell>
                    <TableCell>{employee.zone || employee.assignedCity || '-'}</TableCell>
                    <TableCell>
                      {employee.cluster || employee.assignedArea || (
                        <span className="text-neutral-400">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignAreaDialog(employee)}
                      >
                        {employee.cluster || employee.assignedArea
                          ? 'Update Cluster'
                          : 'Assign Cluster'}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Cluster to {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Select a zone, then a cluster. Schools already in that cluster are listed below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Zone</Label>
              <Select
                value={selectedZoneId}
                onValueChange={(v) => {
                  setSelectedZoneId(v)
                  setSelectedCluster('')
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z._id} value={z._id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cluster *</Label>
              <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c._id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCluster && (
              <div className="border rounded p-3 bg-neutral-50 max-h-40 overflow-y-auto text-sm">
                <p className="font-medium mb-2">Schools in this cluster</p>
                {schools.length === 0 ? (
                  <p className="text-neutral-500">No schools found yet — new schools added to this cluster will appear here.</p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {schools.map((s) => (
                      <li key={s._id || s.schoolName || s.school_name}>
                        {s.schoolName || s.school_name || s.name}
                        {s.pincode ? ` (${s.pincode})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignAreaDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignArea} disabled={assigning || !selectedCluster}>
                {assigning ? 'Assigning...' : 'Assign Cluster'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
