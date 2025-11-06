'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileText, TrendingUp, CheckCircle2 } from 'lucide-react'

export default function ReportsLeadsPage() {
  const reportTypes = [
    {
      title: 'Open Leads',
      description: 'View all pending and processing leads',
      href: '/dashboard/reports/leads/open-leads',
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      title: 'Follow-up Leads',
      description: 'Leads requiring follow-up or saved for later',
      href: '/dashboard/reports/leads/follow-up-leads',
      icon: TrendingUp,
      color: 'bg-amber-500',
    },
    {
      title: 'Closed Leads',
      description: 'View all successfully closed leads',
      href: '/dashboard/reports/leads/closed-leads',
      icon: CheckCircle2,
      color: 'bg-green-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">Leads Reports</h1>
        <p className="text-slate-600">Select a report type to view detailed lead information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.href} className="p-6 hover:shadow-lg transition-shadow border-slate-200">
              <div className="flex flex-col items-start space-y-4">
                <div className={`${report.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{report.title}</h3>
                  <p className="text-sm text-slate-600">{report.description}</p>
                </div>
                <Link href={report.href} className="w-full">
                  <Button className="w-full bg-slate-700 hover:bg-slate-800 text-white shadow-sm">
                    View Report
                  </Button>
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}


