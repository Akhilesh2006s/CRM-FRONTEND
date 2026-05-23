'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Eye,
  FileText,
  GraduationCap,
  List,
  Package,
  Phone,
  PlusCircle,
  RefreshCw,
  Save,
  Settings,
  Shield,
  TrendingUp,
  Truck,
  UserCircle2,
  Users,
  Wallet,
} from 'lucide-react'
import { isChildNavActive } from './navActive'

type NavChild = { href?: string; label?: string }

/** True when any child link matches the current route. */
export function hasActiveChild(pathname: string, children: NavChild[]): boolean {
  return children.some((child) =>
    child.href ? isChildNavActive(pathname, child.href, children) : false
  )
}

const LABEL_ICON_MAP: Record<string, LucideIcon> = {
  'All Leads': List,
  'Add Lead': PlusCircle,
  'Renewal Leads': RefreshCw,
  'Followup Leads': Phone,
  'Create Sale': PlusCircle,
  'Closed Sales': CheckCircle2,
  'Saved DC': Save,
  'Pending DC': Clock,
  'EMP DC': UserCircle2,
  'Term-Wise DC': FileText,
  'New Employee': UserCircle2,
  'Active Employees': Users,
  'Inactive Employees': Users,
  'Pending Leaves': CalendarCheck2,
  Zones: Database,
  Clusters: Database,
  'All Managers': Shield,
  'Create Manager': PlusCircle,
  'Leaves Report': FileText,
  'Apply for Leave': PlusCircle,
  'My Leaves': CheckCircle2,
  'Add Trainer': PlusCircle,
  'Active Trainers': CheckCircle2,
  'Trainers Dashboard': Activity,
  'Assign Training/Service': GraduationCap,
  'Trainings List': GraduationCap,
  'Services List': Settings,
  'Inactive Trainers': Users,
  'Inventory Items': Package,
  'DC @ Warehouse': Truck,
  'Completed DC': CheckCircle2,
  'Hold DC': Clock,
  'DC listed': List,
  'Search DC': Eye,
  'Employee Returns List': RefreshCw,
  'Warehouse Returns List': Building2,
  'Pending Payments': Clock,
  'Add Payment': PlusCircle,
  'Payments Done': CheckCircle2,
  'Transaction Report': BarChart3,
  'Approval Pending Cash': Wallet,
  'Approval Pending Cheques': CreditCard,
  'Approved Payments': CheckCircle2,
  'HOLD Payments': Clock,
  'Pending Expenses List': Clock,
  'Finance Pending Exp List': Wallet,
  Leads: TrendingUp,
  'Sales Visit': Truck,
  'Employee Track': Activity,
  'Contact Queries': Phone,
  'Change Logs': FileText,
  Stock: BarChart3,
  DC: Truck,
  Returns: RefreshCw,
  'All Expenses': Wallet,
  'All Products': Package,
  Deliverables: Eye,
  Partner: Building2,
  'Change Password': Settings,
  'App Dashboard Data Upload': Database,
  SMS: Phone,
  'DB Backup': Database,
  'Expense policy': Settings,
}

/** Prefer explicit nav icon; otherwise map label to a premium Lucide icon. */
export function resolveChildIcon(label: string, icon?: LucideIcon): LucideIcon {
  if (icon && typeof icon === 'function') return icon
  return LABEL_ICON_MAP[label] ?? FileText
}

type NavIconBadgeProps = {
  icon: LucideIcon
  active?: boolean
  size?: 'sm' | 'md'
}

/** Rounded icon chip for sidebar parent/child links (green CRM theme). */
export function NavIconBadge({ icon: Icon, active, size = 'md' }: NavIconBadgeProps) {
  const box = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const iconPx = size === 'sm' ? 12 : 16

  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-[#16A34A]/30 text-white shadow-sm'
          : 'bg-white/8 text-white/55 group-hover:bg-[#16A34A]/15 group-hover:text-white'
      }`}
    >
      <Icon size={iconPx} strokeWidth={2.25} />
    </span>
  )
}
