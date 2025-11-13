'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
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
  RotateCcw,
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
} from 'lucide-react'

type NavItem = {
  label: string
  icon?: any
  href?: string
  children?: { label: string; href: string; icon?: any }[]
}

function HoverTooltip({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
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
            const isActive = pathname === c.href || (c.href !== '/dashboard' && pathname.startsWith(c.href))
            return (
              <li key={c.label}>
                <Link 
                  href={c.href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 text-sm px-3 py-2 font-normal transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500' 
                      : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  {c.icon && <c.icon size={14} className="flex-shrink-0" />}
                  <span>{c.label}</span>
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
      { label: 'Pending Leaves', href: '/dashboard/employees/leaves', icon: CalendarCheck2 },
    ],
  },
  {
    label: 'Executive Managers',
    icon: Shield,
    children: [
      { label: 'All Managers', href: '/dashboard/executive-managers' },
      { label: 'Create Manager', href: '/dashboard/executive-managers/new' },
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
    ],
  },
  {
    label: 'Stock Returns',
    icon: RotateCcw,
    children: [
      { label: 'Employee Returns List', href: '/dashboard/returns/employees' },
      { label: 'Warehouse Returns List', href: '/dashboard/returns/warehouse' },
    ],
  },
  {
    label: 'Payments',
    icon: CreditCard,
    children: [
      { label: 'Add Payment', href: '/dashboard/payments/add-payment' },
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
      { label: 'Contact Queries', href: '/dashboard/reports/contact-queries' },
      { label: 'Change Logs', href: '/dashboard/reports/change-logs' },
      { label: 'Stock', href: '/dashboard/reports/stock' },
      { label: 'DC', href: '/dashboard/reports/dc' },
      { label: 'Returns', href: '/dashboard/reports/returns' },
      { label: 'All Expenses', href: '/dashboard/reports/expenses' },
    ],
  },
  {
    label: 'Products',
    icon: Package,
    children: [
      { label: 'All Products', href: '/dashboard/products', icon: Database },
      { label: 'Add New Product', href: '/dashboard/products/new', icon: PlusCircle },
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
    ],
  },
  { label: 'Sign out', icon: LogOut, href: '/auth/login' },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [user, setUser] = useState<{ _id?: string; name?: string; email?: string; role?: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  // Load sidebar collapsed state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed')
      if (saved !== null) {
        setSidebarOpen(JSON.parse(saved))
      }
    }
  }, [])

  // Load sidebar state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('authUser')
        if (raw) setUser(JSON.parse(raw))
        
        // Load persisted sidebar state
        const savedOpenState = localStorage.getItem('sidebarOpenState')
        if (savedOpenState) {
          try {
            const parsed = JSON.parse(savedOpenState)
            setOpen(parsed)
          } catch {}
        }
      } catch {}
    }
  }, [])

  const isEmployee = user?.role === 'Executive'
  const isManager = user?.role === 'Manager'
  const isCoordinator = user?.role === 'Coordinator'
  const isSeniorCoordinator = user?.role === 'Senior Coordinator'
  const isExecutiveManager = user?.role === 'Executive Manager'
  const isExecutive = user?.role === 'Executive'

  // Add employee leave menu if employee, replace admin Leave Management
  const employeeLeavesMenu: NavItem = {
    label: 'My Leaves',
    icon: CalendarCheck2,
    children: [
      { label: 'Leave Request', href: '/dashboard/leaves/request', icon: PlusCircle },
      { label: 'Leaves', href: '/dashboard/leaves/approved', icon: CheckCircle2 },
    ],
  }

  const leaveManagementIndex = NAV.findIndex(i => i.label === 'Leave Management')
  let finalNav: NavItem[]
  if (isEmployee) {
    finalNav = [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'Leads',
        icon: TrendingUp,
        children: [
          { label: 'Add Lead', href: '/dashboard/leads/add', icon: PlusCircle },
          { label: 'Followup Leads', href: '/dashboard/leads/followup', icon: Phone },
        ],
      },
      {
        label: 'My Clients',
        icon: Users,
        href: '/dashboard/dc/client-dc',
      },
      {
        label: 'Payments',
        icon: CreditCard,
        children: [
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
        label: 'Employee Sample',
        icon: Package,
        href: '/dashboard/samples/request',
      },
      employeeLeavesMenu,
      { label: 'Sign out', icon: LogOut, href: '/auth/login' },
    ]
  } else if (isManager) {
    // For Manager role, only show: Dashboard, Clients, Warehouse, Expenses, Reports, Settings, Sign out
    const allowedMenuItems = ['Dashboard', 'Clients', 'Warehouse', 'Expenses', 'Reports', 'Settings', 'Sign out']
    finalNav = NAV.filter(item => allowedMenuItems.includes(item.label))
      .map(item => {
        // Filter Clients menu items to exclude "Create Sale"
        if (item.label === 'Clients' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label !== 'Create Sale'
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
    // For Senior Coordinator role, use the same menu as Coordinator
    // Only show: Dashboard, Clients, Users / Employees, Trainings & Services, Warehouse, Payments, Reports, Settings, Sign out
    const allowedMenuItems = ['Dashboard', 'Clients', 'Users / Employees', 'Trainings & Services', 'Warehouse', 'Payments', 'Reports', 'Settings', 'Sign out']
    finalNav = NAV.filter(item => allowedMenuItems.includes(item.label))
      .map(item => {
        // Filter Users / Employees menu items to only show "Active Employees" for Senior Coordinator
        if (item.label === 'Users / Employees' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label === 'Active Employees'
            )
          }
        }
        // Filter Trainings & Services menu items to exclude "Add Trainer" for Senior Coordinator
        if (item.label === 'Trainings & Services' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label !== 'Add Trainer'
            )
          }
        }
        // Filter Warehouse menu items to only show "DC @ Warehouse" and "Completed DC" for Senior Coordinator
        if (item.label === 'Warehouse' && item.children) {
          const allowedWarehouseItems = ['DC @ Warehouse', 'Completed DC']
          return {
            ...item,
            children: item.children.filter(child => 
              allowedWarehouseItems.includes(child.label)
            )
          }
        }
        // Filter Payments menu items to exclude "Add Payment" and "HOLD Payments" for Senior Coordinator
        if (item.label === 'Payments' && item.children) {
          return {
            ...item,
            children: item.children.filter(child => 
              child.label !== 'Add Payment' && child.label !== 'HOLD Payments'
            )
          }
        }
        // Filter Reports menu items to only show: Leads, DC, Returns, All Expenses for Senior Coordinator
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
  } else if (isExecutiveManager) {
    // For Executive Manager role, show Dashboard and Executive Manager menu
    // Get the manager's own ID from user data (we'll need to store it in auth)
    finalNav = [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      {
        label: 'My Dashboard',
        icon: LayoutDashboard,
        href: `/dashboard/executive-managers/${user?._id || ''}/dashboard`,
      },
      {
        label: 'Leave Management',
        icon: CalendarCheck2,
        href: `/dashboard/executive-managers/${user?._id || ''}/leaves`,
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
  } else {
    // For all other roles (Admin, Super Admin, etc.), show all menu items except "DC listed" (only for Manager and Coordinator)
    finalNav = NAV.map(item => {
      // Filter Warehouse menu items to exclude "DC listed" for roles other than Manager and Coordinator
      if (item.label === 'Warehouse' && item.children) {
        return {
          ...item,
          children: item.children.filter(child => 
            child.label !== 'DC listed'
          )
        }
      }
      return item
    })
  }

  // Auto-expand menu sections based on current route
  useEffect(() => {
    if (!pathname) return

    setOpen((currentOpen) => {
      const newOpenState = { ...currentOpen }
      let shouldUpdate = false

      // Check which menu section contains the current path (use finalNav to handle employee vs admin menus)
      finalNav.forEach((item) => {
        if (item.children) {
          const hasActiveChild = item.children.some((child) => {
            if (pathname === child.href) return true
            // Also check if pathname starts with child.href (for nested routes)
            if (child.href !== '/dashboard' && pathname.startsWith(child.href)) return true
            return false
          })
          
          if (hasActiveChild && !newOpenState[item.label]) {
            newOpenState[item.label] = true
            shouldUpdate = true
          }
        }
      })

      if (shouldUpdate && typeof window !== 'undefined') {
        localStorage.setItem('sidebarOpenState', JSON.stringify(newOpenState))
      }

      return shouldUpdate ? newOpenState : currentOpen
    })
  }, [pathname, isEmployee, isManager, isCoordinator, isSeniorCoordinator])

  const signOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
    }
    router.push('/auth/login')
  }

  const toggle = (label: string) => {
    setOpen((o) => {
      const newState = { ...o, [label]: !o[label] }
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarOpenState', JSON.stringify(newState))
      }
      return newState
    })
  }

  const toggleSidebar = () => {
    const newState = !sidebarOpen
    setSidebarOpen(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(!newState))
      // Dispatch custom event to notify TopBar
      window.dispatchEvent(new CustomEvent('sidebarToggle'))
      // Update main content margin
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        mainContent.style.marginLeft = newState ? '256px' : '64px'
      }
    }
  }

  // Update main content margin on mount and when sidebar state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        mainContent.style.marginLeft = sidebarOpen ? '256px' : '64px'
      }
    }
  }, [sidebarOpen])

  return (
    <>
      {/* Sidebar - Premium Linear-style design */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-[#0F0F0F] text-white min-h-screen fixed md:sticky top-0 left-0 z-50 border-r border-white/5 transition-all duration-300 ease-out relative backdrop-blur-xl`}>
        {/* User Profile Section - Premium styling */}
        <div className={`py-5 border-b border-white/5 ${sidebarOpen ? 'px-4' : 'px-0'} hidden md:block`}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ring-1 ring-white/10">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate text-white/90">{user?.name || 'User'}</div>
                <div className="text-xs text-white/50 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-sm shadow-emerald-500/50"></span>
                  <span className="font-normal">Active</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-sm font-semibold text-white ring-1 ring-white/10">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}
        </div>
        
        {/* Main Navigation Header with Hamburger - Minimal */}
        <div className={`py-3.5 border-b border-white/5 hidden md:flex items-center ${sidebarOpen ? 'px-4 justify-between' : 'px-0 justify-center'} relative`}>
          {sidebarOpen && (
            <div className="text-[10px] tracking-widest text-white/40 font-medium uppercase">Navigation</div>
          )}
          {/* Hamburger button - Premium styling */}
          <button
            onClick={toggleSidebar}
            className={`bg-transparent text-white/60 p-1.5 rounded-md hover:bg-white/5 hover:text-white transition-all duration-200 flex-shrink-0 ${sidebarOpen ? '' : 'absolute top-1/2 -translate-y-1/2'}`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      <nav className="py-2">
        <ul className="flex md:block gap-0 overflow-x-auto scrollbar-hide">
          {finalNav.map((item) => (
            <li key={item.label} className="w-full" data-item={item.label}>
              {item.children ? (
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
                    className={`w-full flex items-center justify-center text-white/70 py-2.5 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-all duration-200 group ${
                      sidebarOpen ? 'px-3 gap-2.5 justify-start' : 'px-0'
                    }`}
                    title={!sidebarOpen ? item.label : ''}
                  >
                    {item.icon && <item.icon size={18} className="text-white/60 group-hover:text-white flex-shrink-0 transition-colors" />}
                    {sidebarOpen && (
                      <span className="text-[13px] text-white/70 group-hover:text-white transition-colors">{item.label}</span>
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
                    <div className={`overflow-hidden transition-all duration-300 ease-out ${open[item.label] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <ul className="ml-6 mt-1 mb-2 space-y-0.5 border-l border-white/5 pl-3">
                        {item.children.map((c) => {
                          const isActive = pathname === c.href || (c.href !== '/dashboard' && pathname.startsWith(c.href))
                          return (
                            <li key={c.label}>
                              <Link 
                                href={c.href} 
                                className={`flex items-center gap-2.5 text-[12.5px] px-2.5 py-2 rounded-md font-normal transition-all duration-200 ${
                                  isActive 
                                    ? 'bg-white/10 text-white border-l-2 border-white/30' 
                                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                }`}
                              >
                                {c.icon && <c.icon size={14} className="flex-shrink-0" />}
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
                      {item.icon && <item.icon size={18} className="text-red-400/60 group-hover:text-red-400 flex-shrink-0 transition-colors" />}
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
                      className={`w-full flex items-center justify-center text-white/70 py-2.5 rounded-lg font-medium transition-all duration-200 group ${
                        sidebarOpen ? 'px-3 gap-2.5 justify-start' : 'px-0'
                      } ${
                        pathname === item.href 
                          ? 'bg-white/10 text-white shadow-sm' 
                          : 'hover:bg-white/5 hover:text-white'
                      }`}
                      title={!sidebarOpen ? item.label : ''}
                    >
                      {item.icon && <item.icon size={18} className={`flex-shrink-0 transition-colors ${
                        pathname === item.href ? 'text-white' : 'text-white/60 group-hover:text-white'
                      }`} />}
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


