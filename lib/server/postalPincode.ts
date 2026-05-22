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

export type PostalPincodePayload = {
  success: true
  pincode: string
  town: string
  district: string
  state: string
  region: string
  postOffices: PostalPostOffice[]
}

const PINCODE_HOST = 'api.postalpincode.in'
const TIMEOUT_MS = 15000

export function fetchPostalPincodeData(
  pincode: string,
): Promise<IndiaPostResponse> {
  const path = `/pincode/${pincode}`

  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: PINCODE_HOST,
        path,
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'CRM-FORGE/1.0' },
        rejectUnauthorized: false,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as IndiaPostResponse)
          } catch (e) {
            reject(e)
          }
        })
      },
    )

    req.on('error', reject)
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error('Pincode API request timed out'))
    })
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
