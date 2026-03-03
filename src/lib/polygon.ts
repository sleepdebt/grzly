// ============================================================
// Polygon.io — Price Data
// Docs: https://polygon.io/docs/stocks
// Plan: Starter ($29/mo) — required for EOD closing prices
// ============================================================

const BASE_URL = 'https://api.polygon.io/v2'
const API_KEY = process.env.POLYGON_API_KEY!

interface PolygonClose {
  ticker: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  from: string  // date string YYYY-MM-DD
}

interface PolygonAggResult {
  c: number    // close
  h: number    // high
  l: number    // low
  o: number    // open
  v: number    // volume
  t: number    // timestamp (ms)
}

// Retry helper with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 0 }, // always fresh for price data
      })
      if (res.ok) return res
      if (res.status === 429 || res.status >= 500) {
        // Backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
        continue
      }
      throw new Error(`Polygon API error: ${res.status} ${res.statusText}`)
    } catch (err) {
      if (attempt === retries) throw err
    }
  }
  throw new Error('Polygon API: max retries exceeded')
}

/**
 * Get the most recent closing price for a ticker.
 * Used when creating a Drop to set baseline_price.
 */
export async function getLatestClose(ticker: string): Promise<number | null> {
  try {
    // Get previous close (most recent trading day)
    const url = `${BASE_URL}/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${API_KEY}`
    const res = await fetchWithRetry(url)
    const data = await res.json()

    if (data.resultsCount > 0 && data.results?.[0]) {
      return data.results[0].c as number
    }
    return null
  } catch (err) {
    console.error(`[Polygon] getLatestClose failed for ${ticker}:`, err)
    return null
  }
}

/**
 * Get closing price on a specific date.
 * Used for Drop resolution to get resolution_price.
 */
export async function getCloseOnDate(ticker: string, date: string): Promise<number | null> {
  try {
    // date format: YYYY-MM-DD
    const url = `${BASE_URL}/aggs/ticker/${ticker}/range/1/day/${date}/${date}?adjusted=true&apiKey=${API_KEY}`
    const res = await fetchWithRetry(url)
    const data = await res.json()

    if (data.resultsCount > 0 && data.results?.[0]) {
      return data.results[0].c as number
    }
    return null
  } catch (err) {
    console.error(`[Polygon] getCloseOnDate failed for ${ticker} on ${date}:`, err)
    return null
  }
}

/**
 * Get daily closing prices between two dates.
 * Used on Drop detail page to render the price chart.
 * Returns array of { date, price } sorted ascending.
 */
export async function getPriceHistory(
  ticker: string,
  from: string,  // YYYY-MM-DD
  to: string     // YYYY-MM-DD
): Promise<Array<{ date: string; price: number }>> {
  try {
    const url = `${BASE_URL}/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=365&apiKey=${API_KEY}`
    const res = await fetchWithRetry(url)
    const data = await res.json()

    if (!data.results) return []

    return (data.results as PolygonAggResult[]).map(r => ({
      date: new Date(r.t).toISOString().split('T')[0],
      price: r.c,
    }))
  } catch (err) {
    console.error(`[Polygon] getPriceHistory failed for ${ticker}:`, err)
    return []
  }
}

/**
 * Validate that a ticker exists on Polygon.
 * Used during Drop creation to validate the ticker symbol.
 */
export async function validateTicker(ticker: string): Promise<{ valid: boolean; companyName?: string }> {
  try {
    const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${API_KEY}`
    const res = await fetch(url, { next: { revalidate: 86400 } }) // cache for 24h

    if (!res.ok) return { valid: false }

    const data = await res.json()
    return {
      valid: true,
      companyName: data.results?.name,
    }
  } catch {
    return { valid: false }
  }
}
