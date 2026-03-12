// ============================================================
// GRZLY — TypeScript Types
// Derived from GRZLY_Schema.sql
// ============================================================

// ------------------------------------------------------------
// Enums (mirror the Postgres enums in the schema)
// ------------------------------------------------------------

export type DropStatus = 'active' | 'extended' | 'resolved' | 'archived'

export type DropOutcome = 'correct' | 'incorrect' | 'inconclusive'

export type VoteDirection = 'bearish' | 'skeptical'

export type SwayzeReason =
  | 'catalyst_delayed'
  | 'timing_off'
  | 'new_information'

export type LoreEventType =
  | 'creation'
  | 'conviction_surge'
  | 'extension'
  | 'resolution'

// ------------------------------------------------------------
// Database row types
// ------------------------------------------------------------

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null

  // Reputation
  drop_count: number
  resolved_drop_count: number
  correct_drop_count: number
  accuracy_score: number | null   // null until ≥3 resolved drops

  // Metadata
  is_anonymous_default: boolean
  is_grzly_created: boolean
  created_at: string
  updated_at: string
}

export interface Drop {
  id: string
  ticker: string
  company_name: string | null

  // Thesis content
  thesis: string
  evidence_links: string[] | null
  financial_metric: string | null
  creator_note: string | null

  // Attribution
  created_by: string | null
  is_anonymous: boolean

  // Lifecycle
  status: DropStatus
  time_horizon: string             // e.g. '30 days'
  created_at: string
  resolves_at: string
  extended_at: string | null
  extended_resolves_at: string | null
  swayze_reason: SwayzeReason | null
  resolved_at: string | null

  // Target price
  target_price: number | null

  // Pricing
  baseline_price: number | null
  resolution_price: number | null
  price_change_pct: number | null

  // Pack Sentiment (nightly AI score — see cron/pack-sentiment)
  pack_sentiment_score: number | null

  // Outcome
  outcome: DropOutcome | null
  was_extended: boolean
  accuracy_weight: number

  // Conviction (denormalized)
  bearish_votes: number
  skeptical_votes: number
  total_votes: number
  conviction_score: number | null   // accuracy-weighted % bearish
  raw_conviction_pct: number | null // unweighted % bearish

  // AI Lore
  lore_narrative: string | null
  bear_book_narrative: string | null
}

export interface Vote {
  id: string
  drop_id: string
  user_id: string
  direction: VoteDirection
  voter_accuracy_at_vote: number | null
  created_at: string
}

export interface LoreEvent {
  id: string
  drop_id: string
  event_type: LoreEventType
  narrative: string
  prompt_version: string | null
  model_used: string | null
  created_at: string
}

export interface RedditPost {
  id: string
  reddit_post_id: string
  subreddit: string
  title: string
  body: string | null
  upvotes: number
  comment_count: number
  author: string | null
  reddit_url: string | null
  posted_at: string
  tickers_mentioned: string[] | null
  scraped_at: string
}

export interface PriceSnapshot {
  id: string
  ticker: string
  price: number
  snapshot_date: string
  source: string
  recorded_at: string
}

export interface ShortInterest {
  id: string
  ticker: string
  settlement_date: string
  short_interest_shares: number | null
  float_shares: number | null
  short_pct_float: number | null
  days_to_cover: number | null
  source: string
  loaded_at: string
}

export interface Notification {
  id: string
  user_id: string
  drop_id: string | null
  type: 'expiry_warning' | 'drop_resolved' | 'conviction_surge'
  message: string
  is_read: boolean
  created_at: string
}

// ------------------------------------------------------------
// API / View types
// (enriched shapes returned by API routes — joins included)
// ------------------------------------------------------------

/** Drop as returned by the feed — includes creator profile summary */
export interface DropWithCreator extends Drop {
  creator: Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'accuracy_score' | 'is_grzly_created'> | null
  reddit_mention_count?: number    // count of posts in last 7 days mentioning this ticker
}

/** Drop as returned by the detail page — full enrichment */
export interface DropDetail extends DropWithCreator {
  lore_events: LoreEvent[]
  price_history: PriceSnapshot[]   // daily closes from creation to present
  short_interest: ShortInterest | null
  reddit_posts: Pick<RedditPost, 'id' | 'title' | 'reddit_url' | 'upvotes' | 'subreddit' | 'posted_at'>[]
  user_vote: VoteDirection | null  // the authenticated user's vote, if any
}

// ------------------------------------------------------------
// API request/response shapes
// ------------------------------------------------------------

export interface CreateDropPayload {
  ticker: string
  thesis: string
  evidence_links?: string[]
  financial_metric?: string
  time_horizon: '7 days' | '30 days' | '90 days' | '180 days'
  target_price?: number | null
  is_anonymous?: boolean
}

export interface CastVotePayload {
  direction: VoteDirection
}

export interface ExtendDropPayload {
  reason: SwayzeReason
}

// Feed sort/filter options
export type FeedSort = 'conviction' | 'recent' | 'expiring'
export type HorizonFilter = 7 | 30 | 90 | 180

export interface FeedParams {
  sort?: FeedSort
  horizon?: HorizonFilter
  ticker?: string
  page?: number
  limit?: number
}

// Computed helper: is a Drop considered "Hot"?
// Hot = conviction ≥ 80%, total_votes ≥ 10, status = active, < 7 days to resolution
export function isHotDrop(drop: Drop): boolean {
  if (drop.status !== 'active') return false
  if ((drop.conviction_score ?? 0) < 80) return false
  if (drop.total_votes < 10) return false
  const daysLeft = (new Date(drop.resolves_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysLeft < 7
}
