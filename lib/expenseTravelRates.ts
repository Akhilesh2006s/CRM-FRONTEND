/** Per-km reimbursement rates for Bike / Car travel expenses */
export const BIKE_RATE_PER_KM = 2.8
export const CAR_RATE_PER_KM = 8

export function isPerKmTravelMode(mode: string): boolean {
  return mode === 'Bike' || mode === 'Car'
}

export function calcTravelAmount(mode: string, kms: number): string {
  if (!isPerKmTravelMode(mode) || kms <= 0) return ''
  const rate = mode === 'Bike' ? BIKE_RATE_PER_KM : CAR_RATE_PER_KM
  return (kms * rate).toFixed(2)
}

/** Bike/Car amounts are auto-calculated from km and must not be edited manually */
export function isTravelAmountLocked(category: string, transportType: string): boolean {
  return category === 'travel' && isPerKmTravelMode(transportType)
}

export function perKmRateLabel(mode: string): string {
  if (mode === 'Bike') return `₹${BIKE_RATE_PER_KM}/km`
  if (mode === 'Car') return `₹${CAR_RATE_PER_KM}/km`
  return ''
}
