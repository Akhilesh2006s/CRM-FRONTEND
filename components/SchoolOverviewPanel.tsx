'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'

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

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const money = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/** Everything about one school: details, deals, DCs, payments, visits, returns, trainings and services.
 *  leadId may also be a client's deal or DC id (My Clients). */
export default function SchoolOverview({ leadId }: { leadId: string }) {
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
