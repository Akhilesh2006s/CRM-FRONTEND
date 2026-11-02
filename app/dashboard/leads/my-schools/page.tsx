'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'

type Lead = {
  _id: string
  school_name?: string
  school_code?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  location?: string
  status?: string
  priority?: string
  createdAt?: string
}

type Overview = {
  lead: Record<string, any>
  orders: any[]
  dcs: any[]
  payments: any[]
  visits: any[]
  returns: any[]
  trainings: any[]
  services: any[]
}

const FILTERS = [
  { key: 'all', label: 'All', query: '' },
  { key: 'open', label: 'Open', query: '?status=Pending' },
  { key: 'followup', label: 'Follow-up', query: '?status=Follow-up' },
  { key: 'closed', label: 'Closed', query: '?status=Closed' },
] as const

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const money = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/** My Schools (same as the app): tap a school to see all of its information on the same page. */
export default function MySchoolsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const query = FILTERS.find((f) => f.key === filter)?.query || ''
    apiRequest<Lead[] | { data?: Lead[] }>(`/leads${query}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || []
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        setLeads(list)
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false))
  }, [filter])

  const q = search.trim().toLowerCase()
  const shown = useMemo(
    () => leads.filter((l) => !q || [l.school_name, l.school_code, l.location, l.contact_person].some((v) => String(v || '').toLowerCase().includes(q))),
    [leads, q]
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Schools</h1>
        <p className="text-sm text-neutral-600 mt-1">Click a school to see all of its details, deals, DCs, payments and visits.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f.key ? 'border-sky-600 bg-sky-600 text-white' : 'bg-white text-neutral-700'}`}
          >
            {f.label}
          </button>
        ))}
        <Input className="ml-auto w-full bg-white sm:w-72" placeholder="Search school / code / town" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="py-2 px-3">School</th>
              <th className="py-2 px-3">Code</th>
              <th className="py-2 px-3">Contact</th>
              <th className="py-2 px-3">Zone</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">Loading…</td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">No schools found.</td>
              </tr>
            ) : (
              shown.map((l) => (
                <Fragment key={l._id}>
                  <tr className={`border-t cursor-pointer hover:bg-neutral-50 ${openId === l._id ? 'bg-sky-50' : ''}`} onClick={() => setOpenId(openId === l._id ? null : l._id)}>
                    <td className="py-2 px-3 font-medium">{l.school_name || '—'}</td>
                    <td className="py-2 px-3">{l.school_code || '—'}</td>
                    <td className="py-2 px-3">
                      {l.contact_person || '—'}
                      {l.contact_mobile ? <div className="text-xs text-neutral-500">{l.contact_mobile}</div> : null}
                    </td>
                    <td className="py-2 px-3">{l.zone || '—'}</td>
                    <td className="py-2 px-3">{[l.status, l.priority].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-2 px-3">{date(l.createdAt)}</td>
                  </tr>
                  {openId === l._id ? (
                    <tr className="bg-neutral-50">
                      <td colSpan={6} className="p-4">
                        <SchoolOverview leadId={l._id} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function SchoolOverview({ leadId }: { leadId: string }) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    apiRequest<Overview>(`/leads/${leadId}/overview`)
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load the school'))
    return () => {
      alive = false
    }
  }, [leadId])

  if (error) return <p className="text-red-600">{error}</p>
  if (!data) return <p className="text-neutral-500">Loading…</p>

  const l = data.lead
  const details: [string, unknown][] = [
    ['School code', l.school_code],
    ['School type', l.school_type],
    ['Contact person', l.contact_person],
    ['Contact mobile', l.contact_mobile],
    ['Contact person 2', l.contact_person2],
    ['Contact mobile 2', l.contact_mobile2],
    ['Email', l.email],
    ['Address', l.address],
    ['Location / Town', l.location || l.town],
    ['Pincode', l.pincode],
    ['Zone', l.zone],
    ['Cluster', l.cluster],
    ['Strength', l.strength],
    ['Branches', l.branches],
    ['Average fee', l.average_fee],
    ['Follow-up', l.follow_up_date ? date(l.follow_up_date) : ''],
    ['Created by', l.createdBy?.name],
    ['Managed by', l.managed_by?.name],
    ['Remarks', l.remarks],
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="School details">
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
          {details
            .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
            .map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-neutral-900">{String(v)}</dd>
              </Fragment>
            ))}
        </dl>
        <Link className="mt-2 inline-block text-sky-700 underline" href="/dashboard/leads/followup">
          Edit / follow up
        </Link>
      </Section>
      <Section title={`Deals (${data.orders.length})`}>
        {data.orders.map((o) => (
          <Line key={o._id} main={`${o.dc_code || 'Deal'} · ${o.status || ''}`} sub={[(o.products || []).map((p: any) => p.product_name).filter(Boolean).join(', '), date(o.createdAt)].filter(Boolean).join(' · ')} />
        ))}
      </Section>
      <Section title={`DCs / Material & Kits (${data.dcs.length})`}>
        {data.dcs.map((d) => (
          <Line key={d._id} main={`${d.dc_code || 'DC'} · ${d.status || ''}`} sub={date(d.createdAt)} />
        ))}
      </Section>
      <Section title={`Payments (${data.payments.length})`}>
        {data.payments.map((p) => (
          <Line key={p._id} main={`${money(p.amount)} · ${p.status || ''}`} sub={[p.paymentMethod, date(p.paymentDate || p.createdAt)].filter(Boolean).join(' · ')} />
        ))}
      </Section>
      <Section title={`Visits (${data.visits.length})`}>
        {data.visits.map((v) => (
          <Line key={v._id} main={`${date(v.visitDate)} · ${v.category || 'Visit'}${v.outcome ? ` · ${v.outcome}` : ''}`} sub={[v.executiveId?.name, v.remarks].filter(Boolean).join(' · ')} />
        ))}
      </Section>
      <Section title={`Returns (${data.returns.length})`}>
        {data.returns.map((r) => (
          <Line key={r._id} main={`Return #${r.returnNumber} · ${r.status || ''}`} sub={date(r.createdAt)} />
        ))}
      </Section>
      <Section title={`Trainings & Services (${data.trainings.length + data.services.length})`}>
        {data.trainings.map((t) => (
          <Line key={t._id} main={`Training · ${t.subject} · ${t.status}`} sub={[t.term, date(t.trainingDate)].filter(Boolean).join(' · ')} />
        ))}
        {data.services.map((s) => (
          <Line key={s._id} main={`Service · ${s.subject} · ${s.status}`} sub={[s.term, date(s.serviceDate)].filter(Boolean).join(' · ')} />
        ))}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = Array.isArray(children) ? children.flat().length === 0 : !children
  return (
    <div className="rounded border bg-white p-3">
      <h3 className="mb-2 font-semibold text-sky-800">{title}</h3>
      {empty ? <p className="text-neutral-500">None yet</p> : children}
    </div>
  )
}

function Line({ main, sub }: { main: string; sub?: string }) {
  return (
    <div className="border-b py-1 last:border-0">
      <div className="font-medium text-neutral-900">{main}</div>
      {sub ? <div className="text-xs text-neutral-500">{sub}</div> : null}
    </div>
  )
}
