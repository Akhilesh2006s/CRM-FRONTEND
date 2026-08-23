'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { canAccessHref } from '@/lib/access'
import {
  buildRbacSidebarNav,
  rbacCatalogHrefs,
  type BuiltRbacNavItem,
} from '@/lib/rbac-nav'
import { useSidebar } from '@/contexts/SidebarContext'
import {
  LayoutDashboard,
  Truck,
  PlusCircle,
  CheckCircle2,
  Save,
  Clock,
  UserCircle2,
  Users,
  CalendarCheck2,
  GraduationCap,
  Boxes,
  RefreshCw,
  CreditCard,
  Calculator,
  BarChart3,
  Settings,
  LogOut,
  FileText,
  Package,
  Building2,
  Receipt,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  FileSearch,
  Database,
  Shield,
  MessageSquare,
  Copy,
  TrendingUp,
  Eye,
  History,
  Menu,
  X,
  Phone,
  ChevronDown,
} from 'lucide-react'

function isChildRouteActive(
  pathname: string | null | undefined,
  href: string | undefined,
  siblings?: { href?: string }[]
) {
  if (!pathname || !href) return false
  if (pathname === href) return true
  if (href === '/dashboard' || !pathname.startsWith(href + '/')) return false
  const hasBetterMatch = siblings?.some(
    (other) =>
      !!other.href &&
      other.href !== href &&
      pathname.startsWith(other.href + '/') &&
      other.href.length > href.length
  )
  return !hasBetterMatch
}

function hasActiveChild(
  pathname: string | null | undefined,
  children?: { href?: string }[] | null
) {
  if (!pathname || !Array.isArray(children) || children.length === 0) return false
  return children.some((c) => isChildRouteActive(pathname, c.href, children))
}

type NavItem = {
  label: string
  icon?: any
  href?: string
  children?: { label: string; href: string; icon?: any; adminOnly?: boolean }[]
}

function HoverTooltip({ item, pathname, onClose }: { item: NavItem; pathname: string | null; onClose: () => void }) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 64 })

  useEffect(() => {
    const updatePosition = () => {
      const element = document.querySelector(`[data-item="${item.label}"]`)
      if (element && tooltipRef.current) {
        const rect = element.getBoundingClientRect()
        setPosition({
          top: rect.top,
          left: rect.right + 8
        })
      }
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [item.label])

  if (!item.children) return null

  return (
    <div
      ref={tooltipRef}
      className="hover-tooltip-container fixed z-[9999] pointer-events-none"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onMouseEnter={() => {}} // Keep tooltip open
      onMouseLeave={onClose}
    >
      <div className="pointer-events-auto bg-white rounded-lg shadow-2xl border border-neutral-200/60 py-2 min-w-[220px] overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-200">
        <div className="px-3 py-2.5 border-b border-neutral-200/60 bg-neutral-50">
          <div className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">{item.label}</div>
        </div>
        <ul className="py-1">
          {item.children.map((c) => {
            const isActive = isChildRouteActive(pathname, c.href, item.children)
            return (
              <li key={c.label}>
                <Link 
                  href={c.href || '#'}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 text-sm px-3 py-2.5 font-medium transition-all duration-200 rounded-lg relative ${
                    isActive 
                      ? 'bg-neutral-100 text-neutral-900 shadow-sm border border-neutral-300 rounded-lg' 
                      : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-white/5 to-transparent pointer-events-none" />
                  )}
                  {c.icon && typeof c.icon === 'function' && (
                    <c.icon size={14} className={`flex-shrink-0 relative z-10 ${isActive ? 'text-blue-700' : 'text-neutral-600'}`} />
                  )}
                  <span className="relative z-10">{c.label}</span>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  {
    label: 'Clients',
    icon: Truck,
    children: [
      { label: 'Create Sale', href: '/dashboard/dc/create', icon: PlusCircle },
      { label: 'All Created DCs', href: '/dashboard/dc/admin/my', icon: FileText },
      { label: 'Closed Sales', href: '/dashboard/dc/closed', icon: CheckCircle2 },
      { label: 'Saved DC', href: '/dashboard/dc/saved', icon: Save },
      { label: 'Pending DC', href: '/dashboard/dc/pending', icon: Clock },
      { label: 'EMP DC', href: '/dashboard/dc/emp', icon: UserCircle2 },
    ],
  },
  {
    label: 'Users / Employees',
    icon: Users,
    children: [
      { label: 'New Employee', href: '/dashboard/employees/new' },
      { label: 'Active Employees', href: '/dashboard/employees/active' },
      { label: 'Inactive Employees', href: '/dashboard/employees/inactive' },
      { label: 'Assign Areas', href: '/dashboard/executives/assign-areas' },
      { label: 'Zones', href: '/dashboard/employees/zones', icon: Database },
      { label: 'Clusters', href: '/dashboard/employees/clusters', icon: Database },
    ],
  },
  {
    label: 'Executive Managers',
    icon: Shield,
    children: [
      { label: 'All Managers', href: '/dashboard/executive-managers' },
      { label: 'Create Manager', href: '/dashboard/executive-managers/new' },
      { label: 'Executives', href: '/dashboard/executive-managers/executives' },
    ],
  },
  {
    label: 'Leave Management',
    icon: CalendarCheck2,
    children: [
      { label: 'Pending Leaves', href: '/dashboard/leaves/pending', icon: Clock },
      { label: 'Leaves Report', href: '/dashboard/leaves/report', icon: FileText },
    ],
  },
  {
    label: 'Trainings & Services',
    icon: GraduationCap,
    children: [
      { label: 'Add Trainer', href: '/dashboard/training/trainers/new' },
      { label: 'Active Trainers', href: '/dashboard/training/trainers/active' },
      { label: 'Trainers Dashboard', href: '/dashboard/training/dashboard' },
      { label: 'Assign Training/Service', href: '/dashboard/training/assign' },
      { label: 'Trainings List', href: '/dashboard/training/list' },
      { label: 'Services List', href: '/dashboard/training/services' },
      { label: 'Inactive Trainers', href: '/dashboard/training/trainers/inactive' },
    ],
  },
  {
    label: 'Warehouse',
    icon: Boxes,
    children: [
      { label: 'Inventory Items', href: '/dashboard/warehouse/inventory-items' },
      { label: 'Stock', href: '/dashboard/warehouse/stock' },
      { label: 'DC @ Warehouse', href: '/dashboard/warehouse/dc-at-warehouse' },
      { label: 'Completed DC', href: '/dashboard/warehouse/completed-dc' },
      { label: 'Hold DC', href: '/dashboard/warehouse/hold-dc' },
      { label: 'DC listed', href: '/dashboard/warehouse/dc-listed' },
      { label: 'Search DC', href: '/dashboard/warehouse/search-dc', adminOnly: true },
    ],
  },
  {
    label: 'Stock Returns',
    icon: RefreshCw,
    children: [
      { label: 'Employee Returns List', href: '/dashboard/returns/employees' },
      { label: 'Warehouse Returns List', href: '/dashboard/returns/warehouse' },
    ],
  },
  {
    label: 'Payments',
    icon: CreditCard,
    children: [
      { label: 'Pending Payments', href: '/dashboard/payments' },
      { label: 'Add Payment', href: '/dashboard/payments/add-payment' },
      { label: 'Payments Done', href: '/dashboard/payments/done' },
      { label: 'Transaction Report', href: '/dashboard/payments/transaction-report' },
      { label: 'Approval Pending Cash', href: '/dashboard/payments/approval-pending-cash' },
      { label: 'Approval Pending Cheques', href: '/dashboard/payments/approval-pending-cheques' },
      { label: 'Approved Payments', href: '/dashboard/payments/approved-payments' },
      { label: 'HOLD Payments', href: '/dashboard/payments/hold-payments' },
    ],
  },
  {
    label: 'Expenses',
    icon: Calculator,
    children: [
      { label: 'Pending Expenses List', href: '/dashboard/expenses/pending' },
      { label: 'Finance Pending Exp List', href: '/dashboard/expenses/finance-pending' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Leads', href: '/dashboard/reports/leads' },
      { label: 'Sales Visit', href: '/dashboard/reports/sales-visit' },
      { label: 'Employee Track', href: '/dashboard/reports/employee-track' },
      { label: 'Contact Enquiries', href: '/dashboard/reports/contact-queries' },
      { label: 'Change Logs', href: '/dashboard/reports/change-logs' },
      { label: 'Stock', href: '/dashboard/reports/stock' },
      { label: 'DC', href: '/dashboard/reports/dc' },
      { label: 'Returns', href: '/dashboard/reports/returns' },
      { label: 'All Expenses', href: '/dashboard/reports/expenses' },
      { label: 'Training & Service', href: '/dashboard/reports/training-service' },
    ],
  },
  {
    label: 'Products',
    icon: Package,
    children: [
      { label: 'All Products', href: '/dashboard/products', icon: Database },
      { label: 'Add New Product', href: '/dashboard/products/new', icon: PlusCircle },
      { label: 'Deliverables', href: '/dashboard/products/deliverables', icon: Eye, adminOnly: true },
    ],
  },
  {
    label: 'Vendor',
    icon: Building2,
    children: [
      { label: 'Vendors', href: '/dashboard/products/vendors' },
      { label: 'Stocks', href: '/dashboard/stocks' },
      { label: 'My DCs', href: '/dashboard/dcs' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Change Password', href: '/dashboard/settings/password' },
      { label: 'App Dashboard Data Upload', href: '/dashboard/settings/upload' },
      { label: 'SMS', href: '/dashboard/settings/sms' },
      { label: 'DB Backup', href: '/dashboard/settings/backup' },
      { label: 'Expense policy', href: '/dashboard/settings/expenses', adminOnly: true },
      { label: 'Roles & Permissions', href: '/dashboard/settings/roles' },
    ],
  },
  { label: 'Sign out', icon: LogOut, href: '/auth/login' },
]

const RBAC_MODULE_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  clients: Truck,
  leads: TrendingUp,
  employees: Users,
  leaves: CalendarCheck2,
  training: GraduationCap,
  warehouse: Boxes,
  returns: RefreshCw,
  payments: CreditCard,
  expenses: Calculator,
  reports: BarChart3,
  products: Package,
  settings: Settings,
  executive_managers: Users,
  samples: Package,
  vendor: Building2,
}

function filterNavByPermissions(
  nav: NavItem[],
  user: { permissions?: string[]; role?: string; isSuperAdmin?: boolean; rbacEnabled?: boolean } | null
): NavItem[] {
  return nav
    .map((item) => {
      if (item.href === '/auth/login') return item
      if (item.children?.length) {
        const children = item.children.filter((c) => canAccessHref(user as any, c.href))
        if (children.length === 0) return null
        return { ...item, children }
      }
      if (item.href && !canAccessHref(user as any, item.href)) return null
      return item
    })
    .filter((x): x is NavItem => x !== null)
}

function rbacBuiltToNavItems(built: BuiltRbacNavItem[]): NavItem[] {
  return built.map((item) => {
    const icon = RBAC_MODULE_ICONS[item.module] || LayoutDashboard
    if (item.href) {
      return { label: item.label, href: item.href, icon }
    }
    return {
      label: item.label,
      icon,
      children: item.children?.map((c) => ({ label: c.label, href: c.href })) || [],
    }
  })
}

const ASSIGN_MANAGERS_HREF = '/dashboard/executive-managers'
const ASSIGN_MANAGERS_NAV = { label: 'Assign Managers', href: ASSIGN_MANAGERS_HREF }

const SUPERADMIN_HIDDEN_TRAINING_LABELS = new Set([
  'Add Trainer',
  'Active Trainers',
  'Trainers Dashboard',
  'Inactive Trainers',
])

const SUPERADMIN_HIDDEN_TRAINING_HREFS = new Set([
  '/dashboard/training/trainers/new',
  '/dashboard/training/trainers/active',
  '/dashboard/training/dashboard',
  '/dashboard/training',
  '/dashboard/training/trainers/inactive',
])

/** Super Admin: hide trainer-admin pages from Trainings & Services. */
function applySuperAdminTrainingNav(nav: NavItem[]): NavItem[] {
  return nav
    .map((item) => {
      if (item.label !== 'Trainings & Services' || !item.children) return item
      const children = item.children.filter((child) => {
        const href = (child.href || '').replace(/\/$/, '')
        if (SUPERADMIN_HIDDEN_TRAINING_LABELS.has(child.label)) return false
        if (SUPERADMIN_HIDDEN_TRAINING_HREFS.has(href)) return false
        return true
      })
      return { ...item, children }
    })
    .filter((item) => item.label !== 'Trainings & Services' || (item.children && item.children.length > 0))
}

/** Super Admin: drop Executive Managers section; surface Assign Managers under Users / Employees. */
function applySuperAdminExecutiveManagersNav(nav: NavItem[]): NavItem[] {
  const withoutEmSection = nav.filter((item) => item.label !== 'Executive Managers')

  return withoutEmSection.map((item) => {
    if (item.label !== 'Users / Employees' || !item.children) return item

    const cleaned = item.children.filter((c) => {
      const href = c.href || ''
      if (href === ASSIGN_MANAGERS_HREF) return false
      if (href === '/dashboard/executive-managers/new') return false
      if (href === '/dashboard/executive-managers/executives') return false
      if (c.label === 'All Managers' || c.label === 'Assign Managers') return false
      if (c.label === 'Create Manager' || c.label === 'Executives') return false
      return true
    })

    return {
      ...item,
      children: [ASSIGN_MANAGERS_NAV, ...cleaned],
    }
  })
}

/** Super Admin: Settings must be last nav section, immediately before Sign out. */
function applySuperAdminNavOrder(nav: NavItem[]): NavItem[] {
  const isSignOut = (item: NavItem) =>
    item.label === 'Sign out' || item.href === '/auth/login'
  const settings = nav.filter((item) => item.label === 'Settings')
  const signOut = nav.filter(isSignOut)
  const rest = nav.filter((item) => item.label !== 'Settings' && !isSignOut(item))
  return [...rest, ...settings, ...signOut]
}

const VENDOR_MASTER_HREF = '/dashboard/products/vendors'

const VENDOR_SECTION_CHILDREN: { label: string; href: string }[] = [
  { label: 'Vendors', href: VENDOR_MASTER_HREF },
  { label: 'Stocks', href: '/dashboard/stocks' },
  { label: 'My DCs', href: '/dashboard/dcs' },
]

function isVendorMasterNavChild(child: { label?: string; href?: string }) {
  const href = (child.href || '').replace(/\/$/, '')
  if (href === VENDOR_MASTER_HREF) return true
  return child.label === 'Vendor' || child.label === 'Vendors' || child.label === 'Partner'
}

/** Keep vendor master, Stocks, and My DCs in the Vendor section — never nested under Products. */
function applyVendorSectionNav(nav: NavItem[]): NavItem[] {
  const withoutProductsVendor = nav.map((item) => {
    if (item.label !== 'Products' || !item.children) return item
    return {
      ...item,
      children: item.children.filter((child) => !isVendorMasterNavChild(child)),
    }
  })

  const existingVendor = withoutProductsVendor.find((item) => item.label === 'Vendor')
  const seen = new Set<string>()
  const children: { label: string; href: string }[] = []

  const addChild = (label: string, href: string) => {
    const key = href.replace(/\/$/, '')
    if (!key || seen.has(key)) return
    seen.add(key)
    children.push({ label, href })
  }

  for (const child of VENDOR_SECTION_CHILDREN) {
    addChild(child.label, child.href)
  }
  for (const child of existingVendor?.children || []) {
    if (child.href) addChild(child.label, child.href)
  }
  if (existingVendor?.href) {
    addChild(existingVendor.label === 'Vendor' ? 'Vendors' : existingVendor.label, existingVendor.href)
  }

  const vendorItem: NavItem = {
    label: 'Vendor',
    icon: Building2,
    children,
  }

  const withoutVendorSection = withoutProductsVendor.filter((item) => item.label !== 'Vendor')
  const productsIdx = withoutVendorSection.findIndex((item) => item.label === 'Products')
  if (productsIdx >= 0) {
    withoutVendorSection.splice(productsIdx + 1, 0, vendorItem)
  } else {
    withoutVendorSection.push(vendorItem)
  }
  return withoutVendorSection
}

/** Executive: preferred sidebar order; Settings before Samples, then Sign out. */
function applyExecutiveSidebarOrder(nav: NavItem[]): NavItem[] {
  const preferred = [
    'Dashboard',
    'Leads',
    'Clients',
    'Leave Management',
    'Stock Returns',
    'Payments',
    'Expenses',
    'Settings',
    'Samples',
  ] as const

  const isSignOut = (item: NavItem) =>
    item.label === 'Sign out' || item.href === '/auth/login'

  const byLabel = new Map<string, NavItem>()
  for (const item of nav) {
    if (isSignOut(item)) continue
    byLabel.set(item.label, item)
  }

  // Existing Executive leave menu may be labeled "My Leaves"
  if (!byLabel.has('Leave Management') && byLabel.has('My Leaves')) {
    const leaves = byLabel.get('My Leaves')!
    byLabel.set('Leave Management', { ...leaves, label: 'Leave Management' })
    byLabel.delete('My Leaves')
  }

  // Executive Clients: only My Clients + Term-Wise DC (no Create Sale / Closed Sales / etc.)
  byLabel.set('Clients', {
    label: 'Clients',
    icon: Users,
    children: [
      { label: 'My Clients', href: '/dashboard/dc/client-dc', icon: Users },
      { label: 'Term-Wise DC', href: '/dashboard/dc/client-dc/term-wise', icon: FileText },
    ],
  })
  // My Clients must not remain as a separate top-level item
  byLabel.delete('My Clients')

  if (!byLabel.has('Settings')) {
    byLabel.set('Settings', {
      label: 'Settings',
      icon: Settings,
      children: [{ label: 'Change Password', href: '/dashboard/settings/password' }],
    })
  }

  const ordered: NavItem[] = []
  const used = new Set<string>()
  for (const label of preferred) {
    const item = byLabel.get(label)
    if (item) {
      ordered.push(item)
      used.add(label)
    }
  }

  // Keep any other existing Executive items except My Leaves / top-level My Clients
  for (const [label, item] of byLabel) {
    if (!used.has(label) && label !== 'My Leaves' && label !== 'My Clients') {
      ordered.push(item)
    }
  }

  const withoutSettingsAndSamples = ordered.filter(
    (item) => item.label !== 'Settings' && item.label !== 'Samples'
  )
  const settings = byLabel.get('Settings')
  const samples = byLabel.get('Samples')
  const signOut = nav.filter(isSignOut)

  return [
    ...withoutSettingsAndSamples,
    ...(settings ? [settings] : []),
    ...(samples ? [samples] : []),
    ...signOut,
  ]
}

/** Role-specific links (e.g. executive-manager dashboard) not in the RBAC catalog. */
function extractExtraNavItems(
  nav: NavItem[],
  user: { permissions?: string[]; isSuperAdmin?: boolean } | null,
  catalogHrefs: Set<string>
): NavItem[] {
  const extras: NavItem[] = []
  for (const item of nav) {
    if (item.href === '/auth/login') continue
    if (item.children?.length) {
      const children = item.children.filter(
        (c) =>
          c.href &&
          !catalogHrefs.has(c.href) &&
          canAccessHref(user as any, c.href)
      )
      if (children.length > 0) {
        extras.push({ ...item, children })
      }
      continue
    }
    if (
      item.href &&
      !catalogHrefs.has(item.href) &&
      canAccessHref(user as any, item.href)
    ) {
      extras.push(item)
    }
  }
  return extras
}

/** Merge extras into same-label sections so React keys stay unique and toggles work. */
function mergeNavExtras(base: NavItem[], extras: NavItem[]): NavItem[] {
  const result = base.map((item) => ({
    ...item,
    children: item.children ? [...item.children] : undefined,
  }))

  for (const extra of extras) {
    const idx = result.findIndex((item) => item.label === extra.label)
    if (idx >= 0) {
      const existing = result[idx]
      if (extra.children?.length) {
        const seen = new Set((existing.children || []).map((c) => c.href).filter(Boolean))
        const mergedChildren = [
          ...(existing.children || []),
          ...extra.children.filter((c) => c.href && !seen.has(c.href)),
        ]
        result[idx] = { ...existing, children: mergedChildren, icon: existing.icon || extra.icon }
      } else if (extra.href && !existing.href && !existing.children?.length) {
        result[idx] = { ...existing, href: extra.href, icon: existing.icon || extra.icon }
      }
      continue
    }
    result.push(extra)
  }

  return result
}

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [user, setUser] = useState<{ _id?: string; name?: string; email?: string; role?: string } | null>(null)
  const { sidebarOpen, setSidebarOpen, toggleSidebar: toggleSidebarContext } = useSidebar()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const { user: permUser, rbacActive, permissionsReady } = usePermissions()
  const [mounted, setMounted] = useState(false)

  // Load sidebar state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('authUser')
        if (raw) setUser(JSON.parse(raw))
        // Do not restore every previously expanded section — that left many sections
        // stuck open and made others hard to reach. Route auto-expand handles the active one.
      } catch {}
      setMounted(true)
    }
  }, [])

  const isEmployee = user?.role === 'Executive'
  const isManager = user?.role === 'Manager'
  const isCoordinator = user?.role === 'Coordinator'
  const isSeniorCoordinator = user?.role === 'Senior Coordinator'
  const isExecutiveManager = user?.role === 'Executive Manager'
  const isExecutive = user?.role === 'Executive'
  const isTrainer = user?.role === 'Trainer'
  const isWarehouseExecutive = user?.role === 'Warehouse Executive'
  const isWarehouseManager = user?.role === 'Warehouse Manager'
  const isPartner = user?.role === 'Partner'

  // Executive leave items are included in the Executive sidebar as Leave Management
  let finalNav: NavItem[] = []
  if (isEmployee) {
    finalNav = [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'Clients',
        icon: Users,
        children: [
          { label: 'My Clients', href: '/dashboard/dc/client-dc', icon: Users },
          { label: 'Term-Wise DC', href: '/dashboard/dc/client-dc/term-wise', icon: FileText },
        ],
      },
      {
        label: 'Leads',
        icon: TrendingUp,
        children: [
          { label: 'Add Lead', href: '/dashboard/leads/add', icon: PlusCircle },
          { label: 'Renewal Leads', href: '/dashboard/leads/renewal', icon: Building2 },
          { label: 'Followup Leads', href: '/dashboard/leads/followup', icon: Phone },
        ],
      },
      {
        label: 'Leave Management',
        icon: CalendarCheck2,
        children: [
          { label: 'Leave Request', href: '/dashboard/leaves/request', icon: PlusCircle },
          { label: 'Leaves', href: '/dashboard/leaves/approved', icon: CheckCircle2 },
        ],
      },
      {
        label: 'Stock Returns',
        icon: RefreshCw,
        href: '/dashboard/returns/executive',
      },
      {
        label: 'Payments',
        icon: CreditCard,
        children: [
          { label: 'Pending Payments', href: '/dashboard/payments', icon: Clock },
          { label: 'Add Payment', href: '/dashboard/payments/add-payment', icon: PlusCircle },
          { label: 'Payments Done', href: '/dashboard/payments/done', icon: CheckCircle2 },
        ],
      },
      {
        label: 'Expenses',
        icon: Calculator,
        children: [
          { label: 'Create Expense', href: '/dashboard/expenses/create', icon: PlusCircle },
          { label: 'My Expenses', href: '/dashboard/expenses/my', icon: FileText },
        ],
      },
      {
        label: 'Settings',
        icon: Settings,
        children: [
          { label: 'Change Password', href: '/dashboard/settings/password' },
        ],
      },
      {
        label: 'Samples',
        icon: Package,
        children: [
          { label: 'Request Samples', href: '/dashboard/samples/request', icon: PlusCircle },
        ],
      },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isManager) {
    // For Manager role, only show: Dashboard, Clients, Warehouse, Expenses, Reports, Settings, Sign out
    const allowedMenuItems = ['Dashboard', 'Clients', 'Warehouse', 'Expenses', 'Reports', 'Settings', 'Sign out']
    finalNav = NAV.filter(item => allowedMenuItems.includes(item.label))
      .map(item => {
        // Filter Clients menu items to exclude "Create Sale" and "All Created DCs" for Manager
        if (item.label === 'Clients' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label !== 'Create Sale' &&
              child.label !== 'All Created DCs' &&
              !child.adminOnly
            )
          }
        }
        // Filter Warehouse menu items to show "DC @ Warehouse", "Completed DC", and "DC listed" for Manager
        if (item.label === 'Warehouse' && item.children) {
          const allowedWarehouseItems = ['DC @ Warehouse', 'Completed DC', 'DC listed']
          return {
            ...item,
            children: item.children.filter(child => 
              allowedWarehouseItems.includes(child.label)
            )
          }
        }
        // Filter Expenses menu items to only show "Pending Expenses List" for Manager
        if (item.label === 'Expenses' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label === 'Pending Expenses List'
            )
          }
        }
        // Filter Reports menu items to only show: Leads, Sales Visit, Employee Track, All Expenses for Manager
        if (item.label === 'Reports' && item.children) {
          const allowedReportItems = ['Leads', 'Sales Visit', 'Employee Track', 'All Expenses']
          return {
            ...item,
            children: item.children.filter(child => 
              allowedReportItems.includes(child.label)
            )
          }
        }
        return item
      })
  } else if (isCoordinator) {
    // For Coordinator role, only show: Dashboard, Clients, Users / Employees, Trainings & Services, Warehouse, Payments, Reports, Settings, Sign out
    const allowedMenuItems = ['Dashboard', 'Clients', 'Users / Employees', 'Trainings & Services', 'Warehouse', 'Payments', 'Reports', 'Settings', 'Sign out']
    finalNav = NAV.filter(item => allowedMenuItems.includes(item.label))
      .map(item => {
        if (item.label === 'Clients' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => !child.adminOnly),
          }
        }
        // Filter Users / Employees menu items to only show "Active Employees" for Coordinator
        if (item.label === 'Users / Employees' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label === 'Active Employees'
            )
          }
        }
        // Filter Trainings & Services menu items to exclude "Add Trainer" for Coordinator
        if (item.label === 'Trainings & Services' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label !== 'Add Trainer'
            )
          }
        }
        // Filter Warehouse menu items to show "DC @ Warehouse", "Completed DC", "DC listed", and "Hold DC" for Coordinator
        if (item.label === 'Warehouse' && item.children) {
          const allowedWarehouseItems = ['DC @ Warehouse', 'Completed DC', 'DC listed', 'Hold DC']
          return {
            ...item,
            children: item.children.filter(child => 
              allowedWarehouseItems.includes(child.label)
            )
          }
        }
        // Filter Payments menu items to exclude "Add Payment" and "HOLD Payments" for Coordinator
        if (item.label === 'Payments' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label !== 'Add Payment' && child.label !== 'HOLD Payments'
            )
          }
        }
        // Filter Reports menu items to only show: Leads, DC, Returns, All Expenses for Coordinator
        if (item.label === 'Reports' && item.children) {
          const allowedReportItems = ['Leads', 'DC', 'Returns', 'All Expenses']
          return {
            ...item,
            children: item.children.filter(child => 
              allowedReportItems.includes(child.label)
            )
          }
        }
        return item
      })
  } else if (isSeniorCoordinator) {
    // Senior Coordinator: only Dashboard, Clients (non-admin pages), Warehouse (all pages), Settings, Sign out.
    // Reports, Payments, Training & Services, Users/Employees are removed.
    const allowedMenuItems = ['Dashboard', 'Clients', 'Warehouse', 'Settings', 'Sign out']
    finalNav = NAV.filter(item => allowedMenuItems.includes(item.label)).map(item => {
      if (item.label === 'Clients' && item.children) {
        return {
          ...item,
          children: item.children.filter(child => !child.adminOnly),
        }
      }
      return item
    })
  } else if (isExecutiveManager) {
    // For Executive Manager role, show My Dashboard and Executive Manager menu
    // Get the manager's own ID from user data (we'll need to store it in auth)
    finalNav = [
      {
        label: 'My Dashboard',
        icon: LayoutDashboard,
        href: `/dashboard/executive-managers/${user?._id || ''}/dashboard`,
      },
      {
        label: 'Executives',
        icon: Users,
        href: '/dashboard/executive-managers/executives',
      },
      {
        label: 'Clients',
        icon: Truck,
        children: [
          { label: 'PO Edit Request', href: '/dashboard/clients/closed-sales', icon: CheckCircle2 },
        ],
      },
      {
        label: 'Expenses',
        icon: Calculator,
        children: [
          { label: 'Pending Expenses', href: '/dashboard/expenses/executive-manager-pending', icon: Clock },
        ],
      },
      {
        label: 'Leave Management',
        icon: CalendarCheck2,
        href: `/dashboard/executive-managers/${user?._id || ''}/leaves`,
      },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isTrainer) {
    // For Trainer role, show only specified menu items
    finalNav = [
      { label: 'My Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'Training & Services (Active / Upcoming)',
        icon: GraduationCap,
        href: '/dashboard/training/trainer/my',
      },
      {
        label: 'Completed Training & Services',
        icon: CheckCircle2,
        href: '/dashboard/training/trainer/completed',
      },
      {
        label: 'Expense',
        icon: Calculator,
        children: [
          { label: 'Create Expense', href: '/dashboard/expenses/create', icon: PlusCircle },
          { label: 'My Expenses', href: '/dashboard/expenses/my', icon: FileText },
        ],
      },
      {
        label: 'Leave Management',
        icon: CalendarCheck2,
        children: [
          { label: 'Apply for Leave', href: '/dashboard/leaves/request', icon: PlusCircle },
          { label: 'My Leaves', href: '/dashboard/leaves/approved', icon: CheckCircle2 },
        ],
      },
      {
        label: 'Reports',
        icon: BarChart3,
        children: [
          { label: 'Leads', href: '/dashboard/reports/leads', icon: FileText },
          { label: 'All Expenses', href: '/dashboard/reports/expenses', icon: Receipt },
        ],
      },
      {
        label: 'Settings',
        icon: Settings,
        children: [
          { label: 'Change Password', href: '/dashboard/settings/password', icon: UserCircle2 },
        ],
      },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isExecutive) {
    // For Executive role, show Dashboard and Assign Areas
    finalNav = [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'Assign Areas',
        icon: Building2,
        href: '/dashboard/executives/assign-areas',
      },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isWarehouseExecutive) {
    // For Warehouse Executive role, show only Dashboard and Stock Returns
    finalNav = [
      { label: 'My Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'Stock Returns',
        icon: RefreshCw,
        href: '/dashboard/returns/warehouse-executive',
      },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isWarehouseManager) {
    // For Warehouse Manager role, show only Dashboard and Stock Returns
    finalNav = [
      { label: 'My Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'Stock Returns',
        icon: RefreshCw,
        href: '/dashboard/returns/warehouse-manager',
      },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isPartner) {
    // For Partner role: Dashboard + Stocks + DCs (assigned products only)
    finalNav = [
      { label: 'My Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { label: 'Stocks', icon: Boxes, href: '/dashboard/stocks' },
      { label: 'My DCs', icon: Truck, href: '/dashboard/dcs' },
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else {
    // For all other roles (Admin, Super Admin, etc.), show all menu items except "DC listed" (only for Manager and Coordinator) and "Term-Wise DC"
    finalNav = NAV.map(item => {
      // Filter Clients menu items to exclude "Term-Wise DC" for Admin
      if (item.label === 'Clients' && item.children) {
        return {
          ...item,
          children: item.children.filter(child => 
            child.label !== 'Term-Wise DC'
          )
        }
      }
      // Filter Warehouse menu items to exclude "DC listed" for roles other than Manager and Coordinator
      // and only show adminOnly items for Admin/Super Admin
      if (item.label === 'Warehouse' && item.children) {
        const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin'
        return {
          ...item,
          children: item.children.filter(child => {
            // Exclude "DC listed" for non-Manager/Coordinator
            if (child.label === 'DC listed') return false
            // Only show adminOnly items for Admin
            if (child.adminOnly && !isAdmin) return false
            return true
          })
        }
      }
      // Filter Products menu items: only show adminOnly (Deliverables) for Admin/Super Admin
      if (item.label === 'Products' && item.children) {
        const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin'
        return {
          ...item,
          children: item.children.filter(child => {
            if (child.adminOnly && !isAdmin) return false
            return true
          })
        }
      }
      return item
    })
  }

  // Keep role-specific Executive Manager nav intact (do not replace with RBAC catalog).
  // Keep role-specific Executive nav intact so Clients submenu order is preserved.
  if (rbacActive && permissionsReady && !isExecutiveManager && !isEmployee) {
    const baseNav = finalNav.length > 0 ? finalNav : NAV
    const catalogHrefs = rbacCatalogHrefs()
    const fromPermissions = rbacBuiltToNavItems(buildRbacSidebarNav(permUser))
    const extras = extractExtraNavItems(baseNav, permUser, catalogHrefs)
    finalNav = [
      ...mergeNavExtras(fromPermissions, extras),
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  }

  // Executive: enforce sidebar order (Clients ▾ with My Clients + Term-Wise DC).
  if (isEmployee || isExecutive) {
    finalNav = applyExecutiveSidebarOrder(finalNav)
  }

  // Super Admin: hide operational Leads menu (Add/Renewal/Followup). Keep Reports → Leads.
  // Also remove Executive Managers section and place Assign Managers under Users / Employees.
  // Remove Samples. Bottom order: Reports → Products → Vendor → Settings → Sign out.
  // Keep Clients → All Created DCs (Create Sale lands there after Deal + DC).
  const isSuperAdminNav = user?.role === 'Super Admin' || permUser?.role === 'Super Admin'
  if (isSuperAdminNav) {
    finalNav = finalNav.filter((item) => {
      if (item.label === 'Samples' || item.label === 'Employee Sample') return false
      if (item.label !== 'Leads') return true
      const children = item.children || []
      const isOperationalLeads =
        children.length > 0 &&
        children.every((c) => (c.href || '').startsWith('/dashboard/leads'))
      return !isOperationalLeads
    })
    finalNav = applySuperAdminTrainingNav(finalNav)
    finalNav = applySuperAdminExecutiveManagersNav(finalNav)
    finalNav = applyVendorSectionNav(finalNav)
    finalNav = applySuperAdminNavOrder(finalNav)
  } else if (user?.role === 'Admin' || permUser?.role === 'Admin') {
    finalNav = applyVendorSectionNav(finalNav)
  }

  const navReady = mounted && (!rbacActive || permissionsReady)

  // Auto-expand the section for the current route (do not close manually opened sections here)
  useEffect(() => {
    if (!pathname || !navReady) return

    setOpen((currentOpen) => {
      const newOpenState = { ...currentOpen }
      let shouldUpdate = false

      finalNav.forEach((item) => {
        if (item.children?.length && hasActiveChild(pathname, item.children)) {
          if (!newOpenState[item.label]) {
            newOpenState[item.label] = true
            shouldUpdate = true
          }
        }
      })

      if (!shouldUpdate) return currentOpen

      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarOpenState', JSON.stringify(newOpenState))
      }
      return newOpenState
    })
  }, [pathname, navReady, isEmployee, isManager, isCoordinator, isSeniorCoordinator])

  const signOut = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken')
        localStorage.removeItem('authUser')
      }
      router.push('/auth/login')
    } catch (error) {
      console.error('Error during sign out:', error)
      // Fallback: redirect using window.location
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    }
  }

  const toggle = (label: string) => {
    setOpen((o) => {
      const willOpen = !o[label]
      // Accordion: opening one section closes the others so sections stay reachable
      const newState = willOpen
        ? { [label]: true }
        : { ...o, [label]: false }
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarOpenState', JSON.stringify(newState))
      }
      return newState
    })
  }

  const toggleSidebar = () => {
    toggleSidebarContext()
  }

  return (
    <>
      {/* Sidebar — AmenityForge green accent */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-16'} shrink-0 flex h-[100dvh] md:h-full flex-col overflow-hidden bg-[#0b1210] text-white fixed inset-y-0 left-0 z-50 md:static md:z-auto border-r border-[#16A34A]/25 shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-[width] duration-300 ease-out`}
      >
        {/* User profile */}
        <div className={`shrink-0 py-4 border-b border-white/15 ${sidebarOpen ? 'px-4' : 'px-0'} hidden md:block`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ring-2 ring-white/35">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate text-white">{user?.name || 'User'}</div>
                <div className="text-[11px] text-white/80 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shadow-[0_0_6px_rgba(22,163,74,0.8)]" />
                  <span>Active</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center text-sm font-semibold text-white ring-2 ring-white/35">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}
        </div>

        {/* Nav header + collapse */}
        <div
          className={`shrink-0 py-3 border-b border-white/15 hidden md:flex items-center ${sidebarOpen ? 'px-4 justify-between' : 'px-0 justify-center'} relative`}
        >
          {sidebarOpen && (
            <div className="text-[10px] tracking-[0.2em] text-white/60 font-semibold uppercase">
              Navigation
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className={`text-white/50 p-2 rounded-lg hover:bg-white/15 hover:text-white transition-all duration-200 flex-shrink-0 ${sidebarOpen ? '' : ''}`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden dashboard-sidebar-scroll bg-[#0b1210] py-2">
        <ul className="block gap-0 px-2">
          {!navReady
            ? Array.from({ length: 6 }).map((_, i) => (
                <li key={`nav-skeleton-${i}`} className="w-full px-2 py-1">
                  <div
                    className={`h-9 rounded-lg bg-white/10 animate-pulse ${
                      sidebarOpen ? 'w-full' : 'w-9 mx-auto'
                    }`}
                  />
                </li>
              ))
            : null}
          {navReady &&
            finalNav.map((item, index) => (
            <li
              key={`${item.label}-${item.href || 'group'}-${index}`}
              className={`w-full ${item.label === 'Sign out' ? 'mt-3 pt-3 border-t border-white/15' : ''}`}
              data-item={item.label}
            >
              {item.children && item.children.length > 0 ? (
                <div 
                  className="relative"
                  onMouseEnter={() => !sidebarOpen && setHoveredItem(item.label)}
                  onMouseLeave={(e) => {
                    // Only close if not moving to tooltip
                    const relatedTarget = e.relatedTarget as HTMLElement | null
                    // Check if relatedTarget exists and has the closest method (is an HTMLElement)
                    if (!relatedTarget || typeof relatedTarget.closest !== 'function' || !relatedTarget.closest('.hover-tooltip-container')) {
                      setHoveredItem(null)
                    }
                  }}
                >
                  <button
                    onClick={() => {
                      if (!sidebarOpen) {
                        setSidebarOpen(true)
                        setTimeout(() => toggle(item.label), 100)
                      } else {
                        toggle(item.label)
                      }
                    }}
                    className={`w-full flex items-center text-white/75 py-2.5 rounded-lg font-medium transition-all duration-200 group ${
                      sidebarOpen ? 'px-3 gap-2.5 justify-start' : 'px-0 justify-center'
                    } ${
                      hasActiveChild(pathname, item.children)
                        ? `bg-[#16A34A]/20 text-white ${sidebarOpen ? 'border-l-[3px] border-[#16A34A] pl-[10px]' : ''}`
                        : `hover:bg-white/10 hover:text-white ${sidebarOpen ? 'border-l-[3px] border-transparent' : ''}`
                    }`}
                    title={!sidebarOpen ? item.label : ''}
                  >
                    {item.icon && typeof item.icon === 'function' && (
                      <item.icon
                        size={18}
                        className={`flex-shrink-0 transition-colors ${
                          hasActiveChild(pathname, item.children)
                            ? 'text-[#4ade80]'
                            : 'text-white/55 group-hover:text-[#4ade80]'
                        }`}
                      />
                    )}
                    {sidebarOpen && (
                      <>
                        <span className="text-[13px] flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          size={14}
                          className={`text-white/40 shrink-0 transition-transform duration-200 ${
                            open[item.label] ? 'rotate-0' : '-rotate-90'
                          }`}
                        />
                      </>
                    )}
                  </button>
                  
                  {/* Hover Tooltip for collapsed sidebar */}
                  {!sidebarOpen && hoveredItem === item.label && (
                    <HoverTooltip 
                      item={item}
                      pathname={pathname}
                      onClose={() => setHoveredItem(null)}
                    />
                  )}
                  
                  {/* Expanded submenu */}
                  {sidebarOpen && (
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-out ${
                        open[item.label] ? 'max-h-[min(24rem,70vh)] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <ul className="ml-3 mt-1 mb-2 space-y-0.5 border-l-2 border-white/25 pl-2">
                        {item.children.map((c) => {
                          const isActive = isChildRouteActive(pathname, c.href, item.children)

                          return (
                            <li key={c.label}>
                              <Link
                                href={c.href || '#'}
                                className={`flex items-center gap-2 text-[12.5px] px-2.5 py-2 rounded-md font-medium transition-all duration-150 ${
                                  isActive
                                    ? 'bg-[#16A34A]/25 text-white border-l-2 border-[#16A34A]'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {c.icon && typeof c.icon === 'function' && (
                                  <c.icon
                                    size={14}
                                    className={`flex-shrink-0 ${isActive ? 'text-[#4ade80]' : 'text-white/50'}`}
                                  />
                                )}
                                <span>{c.label}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                item.label === 'Sign out' ? (
                  <div 
                    className="relative mt-2"
                    onMouseEnter={() => !sidebarOpen && setHoveredItem(item.label)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <button 
                      onClick={signOut} 
                      className={`w-full flex items-center justify-center text-red-400/70 py-2.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 font-medium transition-all duration-200 group ${
                        sidebarOpen ? 'px-3 gap-2.5 justify-start' : 'px-0'
                      }`}
                      title={!sidebarOpen ? item.label : ''}
                    >
                      {item.icon && typeof item.icon === 'function' && <item.icon size={18} className="text-red-400/60 group-hover:text-red-400 flex-shrink-0 transition-colors" />}
                      {sidebarOpen && (
                        <span className="text-[13px] text-red-400/70 group-hover:text-red-400 transition-colors">{item.label}</span>
                      )}
                    </button>
                    
                    {/* Tooltip for sign out when collapsed */}
                    {!sidebarOpen && hoveredItem === item.label && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-200 whitespace-nowrap">
                        <div className="bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-lg border border-red-700">
                          {item.label}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="relative"
                    onMouseEnter={() => !sidebarOpen && setHoveredItem(item.label)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link 
                      href={item.href || '#'} 
                      className={`w-full flex items-center text-white/75 py-2.5 rounded-lg font-medium transition-all duration-200 group ${
                        sidebarOpen ? 'px-3 gap-2.5 justify-start' : 'px-0 justify-center'
                      } ${
                        pathname === item.href
                          ? `bg-[#16A34A]/25 text-white ${sidebarOpen ? 'border-l-[3px] border-[#16A34A] pl-[10px]' : ''}`
                          : `hover:bg-white/10 hover:text-white ${sidebarOpen ? 'border-l-[3px] border-transparent' : ''}`
                      }`}
                      title={!sidebarOpen ? item.label : ''}
                    >
                      {item.icon && typeof item.icon === 'function' && (
                        <item.icon
                          size={18}
                          className={`flex-shrink-0 transition-colors ${
                            pathname === item.href ? 'text-[#4ade80]' : 'text-white/55 group-hover:text-[#4ade80]'
                          }`}
                        />
                      )}
                      {sidebarOpen && (
                        <span className={`text-[13px] transition-colors ${
                          pathname === item.href ? 'text-white' : 'text-white/70 group-hover:text-white'
                        }`}>{item.label}</span>
                      )}
                    </Link>
                    
                    {/* Simple tooltip for single items when collapsed */}
                    {!sidebarOpen && hoveredItem === item.label && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-200 whitespace-nowrap">
                        <div className="bg-neutral-900 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-lg border border-neutral-800">
                          {item.label}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
        </nav>
      </aside>
    </>
  )
}


