'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { iitStreamLabel, iitStreamSubjects, matchIitStream } from '@/lib/iitStreams'

/** Streams (IIT subject combinations) offered in the DC form's Stream dropdown. */
export function ProductStreamsField({ value, onChange }: { value: string[]; onChange: (streams: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const stream = draft.trim()
    if (!stream) return
    if (!iitStreamSubjects(stream).length) {
      toast.error('Use subject letters only: M (Maths), P (Physics), C (Chemistry), Bi (Biology), e.g. MBiPC.')
      return
    }
    const existing = matchIitStream(stream, value)
    if (existing) {
      toast.error(`${existing} already covers these subjects.`)
      return
    }
    onChange([...value, stream])
    setDraft('')
  }

  return (
    <div>
      <Label>Streams</Label>
      <p className="text-xs text-neutral-500 mb-2">
        Subject combinations shown in the DC form&apos;s Stream dropdown (e.g. MBiPC, MPC, M, MP, MBC).
      </p>
      <div className="flex gap-2 mb-2">
        <Input
          className="bg-white text-neutral-900"
          placeholder="Enter stream, e.g. MBiPC"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" variant="outline" onClick={add}>Add Stream</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((stream) => (
            <Badge key={stream} variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3" title={iitStreamLabel(stream)}>
              {iitStreamLabel(stream)}
              <button
                type="button"
                aria-label={`Remove ${stream}`}
                onClick={() => onChange(value.filter((item) => item !== stream))}
                className="ml-1 hover:text-red-600 font-bold"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
