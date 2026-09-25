'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

type Executive = {
  _id: string
  name: string
  email: string
  phone?: string
  mobile?: string
  empCode?: string
  department?: string
  assignedCity?: string
  assignedArea?: string
  assignedState?: string
  assignedDistrict?: string
  isActive: boolean
  createdAt: string
}

export default function ExecutivesPage() {
  const [executives, setExecutives] = useState<Executive[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Executive[]>('/executive-managers/my/executives')
      setExecutives(data || [])
    } catch (e: any) {
      console.error('Failed to load executives:', e)
      toast.error(e?.message || 'Failed to load BDEs')
      setExecutives([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">BDEs</h1>
        <p className="text-sm text-neutral-600 mt-1">View all BDEs assigned to you</p>
      </div>

      {/* Executives Table */}
      <Card className="p-0 overflow-x-auto shadow-sm">
        {loading && <div className="p-6 text-neutral-600">Loading...</div>}
        {!loading && executives.length === 0 && (
          <div className="p-6 text-neutral-500 text-center">
            <p>No BDEs assigned to you.</p>
            <p className="text-sm mt-2">Contact Super Admin to assign BDEs to your account.</p>
          </div>
        )}
        {!loading && executives.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Mobile</TableHead>
                <TableHead className="font-semibold">Employee Code</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">State</TableHead>
                <TableHead className="font-semibold">City</TableHead>
                <TableHead className="font-semibold">Area</TableHead>
                <TableHead className="font-semibold">District</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Joined Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executives.map((executive, index) => (
                <TableRow
                  key={executive._id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{executive.name}</TableCell>
                  <TableCell>{executive.email}</TableCell>
                  <TableCell>{executive.phone || '-'}</TableCell>
                  <TableCell>{executive.mobile || '-'}</TableCell>
                  <TableCell>{executive.empCode || '-'}</TableCell>
                  <TableCell>{executive.department || '-'}</TableCell>
                  <TableCell>{executive.assignedState || '-'}</TableCell>
                  <TableCell>{executive.assignedCity || '-'}</TableCell>
                  <TableCell>{executive.assignedArea || '-'}</TableCell>
                  <TableCell>{executive.assignedDistrict || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      executive.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {executive.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(executive.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}


