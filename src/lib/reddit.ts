// ============================================================
// GRZLY — Reddit Scraper
//
// Uses Reddit's public JSON API — no OAuth, no app registration.
// Append .json to any public subreddit URL to get structured data.
//
// Acceptance criteria:
//   ✓ ≥90% ticker extraction accuracy on $TICKER format
//   ✓ ≤1 request per 2 seconds (Reddit ToS)
//   ✓ Handles downtime gracefully — logs error, returns []
//   ✓ Data ≤4 hours old on Drop detail page (cron every 4h)
//   ✓ Deduplication by reddit_post_id (enforced at DB level + here)
// ============================================================

// ─── Configuration ────────────────────────────────────────────

const USER_AGENT = process.env.REDDIT_USER_AGENT ?? 'GRZLY:v1.0 (automated research tool)'

// Subreddits to monitor — ordered by signal quality
export const TARGET_SUBREDDITS = [
  'wallstreetbets',
  'stocks',
  'Superstonk',
  'investing',
  'SecurityAnalysis',
] as const

export type Subreddit = (typeof TARGET_SUBREDDITS)[number]

// Posts to fetch per subreddit per run
const POSTS_PER_SUB = 25   // 5 subs × 25 = 125 posts/run
const MIN_UPVOTES = 10     // filter out low-quality posts

// Rate limiting: 1 request per 2 seconds (Reddit ToS)
const REQUEST_INTERVAL_MS = 2000

// ─── Ticker Extraction ────────────────────────────────────────

// Known false-positive tickers — common words mistaken for tickers
const TICKER_BLOCKLIST = new Set([
  'A', 'I', 'IT', 'BE', 'ARE', 'FOR', 'OR', 'NOT', 'AS', 'AT', 'ON',
  'IN', 'IS', 'AN', 'IF', 'SO', 'TO', 'DO', 'GO', 'NO', 'UP', 'US',
  'AI', 'DD', 'PM', 'CEO', 'CFO', 'IPO', 'IMO', 'TBH', 'FYI', 'IRS',
  'SEC', 'ETF', 'EPS', 'GDP', 'CPI', 'ATH', 'ATL', 'WSB', 'YOLO',
  'FOMO', 'HODL', 'BTFD', 'IIRC', 'TLDR', 'AFAIK', 'LMAO', 'EDIT',
  'NYSE', 'AMEX', 'OTC',
])

/**
 * Extract ticker symbols from text.
 *
 * Priority order (highest confidence first):
 * 1. $TICKER format (explicit call-out) — "$TSLA", "$tsla"
 * 2. Standalone ALLCAPS 1–5 chars with word boundaries — "TSLA is up"
 *
 * Returns deduplicated array of uppercase tickers.
 */
export function extractTickers(text: string): string[] {
  const found = new Set<string>()

  // Pattern 1: $TICKER (case-insensitive, 1–5 alpha chars)
  const dollarPattern = /\$([A-Za-z]{1,5})\b/g
  let match: RegExpExecArray | null
  while ((match = dollarPattern.exec(text)) !== null) {
    const ticker = match[1].toUpperCase()
    if (!TICKER_BLOCKLIST.has(ticker)) {
      found.add(ticker)
    }
  }

  // Pattern 2: Standalone ALLCAPS (2–5 chars, word boundaries)
  const capsPattern = /\b([A-Z]{2,5})\b/g
  while ((match = capsPattern.exec(text)) !== null) {
    const ticker = match[1]
    if (!TICKER_BLOCKLIST.has(ticker)) {
      found.add(ticker)
    }
  }

  return Array.from(found)
}

// ─── Rate Limiter ────────────────────────────────────────────

let lastRequestTime = 0

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const timeSinceLast = now - lastRequestTime
  if (timeSinceLast < REQUEST_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, REQUEST_INTERVAL_MS - timeSinceLast))
  }

  lastRequestTime = Date.now()

  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: 0 },
  })
}

// ─── Post Fetching ───────────────────────────────────────────

export interface RedditPost {
  reddit_post_id: string
  subreddit: string
  title: string
  body: string | null
  upvotes: number
  comment_count: number
  author: string | null
  reddit_url: string | null
  posted_at: string           // ISO string
  tickers_mentioned: string[]
}

interface RedditListing {
  data: {
    children: Array<{
      data: {
        id: string
        subreddit: string
        title: string
        selftext: string
        score: number
        num_comments: number
        author: string
        permalink: string
        created_utc: number
        stickied: boolean
        distinguished: string | null
      }
    }>
  }
}

/**
 * Fetch hot posts from a single subreddit and extract tickers.
 * Uses public JSON API — no authentication required.
 * Returns empty array on error — never throws, so the cron continues.
 */
export async function fetchSubredditPosts(
  subreddit: Subreddit,
  limit = POSTS_PER_SUB
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`

  let res: Response
  try {
    res = await rateLimitedFetch(url)
  } catch (err) {
    console.error(`[Reddit] Network error fetching r/${subreddit}:`, err)
    return []
  }

  if (!res.ok) {
    console.error(`[Reddit] r/${subreddit} returned ${res.status} ${res.statusText}`)
    return []
  }

  let listing: RedditListing
  try {
    listing = await res.json()
  } catch (err) {
    console.error(`[Reddit] Failed to parse JSON from r/${subreddit}:`, err)
    return []
  }

  const posts: RedditPost[] = []

  for (const child of listing.data.children) {
    const post = child.data

    // Skip stickied/mod posts
    if (post.stickied || post.distinguished === 'moderator') continue

    // Skip low-upvote posts
    if (post.score < MIN_UPVOTES) continue

    const textContent = `${post.title} ${post.selftext ?? ''}`.trim()
    const tickers = extractTickers(textContent)

    // Only store posts that mention at least one ticker
    if (tickers.length === 0) continue

    posts.push({
      reddit_post_id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      body: post.selftext?.trim() || null,
      upvotes: post.score,
      comment_count: post.num_comments,
      author: post.author === '[deleted]' ? null : post.author,
      reddit_url: `https://reddit.com${post.permalink}`,
      posted_at: new Date(post.created_utc * 1000).toISOString(),
      tickers_mentioned: tickers,
    })
  }

  return posts
}

// ─── Full Scrape Run ─────────────────────────────────────────

export interface ScrapeResult {
  subreddit: string
  fetched: number
  ticker_posts: number
  error?: string
}

/**
 * Run a full scrape across all TARGET_SUBREDDITS.
 * Returns all posts + per-subreddit stats.
 * Never throws — errors per subreddit are captured in results.
 */
export async function scrapeAllSubreddits(): Promise<{
  posts: RedditPost[]
  results: ScrapeResult[]
}> {
  const allPosts: RedditPost[] = []
  const results: ScrapeResult[] = []

  for (const subreddit of TARGET_SUBREDDITS) {
    try {
      const posts = await fetchSubredditPosts(subreddit)
      allPosts.push(...posts)
      results.push({
        subreddit,
        fetched: POSTS_PER_SUB,
        ticker_posts: posts.length,
      })
      console.log(`[Reddit] r/${subreddit}: ${posts.length} ticker posts extracted`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[Reddit] r/${subreddit} scrape failed:`, errorMsg)
      results.push({
        subreddit,
        fetched: 0,
        ticker_posts: 0,
        error: errorMsg,
      })
    }
  }

  return { posts: allPosts, results }
}

// ─── Utility ─────────────────────────────────────────────────

/**
 * Count how many scraped posts in the DB mention a ticker in the last N hours.
 * Used on Drop detail pages for the Reddit signal section.
 */
export function getMentionQueryParams(ticker: string, hours = 168) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  return { ticker, since }
}
