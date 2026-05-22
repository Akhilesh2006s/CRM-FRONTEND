'use client'

import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export type BreadcrumbSegment = {
  label: string
  href?: string
}

type ModulePageShellProps = {
  title: string
  breadcrumbs: BreadcrumbSegment[]
  actions?: React.ReactNode
  children: React.ReactNode
}

export function ModulePageShell({
  title,
  breadcrumbs,
  actions,
  children,
}: ModulePageShellProps) {
  return (
    <div className="flex flex-col min-h-0 flex-1 gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((segment, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <span key={`${segment.label}-${index}`} className="contents">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {isLast || !segment.href ? (
                    <BreadcrumbPage className={isLast ? 'font-medium text-neutral-900' : ''}>
                      {segment.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={segment.href}>{segment.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{title}</h1>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4">{children}</div>
    </div>
  )
}
