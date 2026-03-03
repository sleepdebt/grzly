// GET /api/tickers/validate?ticker=TSLA
// Called live from the Drop creation form on ticker input
// Validates against Polygon.io and returns company name

import { NextRequest, NextResponse } from 'next/server'
import { validateTicker } from '@/lib/polygon'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json({ error: 'ticker param is required' }, { status: 400 })
  }

  if (!/^[A-Z]{1,5}$/.test(ticker)) {
    return NextResponse.json({ valid: false, error: 'Ticker must be 1–5 letters' }, { status: 200 })
  }

  const result = await validateTicker(ticker)

  return NextResponse.json(result, {
    // Cache for 24 hours — tickers don't change often
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
  })
}
