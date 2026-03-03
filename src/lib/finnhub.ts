// ============================================================
// GRZLY — Finnhub Integration
// Docs: https://finnhub.io/docs/api
// Plan: Free tier (60 calls/min) — sufficient for MVP
//
// Used for:
//   1. News headlines on Drop detail pages
//   2. Company profile lookup (sector, industry, market cap)
// ============================================================

const BASE_URL = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

// ─── Types ───────────────────────────────────────────────────

export interface FinnhubNewsArticle {
  id: number
  category: string
  datetime: number         // unix timestamp
  headline: string
  image: string
  related: string          // ticker(s)
  source: string
  summary: string
  url: string
}

export interface CompanyNews {
  headline: string
  source: string
  url: string
  published_at: string     // ISO string
  summary: string | null
}

export interface CompanyProfile {
  name: string
  ticker: string
  exchange: string
  industry: string
  sector: string
  market_cap: number | null        // in millions USD
  shares_outstanding: number | null
  logo: string | null
  weburl: string | null
}

// ─── Fetch helpers ───────────────────────────────────────────

async function finnhubGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('token', API_KEY)
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val)
  }

  try {
    const res = await fetch(url.toString(), {
      // Cache news for 30 minutes — aggressive caching to stay within free tier limits
      next: { revalidate: 1800 },
    })

    if (res.status === 429) {
      console.warn('[Finnhub] Rate limit hit — returning null')
      return null
    }

    if (!res.ok) {
      console.error(`[Finnhub] ${path} returned ${res.status} ${res.statusText}`)
      return null
    }

    return await res.json() as T
  } catch (err) {
    console.error(`[Finnhub] Network error on ${path}:`, err)
    return null
  }
}

// ─── Company News ─────────────────────────────────────────────

/**
 * Fetch recent news headlines for a ticker.
 * Returns the most recent `limit` articles from the past `days` days.
 * Used on the Drop detail page news section.
 */
export async function getCompanyNews(
  ticker: string,
  options: { days?: number; limit?: number } = {}
): Promise<CompanyNews[]> {
  const { days = 7, limit = 5 } = options

  const to = new Date()
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  const articles = await finnhubGet<FinnhubNewsArticle[]>('/company-news', {
    symbol: ticker,
    from: fromStr,
    to: toStr,
  })

  if (!articles || articles.length === 0) return []

  // Sort by newest first, deduplicate by headline, take limit
  const seen = new Set<string>()
  return articles
    .sort((a, b) => b.datetime - a.datetime)
    .filter(article => {
      if (seen.has(article.headline)) return false
      seen.add(article.headline)
      return true
    })
    .slice(0, limit)
    .map(article => ({
      headline: article.headline,
      source: article.source,
      url: article.url,
      published_at: new Date(article.datetime * 1000).toISOString(),
      summary: article.summary || null,
    }))
}

// ─── Company Profile ──────────────────────────────────────────

/**
 * Fetch company profile: name, sector, industry, market cap.
 * Cached aggressively (24h) since it rarely changes.
 * Used during Drop creation to show company context.
 */
export async function getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  interface FinnhubProfile {
    name: string
    ticker: string
    exchange: string
    finnhubIndustry: string
    ipo: string
    logo: string
    marketCapitalization: number
    shareOutstanding: number
    weburl: string
  }

  const profile = await finnhubGet<FinnhubProfile>('/stock/profile2', { symbol: ticker })
  if (!profile || !profile.name) return null

  return {
    name: profile.name,
    ticker: profile.ticker ?? ticker,
    exchange: profile.exchange ?? '',
    industry: profile.finnhubIndustry ?? '',
    sector: '',   // Finnhub free tier doesn't return sector separately
    market_cap: profile.marketCapitalization ?? null,
    shares_outstanding: profile.shareOutstanding ?? null,
    logo: profile.logo || null,
    weburl: profile.weburl || null,
  }
}

// ─── Basic Financials (for evidence context) ──────────────────

export interface BasicFinancials {
  pe_ratio: number | null
  pb_ratio: number | null
  ps_ratio: number | null
  eps_ttm: number | null
  revenue_growth_yoy: number | null      // e.g. 0.12 = 12% growth
  gross_margin: number | null            // e.g. 0.45 = 45%
  debt_to_equity: number | null
  current_ratio: number | null
  week_52_high: number | null
  week_52_low: number | null
}

/**
 * Fetch basic valuation and financial metrics for a ticker.
 * Shown on Drop detail pages as supporting evidence context.
 * Helps voters evaluate whether the thesis holds numerically.
 */
export async function getBasicFinancials(ticker: string): Promise<BasicFinancials> {
  interface FinnhubBasicFinancials {
    metric: {
      peBasicExclExtraTTM?: number
      pbAnnual?: number
      psAnnual?: number
      epsBasicExclExtraAnnual?: number
      revenueGrowthTTMYoy?: number
      grossMarginTTM?: number
      totalDebt_totalEquityAnnual?: number
      currentRatioAnnual?: number
      '52WeekHigh'?: number
      '52WeekLow'?: number
    }
  }

  const data = await finnhubGet<FinnhubBasicFinancials>('/stock/metric', {
    symbol: ticker,
    metric: 'all',
  })

  if (!data?.metric) {
    return {
      pe_ratio: null, pb_ratio: null, ps_ratio: null, eps_ttm: null,
      revenue_growth_yoy: null, gross_margin: null, debt_to_equity: null,
      current_ratio: null, week_52_high: null, week_52_low: null,
    }
  }

  const m = data.metric
  return {
    pe_ratio: m.peBasicExclExtraTTM ?? null,
    pb_ratio: m.pbAnnual ?? null,
    ps_ratio: m.psAnnual ?? null,
    eps_ttm: m.epsBasicExclExtraAnnual ?? null,
    revenue_growth_yoy: m.revenueGrowthTTMYoy ?? null,
    gross_margin: m.grossMarginTTM ?? null,
    debt_to_equity: m.totalDebt_totalEquityAnnual ?? null,
    current_ratio: m.currentRatioAnnual ?? null,
    week_52_high: m['52WeekHigh'] ?? null,
    week_52_low: m['52WeekLow'] ?? null,
  }
}

// ─── Convenience: all context for a Drop detail page ─────────

export interface DropMarketContext {
  news: CompanyNews[]
  financials: BasicFinancials
  profile: CompanyProfile | null
}

/**
 * Fetch all Finnhub data needed for a Drop detail page in parallel.
 * Single function so we can await once and get everything.
 */
export async function getDropMarketContext(ticker: string): Promise<DropMarketContext> {
  const [news, financials, profile] = await Promise.all([
    getCompanyNews(ticker, { days: 14, limit: 5 }),
    getBasicFinancials(ticker),
    getCompanyProfile(ticker),
  ])

  return { news, financials, profile }
}
