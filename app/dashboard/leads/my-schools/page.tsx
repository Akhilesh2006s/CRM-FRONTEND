'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import SchoolOverview from '@/components/SchoolOverviewPanel'

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


const FILTERS = [
  { key: 'all', label: 'All', query: '' },
  { key: 'open', label: 'Open', query: '?status=Pending' },
  { key: 'followup', label: 'Follow-up', query: '?status=Follow-up' },
  { key: 'closed', label: 'Closed', query: '?status=Closed' },
] as const

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

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
