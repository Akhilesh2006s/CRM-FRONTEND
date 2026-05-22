import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPostalPincodeData,
  parsePostalPincodeResponse,
} from '@/lib/server/postalPincode'

export async function GET(request: NextRequest) {
  const pincode = (request.nextUrl.searchParams.get('pincode') || '')
    .replace(/\D/g, '')
    .slice(0, 6)

  if (pincode.length !== 6) {
    return NextResponse.json(
      { success: false, message: 'Valid 6-digit pincode is required' },
      { status: 400 },
    )
  }

  try {
    const data = await fetchPostalPincodeData(pincode)
    const parsed = parsePostalPincodeResponse(pincode, data)

    if (!parsed.success) {
      return NextResponse.json(parsed, { status: 404 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[api/pincode]', err)
    return NextResponse.json(
      { success: false, message: 'Pincode lookup failed' },
      { status: 503 },
    )
  }
}
