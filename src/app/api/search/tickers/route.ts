// GET /api/search/tickers?q=<query>
// Proxies Finnhub symbol search — used by feed search to resolve company name → ticker

import { NextRequest, NextResponse } from 'next/server'

interface FinnhubSearchResult {
  description: string
  displaySymbol: string
  symbol: string
  type: string
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json({ results: [] })

  const url = new URL('https://finnhub.io/api/v1/search')
  url.searchParams.set('q', q)
  url.searchParams.set('token', process.env.FINNHUB_API_KEY ?? '')

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } })
    if (!res.ok) return NextResponse.json({ results: [] })

    const data: { result?: FinnhubSearchResult[] } = await res.json()

    // US common stocks only (no dots = no ADRs like BRK.A), capped at 8
    const results = (data.result ?? [])
      .filter(r => r.type === 'Common Stock' && !r.symbol.includes('.'))
      .slice(0, 8)
      .map(r => ({ symbol: r.symbol, description: r.description }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
