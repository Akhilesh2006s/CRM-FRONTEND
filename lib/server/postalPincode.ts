import https from 'node:https'

export type PostalPostOffice = {
  Name: string
  District: string
  State: string
  Division?: string
  Region?: string
  Block?: string
  BranchType?: string
}

type IndiaPostResponse = Array<{
  Status: string
  PostOffice?: PostalPostOffice[]
}>

type FallbackOffice = {
  officeName?: string
  officeType?: string
  regionName?: string
  divisionName?: string
}

type FallbackResponse = {
  state?: string
  district?: string
  offices?: FallbackOffice[]
}

export type PostalPincodePayload = {
  success: true
  pincode: string
  town: string
  district: string
  state: string
  region: string
  postOffices: PostalPostOffice[]
}

const INDIA_POST_HOST = 'api.postalpincode.in'
const FALLBACK_HOST = 'aniket-thapa.github.io'
const TIMEOUT_MS = 15000

function fetchHttpsJson<T>(
  hostname: string,
  path: string,
  options?: { rejectUnauthorized?: boolean },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname,
        path,
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'CRM-FORGE/1.0' },
        rejectUnauthorized: options?.rejectUnauthorized ?? true,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} from ${hostname}${path}`))
            return
          }
          try {
            resolve(JSON.parse(body) as T)
          } catch (e) {
            reject(e)
          }
        })
      },
    )

    req.on('error', reject)
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`Pincode API request timed out (${hostname})`))
    })
  })
}

function titleCase(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * India Post public API — certificate is often expired; server-side only with relaxed TLS.
 * Do not call from the browser (ERR_CERT_DATE_INVALID).
 */
export function fetchPostalPincodeData(
  pincode: string,
): Promise<IndiaPostResponse> {
  return fetchHttpsJson<IndiaPostResponse>(INDIA_POST_HOST, `/pincode/${pincode}`, {
    rejectUnauthorized: false,
  })
}

export function parsePostalPincodeResponse(
  pincode: string,
  data: IndiaPostResponse,
): PostalPincodePayload | { success: false; message: string } {
  const block = data?.[0]
  if (
    block?.Status !== 'Success' ||
    !block.PostOffice ||
    block.PostOffice.length === 0
  ) {
    return { success: false, message: 'Pincode not found' }
  }

  const first = block.PostOffice[0]
  return {
    success: true,
    pincode,
    town: first.Name,
    district: first.District,
    state: first.State,
    region: first.Division || first.Region || first.District,
    postOffices: block.PostOffice,
  }
}

function parseFallbackResponse(
  pincode: string,
  data: FallbackResponse,
): PostalPincodePayload | { success: false; message: string } {
  const offices = Array.isArray(data?.offices) ? data.offices : []
  if (!data?.state || !data?.district || offices.length === 0) {
    return { success: false, message: 'Pincode not found' }
  }

  const state = titleCase(data.state)
  const district = titleCase(data.district)
  const postOffices: PostalPostOffice[] = offices.map((office) => ({
    Name: office.officeName || '',
    District: district,
    State: state,
    Division: office.divisionName || '',
    Region: office.regionName || district,
    Block: '',
    BranchType: office.officeType || '',
  }))

  const first = postOffices[0]
  return {
    success: true,
    pincode,
    town: first.Name,
    district,
    state,
    region: first.Region || first.Division || district,
    postOffices,
  }
}

async function fetchFallbackPincodeData(
  pincode: string,
): Promise<PostalPincodePayload | { success: false; message: string }> {
  const data = await fetchHttpsJson<FallbackResponse>(
    FALLBACK_HOST,
    `/india-pincode-api/pincodes/${pincode}.json`,
  )
  return parseFallbackResponse(pincode, data)
}

/** Try India Post first; on TLS/network failure use static open dataset. */
export async function lookupPostalPincode(
  pincode: string,
): Promise<PostalPincodePayload | { success: false; message: string }> {
  try {
    const data = await fetchPostalPincodeData(pincode)
    const parsed = parsePostalPincodeResponse(pincode, data)
    if (parsed.success) return parsed
  } catch (err) {
    console.warn(
      '[postalPincode] India Post failed, trying fallback:',
      err instanceof Error ? err.message : err,
    )
  }

  try {
    return await fetchFallbackPincodeData(pincode)
  } catch (err) {
    console.warn(
      '[postalPincode] Fallback failed:',
      err instanceof Error ? err.message : err,
    )
    return { success: false, message: 'Pincode lookup failed' }
  }
}
