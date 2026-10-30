'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiRequest } from '@/lib/api'

type MyBirthday = { date: string; isBirthday: boolean; name: string }

const dismissKey = (date: string) => `birthdayWishDismissed:${date}`

/**
 * Birthday wish for the signed-in employee (any role), shown on their birthday
 * (Indian date, from the date of birth saved on their profile). Dismissible for the day.
 */
export function BirthdayWish() {
  const [wish, setWish] = useState<MyBirthday | null>(null)

  useEffect(() => {
    let cancelled = false
    apiRequest<MyBirthday>('/employees/birthdays/me')
      .then((data) => {
        if (cancelled || !data?.isBirthday) return
        try {
          if (localStorage.getItem(dismissKey(data.date))) return
        } catch {
          // Storage blocked: still show the wish.
        }
        setWish(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!wish) return null

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(wish.date), '1')
    } catch {
      // ignore
    }
    setWish(null)
  }

  return (
    <div
      role="status"
      className="relative mb-6 overflow-hidden rounded-xl border border-pink-200 bg-gradient-to-r from-pink-50 via-amber-50 to-violet-50 p-5 shadow-sm"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss birthday wish"
        className="absolute right-3 top-3 rounded p-1 text-neutral-500 hover:bg-white/70 hover:text-neutral-800"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-4 pr-6">
        <div className="text-4xl" aria-hidden="true">🎂</div>
        <div>
          <div className="text-lg font-semibold text-neutral-900">
            Happy Birthday{wish.name ? `, ${wish.name}` : ''}! 🎉
          </div>
          <p className="text-sm text-neutral-700">
            Wishing you a wonderful year ahead from all of us at Viswam EduTech. Have a great day!
          </p>
        </div>
      </div>
    </div>
  )
}
