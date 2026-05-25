/** Delivery + transport fields aligned with DcOrder / My Clients Edit PO. */
export type SampleDeliveryFields = {
  property_number: string
  floor: string
  tower_block: string
  nearby_landmark: string
  area: string
  city: string
  pincode: string
  transport_name: string
  transport_location: string
  transportation_landmark: string
}

export const emptySampleDelivery = (): SampleDeliveryFields => ({
  property_number: '',
  floor: '',
  tower_block: '',
  nearby_landmark: '',
  area: '',
  city: '',
  pincode: '',
  transport_name: '',
  transport_location: '',
  transportation_landmark: '',
})

export type SampleProductLine = {
  product: string
  class: string
  productCategory?: string
  specs: string
  quantity: number
  strength: number
  level: string
}

export type SampleSchoolOption = {
  dcOrderId: string
  school_name: string
  contact_person?: string
  contact_mobile?: string
  address?: string
  location?: string
  zone?: string
}

export function formatSampleDeliveryAddress(d: Partial<SampleDeliveryFields> & { address?: string }) {
  const parts = [
    d.property_number,
    d.floor,
    d.tower_block,
    d.nearby_landmark,
    d.area,
    d.city,
    d.address,
    d.pincode,
  ]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean)
  return parts.join(', ') || 'N/A'
}

export function validateSampleDelivery(d: SampleDeliveryFields): string | null {
  if (!d.transport_name?.trim() || !d.transport_location?.trim() || !d.pincode?.trim()) {
    return 'Transport name, transport location, and pincode are required'
  }
  if (!d.area?.trim() && !d.city?.trim()) {
    return 'Delivery area or city is required'
  }
  return null
}
