import * as React from 'react'

import { cn } from '@/lib/utils'
import { todayDateString } from '@/lib/todayDate'

type InputProps = React.ComponentProps<'input'> & {
  /** Search/report range filters may look up history. Entry calendars default to today as min. */
  allowPastDates?: boolean
}

function isHistoryLookupDateInput({
  allowPastDates,
  id,
  name,
  placeholder,
}: {
  allowPastDates?: boolean
  id?: string
  name?: string
  placeholder?: string
}) {
  if (allowPastDates) return true
  const blob = [id, name, placeholder].filter(Boolean).join(' ').toLowerCase()
  const compact = blob.replace(/[-_]/g, '')
  if (compact.includes('fromdate') || compact.includes('todate')) return true
  if (blob.includes('from date') || blob.includes('to date')) return true
  if (/dd[-/]mm[-/]yyyy/.test(blob)) return true
  if (id === 'leave-report-date' || id === 'execFromDate' || id === 'execToDate') return true
  if ((placeholder || '').toLowerCase().includes('optional')) return true
  return false
}

function Input({ className, type, allowPastDates, min, ...props }: InputProps) {
  const dateMin =
    type === 'date' && min === undefined && !isHistoryLookupDateInput({ allowPastDates, id: props.id, name: props.name, placeholder: props.placeholder })
      ? todayDateString()
      : min

  return (
    <input
      type={type}
      min={dateMin}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
