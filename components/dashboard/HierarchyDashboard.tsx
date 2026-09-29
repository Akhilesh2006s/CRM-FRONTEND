'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Eye, Users } from 'lucide-react'
import { displayRoleName } from '@/lib/roleLabels'

export type HierarchyLevel = 'regional-manager' | 'regional-head' | 'national-head'

type Metrics = {
  regionalHeads?: number
  regionalManagers?: number
  zonalManagers?: number
  employees?: number
  leads?: number
  dcs?: number
  sales?: number
  leaves?: number
  leadsByStatus?: Record<string, number>
  dcsByStatus?: Record<string, number>
  leavesByStatus?: Record<string, number>
}

type SchoolRow = { schoolName: string; schoolCode: string }
type ClusterRow = { name: string; schools: SchoolRow[] }
type ZoneRow = { name: string; clusters: ClusterRow[] }
type EmployeeRow = {
  _id: string
  name: string
  role: string
  zone: string
  cluster?: string
  zones: ZoneRow[]
}
type Report = {
  _id: string
  name: string
  email: string
  phone?: string
  state?: string
  department?: string
  kind: 'zonal-manager' | 'regional-manager' | 'regional-head' | 'national-head'
  metrics?: Metrics
  members?: Report[]
  employees?: EmployeeRow[]
}

type Activity = {
  id: string
  type: string
  title: string
  status?: string
  at?: string
  actorName?: string
  contextName?: string
}

type DashboardPayload = {
  level: HierarchyLevel
  person: { _id: string; name: string; email: string; phone?: string; state?: string; department?: string; role: string }
  totals: Metrics
  directReports: Report[]
  activities: Activity[]
}

const COPY: Record<HierarchyLevel, { title: string; reports: string; empty: string }> = {
  'regional-manager': {
    title: 'Regional Manager Dashboard',
    reports: 'Zonal Managers',
    empty: 'No Zonal Managers are assigned yet. Super Admin assigns Zonal Managers to this Regional Manager.',
  },
  'regional-head': {
    title: 'Regional Head Dashboard',
    reports: 'Regional Managers',
    empty: 'No Regional Managers are assigned yet. Super Admin assigns Regional Managers to this Regional Head.',
  },
  'national-head': {
    title: 'National Head Dashboard',
    reports: 'Regional Heads',
    empty: 'No Regional Heads are assigned yet. Super Admin assigns Regional Heads to this National Head.',
  },
}

const ENDPOINT: Record<HierarchyLevel, string> = {
  'regional-manager': 'regional-managers',
  'regional-head': 'regional-heads',
  'national-head': 'national-heads',
}

function reportHref(kind: Report['kind'], id: string) {
  if (kind === 'zonal-manager') return `/dashboard/executive-managers/${id}/dashboard`
  if (kind === 'regional-manager') return `/dashboard/hierarchy/regional-manager/${id}`
  if (kind === 'regional-head') return `/dashboard/hierarchy/regional-head/${id}`
  return `/dashboard/hierarchy/national-head/${id}`
}

function formatWhen(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function EmployeeTerritory({ employees }: { employees?: EmployeeRow[] }) {
  if (!employees?.length) return null
  const zones = new Map<string, ZoneRow>()
  for (const employee of employees) {
    for (const zone of employee.zones || []) {
      if (!zones.has(zone.name)) zones.set(zone.name, zone)
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Employees</div>
        <ul className="mt-1 space-y-1">
          {employees.map((employee) => (
            <li key={employee._id} className="text-sm text-neutral-800">
              <span className="font-medium">{employee.name}</span>
              <span className="text-neutral-500">
                {' '}
                · {displayRoleName(employee.role) || 'Employee'}
                {employee.zone ? ` · Zone ${employee.zone}` : ' · No zone'}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {[...zones.values()].map((zone) => (
        <div key={zone.name} className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
          <div className="text-sm font-semibold text-neutral-900">Zone {zone.name}</div>
          {zone.clusters.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">No clusters in this zone.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {zone.clusters.map((cluster) => (
                <li key={`${zone.name}-${cluster.name}`} className="text-xs text-neutral-600">
                  <span className="font-medium text-neutral-800">Cluster {cluster.name}</span>
                  {cluster.schools.length > 0 ? (
                    <span>
                      {' '}
                      ·{' '}
                      {cluster.schools
                        .map((school) =>
                          school.schoolCode ? `${school.schoolName} (${school.schoolCode})` : school.schoolName
                        )
                        .join(', ')}
                    </span>
                  ) : (
                    <span> · No schools</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function Downline({ people }: { people?: Report[] }) {
  if (!people?.length) return null
  return (
    <div className="border-t border-neutral-100 pt-3 space-y-3">
      {people.map((member) => (
        <div key={member._id} className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div>
              <div className="font-medium text-neutral-800">{member.name}</div>
              <div className="text-neutral-500">
                {member.kind === 'regional-manager' ? 'Regional Manager' : member.kind === 'regional-head' ? 'Regional Head' : 'Zonal Manager'}
                {' · '}
                {member.metrics?.employees || 0} employees · {member.metrics?.leads || 0} leads ·{' '}
                {member.metrics?.dcs || 0} DCs · {member.metrics?.sales || 0} sales
              </div>
            </div>
            <Link href={reportHref(member.kind, member._id)} className="text-blue-700 shrink-0">
              View
            </Link>
          </div>
          {member.members && member.members.length > 0 ? <Downline people={member.members} /> : null}
          <EmployeeTerritory employees={member.employees} />
        </div>
      ))}
    </div>
  )
}

function StatusLine({ label, counts }: { label: string; counts?: Record<string, number> }) {
  const entries = Object.entries(counts || {}).filter(([, count]) => count > 0)
  if (!entries.length) return null
  return (
    <div className="text-sm text-neutral-600">
      <span className="font-medium text-neutral-800">{label}: </span>
      {entries.map(([status, count]) => `${status} ${count}`).join(' · ')}
    </div>
  )
}

export default function HierarchyDashboard({
  level,
  personId,
}: {
  level: HierarchyLevel
  personId: string
}) {
  const copy = COPY[level]
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [applied, setApplied] = useState({ fromDate: '', toDate: '' })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (applied.fromDate) params.set('fromDate', applied.fromDate)
        if (applied.toDate) params.set('toDate', applied.toDate)
        const query = params.toString()
        const payload = await apiRequest<DashboardPayload>(
          `/hierarchy/${ENDPOINT[level]}/${personId}/dashboard${query ? `?${query}` : ''}`
        )
        if (!cancelled) setData(payload)
      } catch (err: unknown) {
        if (!cancelled) {
          setData(null)
          toast.error(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (personId) load()
    return () => {
      cancelled = true
    }
  }, [level, personId, applied])

  const statCards = useMemo(() => {
    const totals = data?.totals
    const cards = [
      level === 'national-head' ? { label: 'Regional Heads', value: totals?.regionalHeads || 0 } : null,
      level !== 'regional-manager' ? { label: 'Regional Managers', value: totals?.regionalManagers || 0 } : null,
      { label: 'Zonal Managers', value: totals?.zonalManagers || 0 },
      { label: 'Employees', value: totals?.employees || 0 },
      { label: 'Leads', value: totals?.leads || 0 },
      { label: 'DCs', value: totals?.dcs || 0 },
      { label: 'Sales', value: totals?.sales || 0 },
      { label: 'Leaves', value: totals?.leaves || 0 },
    ]
    return cards.filter(Boolean) as Array<{ label: string; value: number }>
  }, [data, level])

  if (loading) {
    return <div className="py-10 text-center text-neutral-500">Loading dashboard…</div>
  }

  if (!data) {
    return <div className="py-10 text-center text-neutral-500">Dashboard is not available.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{copy.title}</h1>
        <p className="mt-1 text-neutral-700">
          {data.person.name}
          {data.person.state ? ` · ${data.person.state}` : ''}
        </p>
        <p className="text-sm text-neutral-500">
          {data.person.email}
          {data.person.phone ? ` · ${data.person.phone}` : ''}
          {data.person.department ? ` · ${data.person.department}` : ''}
        </p>
      </div>

      <Card className="p-4 bg-neutral-50 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">From date</label>
            <Input type="date" allowPastDates value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">To date</label>
            <Input type="date" allowPastDates value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-white" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => setApplied({ fromDate, toDate })}>Apply</Button>
            <Button
              variant="outline"
              onClick={() => {
                setFromDate('')
                setToDate('')
                setApplied({ fromDate: '', toDate: '' })
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className="p-4 bg-white border border-neutral-200">
            <div className="text-sm text-neutral-500">{card.label}</div>
            <div className="text-2xl font-semibold text-neutral-900">{card.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 bg-white border border-neutral-200 space-y-1">
        <StatusLine label="Leads" counts={data.totals.leadsByStatus} />
        <StatusLine label="DCs" counts={data.totals.dcsByStatus} />
        <StatusLine label="Leaves" counts={data.totals.leavesByStatus} />
        {!data.totals.leads && !data.totals.dcs && !data.totals.leaves ? (
          <p className="text-sm text-neutral-500">No lead, DC, or leave activity in this range.</p>
        ) : null}
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-3">{copy.reports}</h2>
        {data.directReports.length === 0 ? (
          <Card className="p-6 text-neutral-500">{copy.empty}</Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {data.directReports.map((report) => (
              <Card key={report._id} className="p-4 bg-white border border-neutral-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{report.name}</h3>
                    <p className="text-sm text-neutral-600">{report.email}</p>
                    {report.phone ? <p className="text-sm text-neutral-600">{report.phone}</p> : null}
                    {report.state ? <p className="text-sm text-neutral-500">{report.state}</p> : null}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={reportHref(report.kind, report._id)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Dashboard
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-neutral-700">
                  {typeof report.metrics?.regionalManagers === 'number' && report.kind === 'regional-head' ? (
                    <span>{report.metrics.regionalManagers} Regional Managers</span>
                  ) : null}
                  {typeof report.metrics?.zonalManagers === 'number' && report.kind !== 'zonal-manager' ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {report.metrics.zonalManagers} Zonal Managers
                    </span>
                  ) : null}
                  <span>{report.metrics?.employees || 0} employees</span>
                  <span>{report.metrics?.leads || 0} leads</span>
                  <span>{report.metrics?.dcs || 0} DCs</span>
                  <span>{report.metrics?.sales || 0} sales</span>
                  <span>{report.metrics?.leaves || 0} leaves</span>
                </div>
                <Downline people={report.members} />
                <EmployeeTerritory employees={report.employees} />
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-3">Recent activity</h2>
        <Card className="p-4 bg-white border border-neutral-200">
          {data.activities.length === 0 ? (
            <p className="text-sm text-neutral-500">No recent leads, delivery challans, or leaves for this team.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.activities.map((activity) => (
                <li key={activity.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-neutral-900">
                      <span className="inline-block mr-2 rounded bg-neutral-100 px-2 py-0.5 text-xs">{activity.type}</span>
                      {activity.title}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {[activity.actorName, activity.contextName].filter(Boolean).join(' · ')}
                      {activity.status ? ` · ${activity.status}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 shrink-0">{formatWhen(activity.at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
