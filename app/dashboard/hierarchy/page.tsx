'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Eye, UserPlus } from 'lucide-react'

type ZonalManager = {
  _id: string
  name: string
  email: string
  phone?: string
  state?: string
  regionalManagerId?: string | null
  assignedToName?: string
  employeeCount?: number
}

type RegionalManager = {
  _id: string
  name: string
  email: string
  phone?: string
  regionalHeadId?: string | null
  assignedToName?: string
  zonalManagerCount?: number
}

type RegionalHead = {
  _id: string
  name: string
  email: string
  phone?: string
  nationalHeadId?: string | null
  assignedToName?: string
  regionalManagerCount?: number
}

type NationalHead = {
  _id: string
  name: string
  email: string
  phone?: string
  regionalHeadCount?: number
}

type Overview = {
  zonalManagers: ZonalManager[]
  regionalManagers: RegionalManager[]
  regionalHeads: RegionalHead[]
  nationalHeads: NationalHead[]
}

type AssignTarget = {
  parentRole: 'Regional Manager' | 'Regional Head' | 'National Head'
  parentId: string
  parentName: string
  childLabel: string
  options: Array<{ _id: string; name: string; email: string; detail: string; takenBy: string }>
  selectedIds: string[]
}

export default function HierarchyAssignmentPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<AssignTarget | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Overview>('/hierarchy/overview')
      setOverview(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load hierarchy')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (name: string, email: string) =>
      !q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q)
    return {
      regionalManagers: (overview?.regionalManagers || []).filter((item) => match(item.name, item.email)),
      regionalHeads: (overview?.regionalHeads || []).filter((item) => match(item.name, item.email)),
      nationalHeads: (overview?.nationalHeads || []).filter((item) => match(item.name, item.email)),
    }
  }, [overview, search])

  const openAssign = (next: AssignTarget) => {
    setTarget(next)
    setSelectedIds(next.selectedIds)
  }

  const saveAssignment = async () => {
    if (!target) return
    setSaving(true)
    try {
      const result = await apiRequest<{ message: string }>('/hierarchy/assignments', {
        method: 'PUT',
        body: JSON.stringify({
          parentRole: target.parentRole,
          parentId: target.parentId,
          childIds: selectedIds,
        }),
      })
      toast.success(result.message || 'Assignment saved')
      setTarget(null)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Hierarchy</h1>
        <p className="mt-1 text-sm text-neutral-600 max-w-3xl">
          Create Regional Managers, Regional Heads, and National Heads from New Employee, then assign the level below each of them here.
          One person sits under one manager. Saving a new assignment moves them from any previous manager.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/employees/new">Create employee</Link>
        </Button>
      </div>

      <Input
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md bg-white"
      />

      {loading ? (
        <div className="py-10 text-center text-neutral-500">Loading…</div>
      ) : (
        <Tabs defaultValue="regional-managers">
          <TabsList>
            <TabsTrigger value="regional-managers">Regional Managers</TabsTrigger>
            <TabsTrigger value="regional-heads">Regional Heads</TabsTrigger>
            <TabsTrigger value="national-heads">National Heads</TabsTrigger>
          </TabsList>

          <TabsContent value="regional-managers" className="mt-4">
            <PeopleGrid
              empty="No Regional Managers yet. Add one from New Employee with the Regional Manager role."
              people={filtered.regionalManagers.map((person) => ({
                id: person._id,
                name: person.name,
                email: person.email,
                phone: person.phone,
                meta: `${person.zonalManagerCount || 0} Zonal Managers`,
                dashboardHref: `/dashboard/hierarchy/regional-manager/${person._id}`,
                onAssign: () =>
                  openAssign({
                    parentRole: 'Regional Manager',
                    parentId: person._id,
                    parentName: person.name,
                    childLabel: 'Zonal Managers',
                    selectedIds: (overview?.zonalManagers || [])
                      .filter((item) => String(item.regionalManagerId || '') === person._id)
                      .map((item) => item._id),
                    options: (overview?.zonalManagers || []).map((item) => ({
                      _id: item._id,
                      name: item.name,
                      email: item.email,
                      detail: `${item.employeeCount || 0} employees${item.state ? ` · ${item.state}` : ''}`,
                      takenBy:
                        item.regionalManagerId && String(item.regionalManagerId) !== person._id
                          ? item.assignedToName || 'another Regional Manager'
                          : '',
                    })),
                  }),
              }))}
            />
          </TabsContent>

          <TabsContent value="regional-heads" className="mt-4">
            <PeopleGrid
              empty="No Regional Heads yet. Add one from New Employee with the Regional Head role."
              people={filtered.regionalHeads.map((person) => ({
                id: person._id,
                name: person.name,
                email: person.email,
                phone: person.phone,
                meta: `${person.regionalManagerCount || 0} Regional Managers`,
                dashboardHref: `/dashboard/hierarchy/regional-head/${person._id}`,
                onAssign: () =>
                  openAssign({
                    parentRole: 'Regional Head',
                    parentId: person._id,
                    parentName: person.name,
                    childLabel: 'Regional Managers',
                    selectedIds: (overview?.regionalManagers || [])
                      .filter((item) => String(item.regionalHeadId || '') === person._id)
                      .map((item) => item._id),
                    options: (overview?.regionalManagers || []).map((item) => ({
                      _id: item._id,
                      name: item.name,
                      email: item.email,
                      detail: `${item.zonalManagerCount || 0} Zonal Managers`,
                      takenBy:
                        item.regionalHeadId && String(item.regionalHeadId) !== person._id
                          ? item.assignedToName || 'another Regional Head'
                          : '',
                    })),
                  }),
              }))}
            />
          </TabsContent>

          <TabsContent value="national-heads" className="mt-4">
            <PeopleGrid
              empty="No National Heads yet. Add one from New Employee with the National Head role."
              people={filtered.nationalHeads.map((person) => ({
                id: person._id,
                name: person.name,
                email: person.email,
                phone: person.phone,
                meta: `${person.regionalHeadCount || 0} Regional Heads`,
                dashboardHref: `/dashboard/hierarchy/national-head/${person._id}`,
                onAssign: () =>
                  openAssign({
                    parentRole: 'National Head',
                    parentId: person._id,
                    parentName: person.name,
                    childLabel: 'Regional Heads',
                    selectedIds: (overview?.regionalHeads || [])
                      .filter((item) => String(item.nationalHeadId || '') === person._id)
                      .map((item) => item._id),
                    options: (overview?.regionalHeads || []).map((item) => ({
                      _id: item._id,
                      name: item.name,
                      email: item.email,
                      detail: `${item.regionalManagerCount || 0} Regional Managers`,
                      takenBy:
                        item.nationalHeadId && String(item.nationalHeadId) !== person._id
                          ? item.assignedToName || 'another National Head'
                          : '',
                    })),
                  }),
              }))}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign {target?.childLabel} to {target?.parentName}
            </DialogTitle>
            <DialogDescription>
              Checked people stay assigned to this manager. Unchecking removes them. Someone already assigned elsewhere moves here when you save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {target?.options.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No active people are available for this level.</p>
            ) : (
              target?.options.map((option) => (
                <label key={option._id} className="flex items-start gap-3 p-2 border rounded hover:bg-neutral-50">
                  <Checkbox
                    checked={selectedIds.includes(option._id)}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) =>
                        checked ? [...current, option._id] : current.filter((id) => id !== option._id)
                      )
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">{option.name}</span>
                    <span className="block text-xs text-neutral-500">{option.email}</span>
                    <span className="block text-xs text-neutral-500">{option.detail}</span>
                    {option.takenBy ? (
                      <span className="block text-xs text-amber-700">Currently with {option.takenBy}</span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveAssignment} disabled={saving}>
              {saving ? 'Saving…' : 'Save assignment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PeopleGrid({
  people,
  empty,
}: {
  empty: string
  people: Array<{
    id: string
    name: string
    email: string
    phone?: string
    meta: string
    dashboardHref: string
    onAssign: () => void
  }>
}) {
  if (people.length === 0) {
    return <Card className="p-6 text-neutral-500">{empty}</Card>
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {people.map((person) => (
        <Card key={person.id} className="p-4 bg-white border border-neutral-200">
          <h3 className="font-semibold text-lg">{person.name}</h3>
          <p className="text-sm text-neutral-600">{person.email}</p>
          {person.phone ? <p className="text-sm text-neutral-600">{person.phone}</p> : null}
          <p className="text-sm text-neutral-800 mt-3">{person.meta}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" size="sm" asChild>
              <Link href={person.dashboardHref}>
                <Eye className="w-4 h-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={person.onAssign}>
              <UserPlus className="w-4 h-4 mr-1" />
              Assign
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
