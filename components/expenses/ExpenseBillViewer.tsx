'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { resolveUploadUrl } from '@/lib/api'
import { FileText } from 'lucide-react'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i
const PDF_EXT = /\.pdf(\?.*)?$/i

/** Shows a bill / ticket inside the app (image or PDF), never in a new tab. */
export function ExpenseBillDialog({
  url,
  title = 'Bill',
  open,
  onOpenChange,
}: {
  url?: string | null
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const href = resolveUploadUrl(url || '')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {!href ? (
          <p className="text-sm text-neutral-500 py-8 text-center">No bill uploaded.</p>
        ) : PDF_EXT.test(href) || href.startsWith('data:application/pdf') ? (
          <iframe src={href} title={title} className="w-full h-[75vh] rounded border" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={title} className="max-h-[75vh] w-full object-contain rounded border bg-neutral-50" />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Thumbnail / icon that opens the bill in the in-app viewer. */
export function ExpenseBillButton({ label, url }: { label: string; url?: string | null }) {
  const [open, setOpen] = useState(false)
  const href = resolveUploadUrl(url || '')
  if (!href) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex flex-col items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        title={`View ${label}`}
      >
        {IMAGE_EXT.test(href) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={label} className="h-14 w-14 rounded border border-neutral-200 object-cover" />
        ) : (
          <FileText className="h-8 w-8" />
        )}
        <span>{label}</span>
      </button>
      <ExpenseBillDialog url={url} title={label} open={open} onOpenChange={setOpen} />
    </>
  )
}
