import type { LucideIcon } from 'lucide-react'
import {
  PlusCircle,
  Users,
  UserX,
  Shield,
  Clock,
  FileText,
  GraduationCap,
  Activity,
  Package,
  Boxes,
  Building2,
  CheckCircle2,
  List,
  FileSearch,
  RefreshCw,
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle,
  Calculator,
  TrendingUp,
  Truck,
  MessageSquare,
  History,
  Database,
  Save,
  Circle,
  ClipboardList,
  Lock,
} from 'lucide-react'
import { isChildNavActive } from './navActive'

/** Premium icons for submenu items that omit `icon` in NAV config */
export const CHILD_ICON_BY_LABEL: Record<string, LucideIcon> = {
  'New Employee': PlusCircle,
  'Active Employees': Users,
  'Inactive Employees': UserX,
  'All Managers': Shield,
  'Create Manager': PlusCircle,
  'Add Trainer': PlusCircle,
  'Active Trainers': CheckCircle,
  'Trainers Dashboard': Activity,
  'Assign Training/Service': ClipboardList,
  'Trainings List': GraduationCap,
  'Services List': Package,
  'Inactive Trainers': UserX,
  'Inventory Items': Package,
  Stock: Boxes,
  'DC @ Warehouse': Building2,
  'Completed DC': CheckCircle2,
  'Hold DC': Clock,
  'DC listed': List,
  'Search DC': FileSearch,
  'Employee Returns List': Users,
  'Warehouse Returns List': Building2,
  'Pending Payments': Clock,
  'Add Payment': PlusCircle,
  'Payments Done': CheckCircle2,
  'Transaction Report': Receipt,
  'Approval Pending Cash': CreditCard,
  'Approval Pending Cheques': FileText,
  'Approved Payments': CheckCircle,
  'HOLD Payments': AlertCircle,
  'Pending Expenses List': Clock,
  'Finance Pending Exp List': Calculator,
  Leads: TrendingUp,
  'Sales Visit': Truck,
  'Employee Track': Activity,
  'Contact Queries': MessageSquare,
  'Change Logs': History,
  Stock: Package,
  DC: FileText,
  Returns: RefreshCw,
  'All Expenses': Receipt,
  'Change Password': Lock,
  'App Dashboard Data Upload': Database,
  SMS: MessageSquare,
  'DB Backup': Save,
  'Expense policy': Calculator,
}

export function resolveChildIcon(label: string, explicit?: LucideIcon): LucideIcon {
  return explicit ?? CHILD_ICON_BY_LABEL[label] ?? Circle
}

export function hasActiveChild(
  pathname: string,
  children: { href: string }[]
): boolean {
  return children.some((c) => isChildNavActive(pathname, c.href, children))
}

export function NavIconBadge({
  icon: Icon,
  active,
  size = 'md',
}: {
  icon: LucideIcon
  active?: boolean
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const iconSize = size === 'sm' ? 13 : 16
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${box} transition-colors ${
        active
          ? 'bg-[#16A34A]/30 text-[#86efac] ring-1 ring-[#16A34A]/40'
          : 'bg-white/[0.06] text-white/60 group-hover:bg-[#16A34A]/15 group-hover:text-[#86efac]'
      }`}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  )
}
