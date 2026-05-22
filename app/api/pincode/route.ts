import { NextRequest, NextResponse } from 'next/server'

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
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: 'Pincode service unavailable' },
        { status: 502 },
      )
    }

    const data = (await res.json()) as IndiaPostResponse
    const block = data?.[0]

    if (
      block?.Status !== 'Success' ||
      !block.PostOffice ||
      block.PostOffice.length === 0
    ) {
      return NextResponse.json(
        { success: false, message: 'Pincode not found' },
        { status: 404 },
      )
    }

    const first = block.PostOffice[0]
    return NextResponse.json({
      success: true,
      pincode,
      town: first.Name,
      district: first.District,
      state: first.State,
      region: first.Division || first.Region || first.District,
      postOffices: block.PostOffice.map((po) => ({
        Name: po.Name,
        District: po.District,
        State: po.State,
        Division: po.Division,
        Region: po.Region,
        Block: po.Block,
        BranchType: po.BranchType,
      })),
    })
  } catch (err) {
    console.error('[api/pincode]', err)
    return NextResponse.json(
      { success: false, message: 'Pincode lookup failed' },
      { status: 503 },
    )
  }
}
