// Drop detail page — SSR with Supabase Realtime subscription client-side
// Route: /drops/:id

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getPriceHistory } from '@/lib/polygon'
import { getDropMarketContext, type DropMarketContext } from '@/lib/finnhub'
import { DropDetail } from '@/types'
import ConvictionMeter from '@/components/drops/ConvictionMeter'
import VoteButtons from '@/components/drops/VoteButtons'
import SwayzeButton from '@/components/drops/SwayzeModal'

interface PageProps {
  params: Promise<{ id: string }>
}

interface FullDropDetail extends DropDetail {
  market_context: DropMarketContext
}

async function getDrop(id: string): Promise<FullDropDetail | null> {
  const supabase = await createClient()

  // Fetch drop with creator profile
  const { data: drop, error } = await supabase
    .from('drops')
    .select(`
      *,
      creator:profiles!drops_created_by_fkey (
        username,
        display_name,
        avatar_url,
        accuracy_score
      ),
      lore_events (
        id, event_type, narrative, prompt_version, model_used, created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !drop) return null

  // All external data fetched in parallel — Polygon + Finnhub + Supabase
  const fromDate = drop.created_at.split('T')[0]
  const toDate = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    priceHistory,
    marketContext,
    redditResult,
    shortInterestResult,
    userResult,
  ] = await Promise.all([
    // Polygon: price chart data
    getPriceHistory(drop.ticker, fromDate, toDate),

    // Finnhub: news headlines + financials + company profile
    getDropMarketContext(drop.ticker),

    // Supabase: Reddit signal (top 3 posts mentioning this ticker, last 7 days)
    supabase
      .from('reddit_posts')
      .select('id, title, reddit_url, upvotes, subreddit, posted_at')
      .contains('tickers_mentioned', [drop.ticker])
      .gte('posted_at', sevenDaysAgo)
      .order('upvotes', { ascending: false })
      .limit(3),

    // Supabase: latest FINRA short interest
    supabase
      .from('short_interest')
      .select('*')
      .eq('ticker', drop.ticker)
      .order('settlement_date', { ascending: false })
      .limit(1)
      .single(),

    // Supabase: authenticated user's vote on this drop
    supabase.auth.getUser(),
  ])

  // Fetch user's vote if logged in
  let userVote = null
  if (userResult.data.user) {
    const { data: vote } = await supabase
      .from('votes')
      .select('direction')
      .eq('drop_id', id)
      .eq('user_id', userResult.data.user.id)
      .single()
    userVote = vote?.direction ?? null
  }

  return {
    ...drop,
    price_history: priceHistory,
    reddit_posts: redditResult.data ?? [],
    short_interest: shortInterestResult.data ?? null,
    user_vote: userVote,
    market_context: marketContext,
  } as unknown as FullDropDetail
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('drops')
    .select('ticker, company_name, thesis')
    .eq('id', id)
    .single()

  if (!data) return { title: 'Drop Not Found' }

  return {
    title: `$${data.ticker} — ${data.company_name ?? data.ticker}`,
    description: data.thesis.slice(0, 155),
  }
}

export default async function DropDetailPage({ params }: PageProps) {
  const { id } = await params
  const drop = await getDrop(id)

  if (!drop) notFound()

  const { market_context } = drop

  // Determine if the current user is the Drop creator (for SWAYZE button)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isCreator = !!user && user.id === drop.created_by
  const isAuthenticated = !!user

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

        {/* ── Left column ── */}
        <div className="space-y-6">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/" className="text-muted text-sm hover:text-text">← Feed</a>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-mono text-3xl font-bold">${drop.ticker}</h1>
                {drop.company_name && (
                  <p className="text-muted mt-1">{drop.company_name}</p>
                )}
              </div>
              {drop.price_change_pct !== null && (
                <div className="text-right">
                  <div className={`font-mono text-2xl font-bold ${
                    (drop.price_change_pct ?? 0) < 0 ? 'text-correct' : 'text-hot'
                  }`}>
                    {(drop.price_change_pct ?? 0) > 0 ? '+' : ''}
                    {(drop.price_change_pct ?? 0).toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted mt-0.5">since Drop creation</p>
                </div>
              )}
            </div>
          </div>

          {/* Lore block */}
          {drop.lore_narrative && (
            <div className="border-t-2 border-accent bg-surface rounded-lg p-5">
              <p className="text-xs text-accent font-semibold uppercase tracking-wide mb-2">
                ✦ The Prophecy
              </p>
              <p className="text-sm italic text-muted leading-relaxed">
                {drop.lore_narrative}
              </p>
            </div>
          )}

          {/* Thesis */}
          <div className="border border-border rounded-lg p-5">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Thesis</h2>
            <p className="text-sm leading-relaxed">{drop.thesis}</p>
            {drop.financial_metric && (
              <div className="mt-3 inline-block px-3 py-1.5 bg-surface-2 rounded text-xs font-mono text-muted">
                {drop.financial_metric}
              </div>
            )}
          </div>

          {/* Finnhub: News headlines */}
          {market_context.news.length > 0 && (
            <div className="border border-border rounded-lg p-5">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Recent News
              </h2>
              <div className="space-y-3">
                {market_context.news.map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <p className="text-sm group-hover:text-accent transition-colors leading-snug">
                      {article.headline}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {article.source} · {new Date(article.published_at).toLocaleDateString()}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Finnhub: Key financials */}
          {Object.values(market_context.financials).some(v => v !== null) && (
            <div className="border border-border rounded-lg p-5">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Key Financials
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'P/E (TTM)', value: market_context.financials.pe_ratio?.toFixed(1) },
                  { label: 'P/S', value: market_context.financials.ps_ratio?.toFixed(1) },
                  { label: 'P/B', value: market_context.financials.pb_ratio?.toFixed(1) },
                  { label: 'Gross Margin', value: market_context.financials.gross_margin
                    ? `${(market_context.financials.gross_margin * 100).toFixed(1)}%` : undefined },
                  { label: 'Rev Growth', value: market_context.financials.revenue_growth_yoy
                    ? `${(market_context.financials.revenue_growth_yoy * 100).toFixed(1)}%` : undefined },
                  { label: 'D/E Ratio', value: market_context.financials.debt_to_equity?.toFixed(2) },
                ].filter(m => m.value !== undefined).map(metric => (
                  <div key={metric.label} className="bg-surface-2 rounded p-3 text-center">
                    <div className="font-mono text-sm font-semibold">{metric.value}</div>
                    <div className="text-xs text-muted mt-0.5">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reddit signal */}
          {drop.reddit_posts.length > 0 && (
            <div className="border border-border rounded-lg p-5">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Reddit Signal · {drop.reddit_mention_count ?? drop.reddit_posts.length} mentions (7d)
              </h2>
              <div className="space-y-3">
                {drop.reddit_posts.map(post => (
                  <a
                    key={post.id}
                    href={post.reddit_url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-4 group"
                  >
                    <div>
                      <p className="text-sm group-hover:text-accent transition-colors leading-snug">
                        {post.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        r/{post.subreddit} · {new Date(post.posted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-muted flex-shrink-0">
                      ▲ {post.upvotes.toLocaleString()}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Conviction meter — live via Supabase Realtime */}
          <ConvictionMeter
            dropId={drop.id}
            initialScore={drop.conviction_score ?? drop.raw_conviction_pct ?? 0}
            initialRawPct={drop.raw_conviction_pct ?? 0}
            initialTotalVotes={drop.total_votes}
            initialBearishVotes={drop.bearish_votes}
          />

          {/* Vote buttons */}
          <VoteButtons
            dropId={drop.id}
            dropStatus={drop.status}
            initialUserVote={drop.user_vote}
            isAuthenticated={isAuthenticated}
          />

          {/* Expiry + SWAYZE */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-muted mb-1 uppercase tracking-wide font-semibold">Resolves</p>
              <p className="font-mono text-sm">
                {new Date(drop.extended_resolves_at ?? drop.resolves_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </p>
              {drop.status === 'extended' && drop.swayze_reason && (
                <p className="text-xs text-swayze mt-1">
                  SWAYZE · {
                    ({ catalyst_delayed: 'Catalyst delayed', timing_off: 'Timing off', new_information: 'New information' })[drop.swayze_reason]
                  }
                </p>
              )}
            </div>

            {/* SWAYZE button — only visible to creator, only on active drops */}
            {drop.status === 'active' && (
              <SwayzeButton
                dropId={drop.id}
                ticker={drop.ticker}
                currentResolvesAt={drop.resolves_at}
                wasExtended={drop.was_extended}
                isCreator={isCreator}
                onExtended={() => {}}
              />
            )}
          </div>

          {/* Short interest */}
          {drop.short_interest && (
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-2 uppercase tracking-wide font-semibold">Short Interest</p>
              <div className="space-y-1.5">
                {drop.short_interest.short_pct_float !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">% Float Short</span>
                    <span className="font-mono">{drop.short_interest.short_pct_float.toFixed(1)}%</span>
                  </div>
                )}
                {drop.short_interest.days_to_cover !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Days to Cover</span>
                    <span className="font-mono">{drop.short_interest.days_to_cover.toFixed(1)}</span>
                  </div>
                )}
                <p className="text-xs text-muted mt-1">
                  FINRA · {new Date(drop.short_interest.settlement_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Creator */}
          {!drop.is_anonymous && drop.creator && (
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-2 uppercase tracking-wide font-semibold">Vibelord</p>
              <a
                href={`/profile/${drop.creator.username}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-xs text-muted">
                  {drop.creator.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">@{drop.creator.username}</p>
                  {drop.creator.accuracy_score !== null && (
                    <p className="text-xs text-accent">{drop.creator.accuracy_score.toFixed(0)}% accuracy</p>
                  )}
                </div>
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
