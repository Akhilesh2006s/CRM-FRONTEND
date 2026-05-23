'use client'

import type { ComponentType } from 'react'
import {
  FileText,
  PlusCircle,
  RefreshCw,
  Phone,
  CheckCircle2,
  Clock,
  Users,
  Settings,
  Package,
  BarChart3,
  Circle,
} from 'lucide-react'
import { isChildNavActive } from '@/lib/navActive'

type LucideLike = ComponentType<{ size?: number; className?: string }>

const LABEL_ICONS: Record<string, LucideLike> = {
  'All Leads': FileText,
  'Add Lead': PlusCircle,
  'Renewal Leads': RefreshCw,
  'Followup Leads': Phone,
  'Create Sale': PlusCircle,
  'Closed Sales': CheckCircle2,
  'Pending DC': Clock,
  'Pending Leaves': Clock,
  'Request Leave': PlusCircle,
  'My Leaves': CheckCircle2,
  'Active Employees': Users,
  'New Employee': PlusCircle,
  'Leads Reports': BarChart3,
  'All Products': Package,
  'Change Password': Settings,
}

export function resolveChildIcon(label: string, icon?: LucideLike): LucideLike {
  if (icon && typeof icon === 'function') return icon
  return LABEL_ICONS[label] ?? Circle
}

export function hasActiveChild(
  pathname: string,
  children: { href?: string }[]
): boolean {
  return children.some(
    (c) => c.href && isChildNavActive(pathname, c.href, children)
  )
}

type NavIconBadgeProps = {
  icon: LucideLike
  active?: boolean
  size?: 'sm' | 'md'
}

export function NavIconBadge({ icon: Icon, active, size = 'md' }: NavIconBadgeProps) {
  const iconSize = size === 'sm' ? 14 : 18
  const boxClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg transition-colors ${boxClass} ${
        active
          ? 'bg-white/20 text-white ring-1 ring-white/30'
          : 'bg-white/5 text-white/55'
      }`}
    >
      <Icon size={iconSize} className="flex-shrink-0" />
    </span>
  )
}
