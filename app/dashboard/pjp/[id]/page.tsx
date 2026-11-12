'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { PjpDetail } from '@/components/pjp/PjpDetail'
import { PjpEditor } from '@/components/pjp/PjpEditor'
import type { Pjp } from '@/lib/pjp'

export default function PjpPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [p, setP] = useState<Pjp | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    apiRequest<Pjp>(`/pjp/${id}`)
      .then(setP)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the plan'))
  }, [id])
  useEffect(load, [load])

  return (
    <div className="space-y-4">
      <Link href={p && !p.isOwn ? '/dashboard/pjp/team' : '/dashboard/pjp'} className="text-sm text-sky-700 hover:underline">
        ← Back
      </Link>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!p && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {p && editing ? (
        <PjpEditor
          initial={p}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      ) : null}
      {p && !editing ? (
        <PjpDetail p={p} onEdit={() => setEditing(true)} onChanged={(next) => (next ? load() : router.push('/dashboard/pjp'))} />
      ) : null}
    </div>
  )
}
