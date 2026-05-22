import { apiRequest } from '@/lib/api'

export type PostOfficeArea = {
  name: string
  district: string
  block?: string
  branchType?: string
}

export type PincodeLookupResult = {
  success: boolean
  town?: string
  district?: string
  state?: string
  region?: string
  postOffices?: PostOfficeArea[]
  message?: string
}

type BackendGetTown = {
  success?: boolean
  town?: string
  district?: string
  state?: string
  region?: string
  message?: string
  postOffices?: Array<{
    Name: string
    District: string
    State: string
    Division?: string
    Region?: string
    Block?: string
    BranchType?: string
  }>
}

type IndiaPostResponse = Array<{
  Status: string
  PostOffice?: Array<{
    Name: string
    District: string
    State: string
    Division?: string
    Region?: string
    Block?: string
    BranchType?: string
  }>
}>

function mapPostOffices(
  postOffices: NonNullable<IndiaPostResponse[0]['PostOffice']>,
): PostOfficeArea[] {
  return postOffices.map((po) => ({
    name: po.Name,
    district: po.District,
    block: po.Block,
    branchType: po.BranchType,
  }))
}

function fromBackend(data: BackendGetTown): PincodeLookupResult {
  if (!data.success || !data.town) {
    return {
      success: false,
      message: data.message || 'Pincode not found. Enter state, district, and area manually.',
    }
  }

  const postOffices =
    data.postOffices && data.postOffices.length > 0
      ? data.postOffices.map((po) => ({
          name: po.Name,
          district: po.District,
          block: po.Block,
          branchType: po.BranchType,
        }))
      : [{ name: data.town, district: data.district || '' }]

  return {
    success: true,
    town: data.town,
    district: data.district,
    state: data.state,
    region: data.region,
    postOffices,
  }
}

async function lookupPincodeViaNextProxy(
  pincode: string,
): Promise<PincodeLookupResult> {
  const res = await fetch(`/api/pincode?pincode=${pincode}`, { cache: 'no-store' })
  const data = (await res.json()) as BackendGetTown
  if (res.ok && data.success && data.town) {
    return fromBackend(data)
  }
  return {
    success: false,
    message:
      (data as { message?: string }).message ||
      'Pincode not found. Enter location manually.',
  }
}

export async function lookupPincode(pincode: string): Promise<PincodeLookupResult> {
  const code = pincode.replace(/\D/g, '').slice(0, 6)
  if (code.length !== 6) {
    return { success: false, message: 'Enter a 6-digit pincode.' }
  }

  try {
    const proxied = await lookupPincodeViaNextProxy(code)
    if (proxied.success) return proxied
  } catch {
    // fall through
  }

  try {
    const data = await apiRequest<BackendGetTown>(
      `/location/get-town?pincode=${code}`,
    )
    if (data.success && data.town) {
      return fromBackend(data)
    }
  } catch {
    // fall through
  }

  return {
    success: false,
    message:
      'Pincode lookup failed. Enter state, district, and area manually, or redeploy the latest frontend.',
  }
}
