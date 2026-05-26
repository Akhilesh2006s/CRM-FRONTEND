/** Per-km reimbursement rates for Bike / Car travel expenses */
export type TravelPerKmRates = {
  bikeRatePerKm: number
  carRatePerKm: number
}

export const DEFAULT_TRAVEL_PER_KM_RATES: TravelPerKmRates = {
  bikeRatePerKm: 2.8,
  carRatePerKm: 8,
}

/** @deprecated use DEFAULT_TRAVEL_PER_KM_RATES */
export const BIKE_RATE_PER_KM = DEFAULT_TRAVEL_PER_KM_RATES.bikeRatePerKm
/** @deprecated use DEFAULT_TRAVEL_PER_KM_RATES */
export const CAR_RATE_PER_KM = DEFAULT_TRAVEL_PER_KM_RATES.carRatePerKm

export function resolveTravelPerKmRates(rates?: Partial<TravelPerKmRates>): TravelPerKmRates {
  const bike = Number(rates?.bikeRatePerKm)
  const car = Number(rates?.carRatePerKm)
  return {
    bikeRatePerKm: bike > 0 ? bike : DEFAULT_TRAVEL_PER_KM_RATES.bikeRatePerKm,
    carRatePerKm: car > 0 ? car : DEFAULT_TRAVEL_PER_KM_RATES.carRatePerKm,
  }
}

export function isPerKmTravelMode(mode: string): boolean {
  return mode === 'Bike' || mode === 'Car'
}

export function calcTravelAmount(
  mode: string,
  kms: number,
  rates?: Partial<TravelPerKmRates>
): string {
  if (!isPerKmTravelMode(mode) || kms <= 0) return ''
  const r = resolveTravelPerKmRates(rates)
  const rate = mode === 'Bike' ? r.bikeRatePerKm : r.carRatePerKm
  return (kms * rate).toFixed(2)
}

/** Bike/Car amounts are auto-calculated from km and must not be edited manually */
export function isTravelAmountLocked(category: string, transportType: string): boolean {
  return category === 'travel' && isPerKmTravelMode(transportType)
}

export function perKmRateLabel(mode: string, rates?: Partial<TravelPerKmRates>): string {
  const r = resolveTravelPerKmRates(rates)
  if (mode === 'Bike') return `₹${r.bikeRatePerKm}/km`
  if (mode === 'Car') return `₹${r.carRatePerKm}/km`
  return ''
}
