'use client'

import Link from 'next/link'
import { dmy, pjpStatusClass, pjpStatusLabel, type Pjp } from '@/lib/pjp'

/** Plans as rows: who, period, status and planned / completed / pending / missed counts. */
export function PjpList({ rows, showEmployee }: { rows: Pjp[]; showEmployee?: boolean }) {
  if (!rows.length) return <p className="text-sm text-neutral-500">No plans yet.</p>
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-neutral-50 text-left">
          <tr>
            {[...(showEmployee ? ['Employee'] : []), 'Plan', 'Period', 'Status', 'Planned', 'Completed', 'Pending', 'Missed', ''].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p._id} className={`border-t ${p.canDecide ? 'bg-amber-50/60' : ''}`}>
              {showEmployee ? (
                <td className="px-3 py-2">
                  <div className="font-medium">{p.employeeId && typeof p.employeeId === 'object' ? p.employeeId.name : ''}</div>
                  <div className="text-xs text-neutral-500">{p.employeeId && typeof p.employeeId === 'object' ? p.employeeId.role : ''}</div>
                </td>
              ) : null}
              <td className="px-3 py-2">{p.period}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {dmy(p.fromDate)} – {dmy(p.toDate)}
              </td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${pjpStatusClass(p)}`}>{pjpStatusLabel(p)}</span>
                {p.canDecide ? <div className="mt-1 text-xs font-medium text-amber-800">Your action</div> : null}
              </td>
              <td className="px-3 py-2">{p.summary?.planned ?? p.items.length}</td>
              <td className="px-3 py-2 text-green-700">{p.summary?.completed ?? 0}</td>
              <td className="px-3 py-2 text-amber-700">{p.summary?.pending ?? 0}</td>
              <td className="px-3 py-2 text-red-700">{p.summary?.missed ?? 0}</td>
              <td className="px-3 py-2">
                <Link className="text-sky-700 hover:underline" href={`/dashboard/pjp/${p._id}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
