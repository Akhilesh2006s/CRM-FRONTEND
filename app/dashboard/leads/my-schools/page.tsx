'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import SchoolOverview from '@/components/SchoolOverviewPanel'

/** Same tags as the server (backend utils/schoolStatus.js) and the app. */
const TAGS = ['Lead', 'PO Dropped', 'DC Dropped', 'Client for Renewal', 'Renewed'] as const
type Tag = (typeof TAGS)[number]

const TAG_CLASS: Record<Tag, string> = {
  Lead: 'bg-sky-100 text-sky-800',
  'PO Dropped': 'bg-amber-100 text-amber-800',
  'DC Dropped': 'bg-green-100 text-green-800',
  'Client for Renewal': 'bg-red-100 text-red-800',
  Renewed: 'bg-emerald-100 text-emerald-800',
}

type School = {
  _id: string
  school_name?: string
  school_code?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  area?: string
  city?: string
  year?: string
  statusTag: Tag
  schoolLocation?: { latitude: number; longitude: number } | null
}

/** My Schools (same as the app): every school, leads and clients, with its status; click a school for all its details. */
export default function MySchoolsPage() {
  const [filter, setFilter] = useState<'All' | Tag>('All')
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiRequest<School[]>('/dc-orders/my-schools')
      .then((res) => setSchools(Array.isArray(res) ? res : []))
      .catch(() => setSchools([]))
      .finally(() => setLoading(false))
  }, [])

  const q = search.trim().toLowerCase()
  const shown = useMemo(
    () =>
      schools.filter(
        (s) =>
          (filter === 'All' || s.statusTag === filter) &&
          (!q || [s.school_name, s.school_code, s.area, s.city, s.contact_person].some((v) => String(v || '').toLowerCase().includes(q)))
      ),
    [schools, q, filter]
  )
  const count = (t: 'All' | Tag) => (t === 'All' ? schools.length : schools.filter((s) => s.statusTag === t).length)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Schools</h1>
        <p className="text-sm text-neutral-600 mt-1">All your schools: leads and clients. Click a school for its details.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(['All', ...TAGS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === t ? 'border-sky-600 bg-sky-600 text-white' : 'bg-white text-neutral-700'}`}
          >
            {t} ({count(t)})
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
              <th className="py-2 px-3">Area</th>
              <th className="py-2 px-3">Location</th>
              <th className="py-2 px-3">Status</th>
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
              shown.map((s) => (
                <Fragment key={s._id}>
                  <tr className={`border-t cursor-pointer hover:bg-neutral-50 ${openId === s._id ? 'bg-sky-50' : ''}`} onClick={() => setOpenId(openId === s._id ? null : s._id)}>
                    <td className="py-2 px-3 font-medium">{s.school_name || '—'}</td>
                    <td className="py-2 px-3">{s.school_code || '—'}</td>
                    <td className="py-2 px-3">
                      {s.contact_person || '—'}
                      {s.contact_mobile ? <div className="text-xs text-neutral-500">{s.contact_mobile}</div> : null}
                    </td>
                    <td className="py-2 px-3">{[s.area, s.city].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-2 px-3">
                      {s.schoolLocation ? (
                        <a
                          className="text-sky-700 underline"
                          href={`https://www.google.com/maps/search/?api=1&query=${s.schoolLocation.latitude},${s.schoolLocation.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on map
                        </a>
                      ) : (
                        <span className="text-neutral-400">Not captured</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TAG_CLASS[s.statusTag] || 'bg-neutral-100 text-neutral-700'}`}>{s.statusTag}</span>
                    </td>
                  </tr>
                  {openId === s._id ? (
                    <tr className="bg-neutral-50">
                      <td colSpan={6} className="p-4">
                        <SchoolOverview leadId={s._id} />
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
