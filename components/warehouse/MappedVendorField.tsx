'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  mappedVendorName,
  vendorsForProduct,
  type AssignedVendor,
} from '@/lib/vendorProductAssignment'

export function MappedVendorField({
  productName,
  vendor,
  onVendorChange,
  vendorMap,
  fallbackVendors,
  required,
}: {
  productName: string
  vendor: string
  onVendorChange: (value: string) => void
  vendorMap: Map<string, AssignedVendor[]>
  fallbackVendors: string[]
  required?: boolean
}) {
  const assigned = vendorsForProduct(productName, vendorMap)
  const mapped = mappedVendorName(productName, vendorMap, vendor)
  const locked = assigned.length === 1
  const value = vendor || mapped
  const options = assigned.length ? assigned.map((v) => v.name) : fallbackVendors

  if (!productName) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{required ? 'Vendor *' : 'Vendor'}</div>
        <Input value="" placeholder="Select Product first" disabled className="bg-neutral-50" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{required ? 'Vendor *' : 'Vendor'}</div>
        <Input value={value} readOnly className="bg-neutral-50" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{required ? 'Vendor *' : 'Vendor'}</div>
      <Select value={value || undefined} onValueChange={onVendorChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select Vendor" />
        </SelectTrigger>
        <SelectContent>
          {options.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
