'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { formatEmployeeCode } from '@/lib/employeeCode'

type Product = { _id: string; name: string; levels?: string[] }
type School = {
  schoolName: string
  schoolCode: string
  zone: string
  cluster: string
  zonalManager: string
  city: string
  contactPerson: string
  contactMobile: string
  products: Array<{ name: string; relationship: string }>
  bdeName: string
  bdeEmail: string
  bdePhone: string
  deliveryStatus: string
}
type Bde = {
  _id: string
  name: string
  email: string
  phone: string
  empCode: string
  zone: string
  cluster: string
  state: string
  city: string
  department: string
  isActive: boolean
  schools: string[]
}
type Delivery = {
  id: string
  schoolName: string
  schoolCode: string
  zone: string
  products: string[]
  status: string
  dcStatus: string
  deliveryDate: string | null
  quantity: number
  contactMobile: string
  bdeName: string
}
type Session = {
  id: string
  kind: string
  schoolName: string
  schoolCode: string
  zone: string
  product: string
  date: string
  term: string
  level: string
  status: string
  feedbackOnFile: boolean
  trainerName: string
  bdeName: string
}
type Trainer = {
  _id: string
  name: string
  products: string[]
  schools: number
  scheduled: number
  completed: number
  cancelled: number
  feedbackOnFile: number
  completionRate: number
}
type Dashboard = {
  manager: { _id: string; name: string; email: string }
  products: Product[]
  schools: School[]
  bdes: Bde[]
  deliveries: Delivery[]
  trainings: Session[]
  services: Session[]
  trainers: Trainer[]
}

const TABS = ['Schools', 'BDEs', 'Delivery', 'Training & service', 'Trainers'] as const

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN')
}

export default function ProductManagerDashboard({ managerId }: { managerId: string }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Schools')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiRequest<Dashboard>(`/product-manager/${managerId}/dashboard`)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Failed to load assigned products')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [managerId])

  const needle = query.trim().toLowerCase()
  const schools = useMemo(() => {
    const rows = data?.schools || []
    if (!needle) return rows
    return rows.filter((row) =>
      [row.schoolName, row.schoolCode, row.zone, row.cluster, row.zonalManager, row.bdeName, ...row.products.map((item) => item.name)]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    )
  }, [data, needle])

  if (loading) return <div className="p-6 text-neutral-500">Loading assigned products…</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!data) return null

  const delivered = data.deliveries.filter((row) => row.status === 'Delivered').length
  const notDelivered = data.deliveries.filter((row) => row.status === 'Not delivered').length

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{data.manager.name}</h1>
        <p className="text-sm text-neutral-500">
          Schools, BDEs, delivery, training, and trainer performance for the products assigned to this Product Manager.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Products</div>
          <div className="mt-1 text-2xl font-semibold">{data.products.length}</div>
          <div className="mt-2 text-sm text-neutral-600">{data.products.map((item) => item.name).join(', ') || 'None assigned yet'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Schools</div>
          <div className="mt-1 text-2xl font-semibold">{data.schools.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">BDEs</div>
          <div className="mt-1 text-2xl font-semibold">{data.bdes.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Delivery</div>
          <div className="mt-1 text-2xl font-semibold">{delivered}</div>
          <div className="text-sm text-neutral-600">{notDelivered} not delivered</div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === item ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Schools' ? (
        <Card className="overflow-x-auto p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search school, code, zone, cluster, zonal manager, BDE, or product"
            className="mb-4 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">School</th>
                <th className="py-2 pr-3">Zone</th>
                <th className="py-2 pr-3">Cluster</th>
                <th className="py-2 pr-3">Zonal Manager</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">BDE</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((row) => (
                <tr key={`${row.schoolCode}-${row.schoolName}`} className="border-t border-neutral-100">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{row.schoolName || '—'}</div>
                    <div className="text-xs text-neutral-500">{row.schoolCode || row.city || ''}</div>
                  </td>
                  <td className="py-2 pr-3">{row.zone || '—'}</td>
                  <td className="py-2 pr-3">{row.cluster || '—'}</td>
                  <td className="py-2 pr-3">{row.zonalManager || '—'}</td>
                  <td className="py-2 pr-3">
                    {row.products.map((item) => `${item.name} (${item.relationship})`).join(', ') || '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <div>{row.bdeName || '—'}</div>
                    <div className="text-xs text-neutral-500">{row.bdePhone || row.bdeEmail}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <div>{row.contactPerson || '—'}</div>
                    <div className="text-xs text-neutral-500">{row.contactMobile}</div>
                  </td>
                  <td className="py-2">{row.deliveryStatus}</td>
                </tr>
              ))}
              {schools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-neutral-500">No schools for the assigned products.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === 'BDEs' ? (
        <div className="grid gap-3">
          {data.bdes.map((bde) => (
            <Card key={bde._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{bde.name}</div>
                  <div className="text-sm text-neutral-500">{bde.email}{bde.phone ? ` · ${bde.phone}` : ''}</div>
                </div>
                <div className="text-sm text-neutral-500">{bde.isActive ? 'Active' : 'Inactive'}{bde.empCode ? ` · ${formatEmployeeCode(bde.empCode)}` : ''}</div>
              </div>
              <div className="mt-2 text-sm text-neutral-600">
                {[bde.zone, bde.cluster, bde.city, bde.state, bde.department].filter(Boolean).join(' · ') || 'No area on file'}
              </div>
              <div className="mt-2 text-sm">Schools: {bde.schools.filter(Boolean).join(', ') || '—'}</div>
            </Card>
          ))}
          {data.bdes.length === 0 ? <Card className="p-4 text-sm text-neutral-500">No BDEs are assigned to these schools.</Card> : null}
        </div>
      ) : null}

      {tab === 'Delivery' ? (
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">School</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2">BDE</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveries.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="py-2 pr-3">{row.schoolName}</td>
                  <td className="py-2 pr-3">{row.products.join(', ')}</td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2 pr-3">{row.dcStatus || '—'}</td>
                  <td className="py-2 pr-3">{formatDate(row.deliveryDate)}</td>
                  <td className="py-2 pr-3">{row.quantity || '—'}</td>
                  <td className="py-2">{row.bdeName || '—'}</td>
                </tr>
              ))}
              {data.deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-neutral-500">No delivery challans for the assigned products.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === 'Training & service' ? (
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">School</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Trainer</th>
                <th className="py-2">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {[...data.trainings, ...data.services].map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-t border-neutral-100">
                  <td className="py-2 pr-3">{row.kind}</td>
                  <td className="py-2 pr-3">{row.schoolName}</td>
                  <td className="py-2 pr-3">{row.product}{row.level ? ` · ${row.level}` : ''}{row.term ? ` · ${row.term}` : ''}</td>
                  <td className="py-2 pr-3">{formatDate(row.date)}</td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2 pr-3">{row.trainerName || '—'}</td>
                  <td className="py-2">{row.feedbackOnFile ? 'On file' : '—'}</td>
                </tr>
              ))}
              {data.trainings.length + data.services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-neutral-500">No training or service visits for the assigned products.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === 'Trainers' ? (
        <Card className="overflow-x-auto p-4">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Trainer</th>
                <th className="py-2 pr-3">Products</th>
                <th className="py-2 pr-3">Schools</th>
                <th className="py-2 pr-3">Completed</th>
                <th className="py-2 pr-3">Scheduled</th>
                <th className="py-2 pr-3">Completion</th>
                <th className="py-2">Feedback forms</th>
              </tr>
            </thead>
            <tbody>
              {data.trainers.map((trainer) => (
                <tr key={trainer._id} className="border-t border-neutral-100">
                  <td className="py-2 pr-3 font-medium">{trainer.name}</td>
                  <td className="py-2 pr-3">{trainer.products.join(', ')}</td>
                  <td className="py-2 pr-3">{trainer.schools}</td>
                  <td className="py-2 pr-3">{trainer.completed}</td>
                  <td className="py-2 pr-3">{trainer.scheduled}</td>
                  <td className="py-2 pr-3">{trainer.completionRate}%</td>
                  <td className="py-2">{trainer.feedbackOnFile}</td>
                </tr>
              ))}
              {data.trainers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-neutral-500">No trainers.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  )
}
