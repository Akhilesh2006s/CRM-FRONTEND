'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, RefreshCw, Phone } from 'lucide-react'

export default function AddLeadPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Lead</h1>
        <p className="text-sm text-neutral-600 mt-1">Select the type of lead you want to add</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* New School Button */}
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500" onClick={() => router.push('/dashboard/leads/add/new-school')}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">New School</h3>
              <p className="text-sm text-neutral-600 mt-1">Add a new school lead</p>
            </div>
            <Button className="w-full">Add New School</Button>
          </div>
        </Card>

        {/* Renewal Cross Sale Button */}
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500" onClick={() => router.push('/dashboard/leads/add/renewal')}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Renewal Cross Sale</h3>
              <p className="text-sm text-neutral-600 mt-1">Add renewal or cross-sale lead for existing schools</p>
            </div>
            <Button className="w-full" variant="outline">Add Renewal</Button>
          </div>
        </Card>

        {/* Followup Leads Button */}
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-500" onClick={() => router.push('/dashboard/leads/followup')}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <Phone className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Followup Leads</h3>
              <p className="text-sm text-neutral-600 mt-1">View your followup leads</p>
            </div>
            <Button className="w-full" variant="outline">View Followup Leads</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}


