export type DcOrderTransportSource = {
  transport_name?: string
  transport_location?: string
  pincode?: string
  pendingEdit?: {
    transport_name?: string
    transport_location?: string
    pincode?: string
    status?: string
  }
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

/** Resolve transport fields from DcOrder, honoring a pending Edit PO snapshot. */
export function resolveTransportFields(order: DcOrderTransportSource | null | undefined) {
  const pe = order?.pendingEdit?.status === 'pending' ? order.pendingEdit : null
  return {
    transport_name: (pe?.transport_name ?? order?.transport_name ?? '').trim(),
    transport_location: (pe?.transport_location ?? order?.transport_location ?? '').trim(),
    pincode: (pe?.pincode ?? order?.pincode ?? '').trim(),
  }
}

/** Required for Request DC / Closed Sales: name, location, pincode. */
export function isTransportComplete(order: DcOrderTransportSource | null | undefined): boolean {
  const { transport_name, transport_location, pincode } = resolveTransportFields(order)
  return nonEmpty(transport_name) && nonEmpty(transport_location) && nonEmpty(pincode)
}
