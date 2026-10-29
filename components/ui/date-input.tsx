'use client'

import * as React from 'react'
import { CalendarDays } from 'lucide-react'

import { cn } from '@/lib/utils'
import { dmyToYmd, ymdToDmy } from '@/lib/dateFormat'

type DateInputProps = Omit<React.ComponentProps<'input'>, 'type'>

/**
 * Date field shown as DD/MM/YYYY whatever the browser language (a native type="date" box
 * follows the browser, e.g. MM/DD/YYYY on English-US). The value stays YYYY-MM-DD and change
 * events come from a real <input type="date">, so existing onChange handlers
 * (e.target.value / e.target.name) keep working. Type the date or pick it from the calendar.
 */
export function DateInput({
  className,
  value,
  defaultValue,
  onChange,
  onBlur,
  min,
  max,
  name,
  ref,
  disabled,
  readOnly,
  required,
  placeholder,
  ...rest
}: DateInputProps) {
  const hidden = React.useRef<HTMLInputElement | null>(null)
  const controlled = value !== undefined
  const [inner, setInner] = React.useState(String(defaultValue ?? ''))
  const ymd = controlled ? String(value ?? '') : inner
  const [text, setText] = React.useState(ymdToDmy(ymd))
  const [editing, setEditing] = React.useState(false)

  React.useEffect(() => {
    if (!editing) setText(ymdToDmy(ymd))
  }, [ymd, editing])

  const setHiddenRef = (el: HTMLInputElement | null) => {
    hidden.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
  }

  /** Put a YYYY-MM-DD value in the real date input and fire its change event. */
  const emit = (next: string) => {
    const el = hidden.current
    if (!el || el.value === next) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, next)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const inRange = (iso: string) =>
    (!min || iso >= String(min)) && (!max || iso <= String(max))

  const openPicker = () => {
    const el = hidden.current
    if (!el || disabled || readOnly) return
    try {
      el.showPicker?.()
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <div className="relative w-full">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder && !/yyyy/i.test(placeholder) ? placeholder : 'DD/MM/YYYY'}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        maxLength={10}
        className={cn(className, 'pr-9')}
        onFocus={(e) => {
          setEditing(true)
          rest.onFocus?.(e)
        }}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d/.-]/g, '')
          setText(t)
          if (!t.trim()) {
            emit('')
            return
          }
          const iso = dmyToYmd(t)
          if (iso && inRange(iso)) emit(iso)
        }}
        onBlur={(e) => {
          setEditing(false)
          setText(ymdToDmy(hidden.current?.value || ymd))
          onBlur?.(e)
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        disabled={disabled || readOnly}
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={setHiddenRef}
        type="date"
        name={name}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
        {...(controlled ? { value: ymd } : { defaultValue: defaultValue as string | undefined })}
        onChange={(e) => {
          if (!controlled) setInner(e.target.value)
          if (!editing) setText(ymdToDmy(e.target.value))
          onChange?.(e)
        }}
      />
    </div>
  )
}
