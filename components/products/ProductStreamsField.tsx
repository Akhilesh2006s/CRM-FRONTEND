'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { matchStream, streamLabel, suggestStreamName, type StreamCombo } from '@/lib/iitStreams'

/** Streams: named combinations of this product's subjects, offered in the lead / DC Stream dropdown. */
export function ProductStreamsField({
  value,
  onChange,
  subjects,
}: {
  value: StreamCombo[]
  onChange: (streams: StreamCombo[]) => void
  /** The product's subjects (Subjects / Deliverables on this form). */
  subjects: string[]
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)

  const toggle = (subject: string, on: boolean) => {
    // Keep the product's subject order so names read the same way every time.
    const next = subjects.filter((s) => (s === subject ? on : picked.includes(s)))
    setPicked(next)
    if (!nameEdited) setName(suggestStreamName(next))
  }

  const add = () => {
    const streamName = name.trim()
    if (picked.length === 0) return toast.error('Tick the subjects in this stream.')
    if (!streamName) return toast.error('Enter a name for the stream.')
    if (value.some((c) => c.name.trim().toLowerCase() === streamName.toLowerCase())) {
      return toast.error(`A stream named ${streamName} already exists.`)
    }
    const existing = matchStream(picked.join(' + '), value)
    if (existing) return toast.error(`${existing} already has these subjects.`)
    onChange([...value, { name: streamName, subjects: picked }])
    setPicked([])
    setName('')
    setNameEdited(false)
  }

  return (
    <div>
      <Label>Streams</Label>
      <p className="text-xs text-neutral-500 mb-2">
        Subject combinations offered in the lead and DC Stream dropdown. Tick this product&apos;s subjects, name the stream (e.g. MPC), and add it.
      </p>
      {subjects.length === 0 ? (
        <p className="text-sm text-amber-700">Add this product&apos;s subjects first; streams are made from them.</p>
      ) : (
        <div className="rounded border p-3 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {subjects.map((subject) => (
              <label key={subject} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={picked.includes(subject)} onCheckedChange={(checked) => toggle(subject, checked === true)} />
                {subject}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              className="bg-white text-neutral-900"
              placeholder="Stream name, e.g. MPC"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameEdited(true)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            />
            <Button type="button" variant="outline" onClick={add}>Add Stream</Button>
          </div>
        </div>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((combo) => (
            <Badge key={combo.name} variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3">
              {streamLabel(combo.name, value)}
              <button
                type="button"
                aria-label={`Remove ${combo.name}`}
                onClick={() => onChange(value.filter((item) => item.name !== combo.name))}
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
