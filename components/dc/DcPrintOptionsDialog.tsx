'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DC_PRINT_COLUMNS,
  DC_PRINT_SECTIONS,
  DEFAULT_DC_PRINT_OPTIONS,
  loadDcPrintOptions,
  saveDcPrintOptions,
  type DcPrintColumn,
  type DcPrintOptions,
  type DcPrintSection,
} from '@/lib/dcChallanPdf'

/** Pick which columns and blocks the Delivery Challan prints; the choice is remembered. */
export function DcPrintOptionsDialog({
  open,
  onOpenChange,
  onPrint,
  busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrint: (options: DcPrintOptions) => void
  busy?: boolean
}) {
  const [options, setOptions] = useState<DcPrintOptions>(DEFAULT_DC_PRINT_OPTIONS)
  useEffect(() => {
    if (open) setOptions(loadDcPrintOptions())
  }, [open])

  const toggleColumn = (key: DcPrintColumn) => {
    if (key === 'qty') return
    setOptions((o) => ({ ...o, columns: o.columns.includes(key) ? o.columns.filter((c) => c !== key) : [...o.columns, key] }))
  }
  const toggleSection = (key: DcPrintSection) =>
    setOptions((o) => ({ ...o, sections: o.sections.includes(key) ? o.sections.filter((c) => c !== key) : [...o.sections, key] }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print Delivery Challan</DialogTitle>
          <DialogDescription>Choose what the printout shows. Your choice is remembered for the next DC.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold mb-2">Table columns</div>
            <div className="grid grid-cols-2 gap-2">
              {DC_PRINT_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={options.columns.includes(c.key)} disabled={c.key === 'qty'} onChange={() => toggleColumn(c.key)} />
                  {c.label}{c.key === 'qty' ? ' (always)' : ''}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Details at the top</div>
            <div className="space-y-2">
              {DC_PRINT_SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4" checked={options.sections.includes(s.key)} onChange={() => toggleSection(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-2">DC No and DC Date always print.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOptions(DEFAULT_DC_PRINT_OPTIONS)}>Reset to default</Button>
          <Button
            disabled={busy}
            onClick={() => {
              saveDcPrintOptions(options)
              onPrint(options)
            }}
          >
            {busy ? 'Preparing…' : 'Print'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
