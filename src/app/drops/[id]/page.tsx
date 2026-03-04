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

  const resolvesAt = new Date(drop.extended_resolves_at ?? drop.resolves_at)
  const swayzeLabels: Record<string, string> = {
    catalyst_delayed: 'Catalyst delayed',
    timing_off: 'Timing off',
    new_information: 'New information',
  }

  const packScore = drop.pack_sentiment_score ?? null
  const packMeta = packScore === null ? null
    : packScore >= 76 ? { color: 'text-hot',       dot: 'bg-hot',       label: 'Howling'  }
    : packScore >= 51 ? { color: 'text-swayze',    dot: 'bg-swayze',    label: 'Active'   }
    : packScore >= 26 ? { color: 'text-[#c8a200]', dot: 'bg-[#c8a200]', label: 'Stirring' }
    :                   { color: 'text-[#666]',    dot: 'bg-[#666]',    label: 'Quiet'    }

  return (
    <div className="max-w-[960px] mx-auto px-6 py-8 pb-20">

      {/* Back */}
      <a
        href="/"
        className="inline-flex items-center gap-2 text-[13px] text-[#555] hover:text-text-dim transition-colors mb-6"
      >
        ← Feed
      </a>

      {/* Outcome banner — resolved drops */}
      {drop.outcome && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-[10px] mb-6 border ${
          drop.outcome === 'correct'
            ? 'bg-correct/8 border-correct/25 text-correct'
            : drop.outcome === 'incorrect'
            ? 'bg-hot/8 border-hot/25 text-hot'
            : 'bg-surface-2 border-border text-text-dim'
        }`}>
          <span className="font-mono font-bold text-[11px] uppercase tracking-[0.12em]">
            {drop.outcome === 'correct' ? '✓ Resolved Correct' : drop.outcome === 'incorrect' ? '✗ Resolved Incorrect' : 'Inconclusive'}
          </span>
          {drop.price_change_pct !== null && (
            <span className="font-mono text-[13px] font-bold ml-auto">
              {drop.price_change_pct > 0 ? '+' : ''}{drop.price_change_pct.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Left column ── */}
        <div className="min-w-0 space-y-4">

          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-3.5 mb-1.5">
              <h1 className="font-mono text-[36px] font-bold text-accent leading-none">
                ${drop.ticker}
              </h1>
              {drop.status === 'extended' && (
                <span className="px-[9px] py-[3px] rounded-full text-[10px] font-mono font-bold tracking-[0.08em] uppercase bg-swayze/10 text-swayze border border-swayze/25">
                  SWAYZE
                </span>
              )}
            </div>
            {drop.company_name && (
              <p className="text-[15px] text-text-dim mb-2">{drop.company_name}</p>
            )}
            {/* Meta row */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-mono text-[12px] text-[#555]">
                {drop.time_horizon}
              </span>
              <span className="font-mono text-[12px] text-[#555]">
                Resolves <strong className="text-text-dim">
                  {resolvesAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </strong>
              </span>
              {drop.baseline_price && (
                <span className="font-mono text-[12px] text-[#555]">
                  Entry <strong className="text-text-dim">${drop.baseline_price.toFixed(2)}</strong>
                </span>
              )}
              {drop.target_price && (
                <span className="font-mono text-[12px] text-[#555]">
                  Target <strong className="text-hot">${drop.target_price.toFixed(2)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Lore block */}
          {drop.lore_narrative && (
            <div className="lore-block bg-surface border border-border rounded-[12px] px-[22px] py-[22px]">
              <p className="font-mono text-[9px] text-accent tracking-[0.15em] uppercase mb-3">
                ✦ The Prophecy
              </p>
              <p className="text-[14px] text-text-dim leading-[1.8] italic">
                {drop.lore_narrative}
              </p>
            </div>
          )}

          {/* Thesis */}
          <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[20px]">
            <h2 className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
              Thesis
            </h2>
            <p className="text-[14px] leading-[1.8] text-text">{drop.thesis}</p>
            {drop.financial_metric && (
              <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-surface-2 border border-border rounded text-[12px] font-mono text-text-dim">
                {drop.financial_metric}
              </div>
            )}
            {drop.evidence_links && drop.evidence_links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {drop.evidence_links.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border rounded text-[12px] text-text-dim hover:border-border-hl hover:text-text transition-colors"
                  >
                    <span className="text-[#555]">↗</span>
                    <span>Source {i + 1}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Bear Book narrative — resolved drops */}
          {drop.bear_book_narrative && (
            <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[20px]">
              <h2 className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Bear Book
              </h2>
              <p className="text-[14px] text-text-dim leading-[1.8] italic">
                {drop.bear_book_narrative}
              </p>
            </div>
          )}

          {/* Key financials */}
          {Object.values(market_context.financials).some(v => v !== null) && (
            <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[20px]">
              <h2 className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Key Financials
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
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
                  <div key={metric.label} className="bg-surface-2 border border-border rounded-lg p-3 text-center">
                    <div className="font-mono text-[15px] font-bold text-text">{metric.value}</div>
                    <div className="text-[11px] text-[#555] mt-0.5">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent news */}
          {market_context.news.length > 0 && (
            <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[20px]">
              <h2 className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Recent News
              </h2>
              <div>
                {market_context.news.map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 py-[11px] border-b border-border last:border-b-0 hover:opacity-75 transition-opacity group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-border-hl flex-shrink-0 mt-[5px]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-text leading-[1.4] mb-0.5 group-hover:text-accent transition-colors">
                        {article.headline}
                      </p>
                      <p className="font-mono text-[11px] text-[#555]">
                        {article.source} · {new Date(article.published_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reddit signal */}
          {drop.reddit_posts.length > 0 && (
            <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[20px]">
              <h2 className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Reddit Signal
                <span className="ml-2 text-accent normal-case tracking-normal font-sans font-normal">
                  {drop.reddit_mention_count ?? drop.reddit_posts.length} mentions (7d)
                </span>
              </h2>
              <div>
                {drop.reddit_posts.map(post => (
                  <a
                    key={post.id}
                    href={post.reddit_url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 py-3 border-b border-border last:border-b-0 hover:opacity-75 transition-opacity group"
                  >
                    <span className="font-mono text-[11px] font-bold text-[#ff4500] w-9 flex-shrink-0 text-right pt-0.5">
                      ▲ {post.upvotes >= 1000
                        ? `${(post.upvotes / 1000).toFixed(1)}k`
                        : post.upvotes}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-text leading-[1.4] mb-0.5 group-hover:text-accent transition-colors">
                        {post.title}
                      </p>
                      <p className="font-mono text-[11px] text-[#555]">
                        r/{post.subreddit} · {new Date(post.posted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-3.5 lg:sticky lg:top-[80px]">

          {/* Conviction meter */}
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

          {/* Expiry / SWAYZE */}
          <div className={`rounded-lg px-[14px] py-3 ${
            drop.status === 'extended'
              ? 'bg-swayze/5 border border-swayze/20'
              : 'bg-surface border border-border'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{drop.status === 'extended' ? '⏳' : '🕐'}</span>
              <div className="flex-1">
                <p className={`text-[13px] font-semibold leading-tight ${drop.status === 'extended' ? 'text-swayze' : 'text-text'}`}>
                  {resolvesAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {drop.status === 'extended' && drop.swayze_reason && (
                  <p className="text-[11px] text-swayze/70 mt-0.5">
                    SWAYZE · {swayzeLabels[drop.swayze_reason]}
                  </p>
                )}
              </div>
              {drop.status === 'active' && isCreator && !drop.was_extended && (
                <SwayzeButton
                  dropId={drop.id}
                  ticker={drop.ticker}
                  currentResolvesAt={drop.resolves_at}
                  wasExtended={drop.was_extended}
                  isCreator={isCreator}
                />
              )}
            </div>
          </div>

          {/* Pack Sentiment */}
          {packMeta && packScore !== null && (
            <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
              <h4 className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Pack Sentiment
              </h4>
              <div className="flex items-end justify-between mb-2.5">
                <span className={`font-mono text-[28px] font-bold leading-none ${packMeta.color}`}>
                  {packScore}
                </span>
                <span className={`font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${packMeta.color}`}>
                  {packMeta.label}
                </span>
              </div>
              <div className="w-full h-[4px] bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${packMeta.dot}`} style={{ width: `${packScore}%` }} />
              </div>
              <p className="text-[11px] text-[#555] mt-2.5 leading-relaxed">
                AI-rated bearish sentiment from news + social media sources. Updated nightly.
              </p>
            </div>
          )}

          {/* Short interest */}
          {drop.short_interest && (
            <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
              <h4 className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Short Interest
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                {drop.short_interest.short_pct_float !== null && (
                  <div>
                    <div className="font-mono text-[16px] font-bold text-hot">
                      {drop.short_interest.short_pct_float.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-[#555]">% Float Short</div>
                  </div>
                )}
                {drop.short_interest.days_to_cover !== null && (
                  <div>
                    <div className="font-mono text-[16px] font-bold text-text">
                      {drop.short_interest.days_to_cover.toFixed(1)}
                    </div>
                    <div className="text-[11px] text-[#555]">Days to Cover</div>
                  </div>
                )}
                {drop.short_interest.short_interest_shares !== null && (
                  <div>
                    <div className="font-mono text-[16px] font-bold text-text">
                      {(drop.short_interest.short_interest_shares / 1_000_000).toFixed(1)}M
                    </div>
                    <div className="text-[11px] text-[#555]">Shares Short</div>
                  </div>
                )}
              </div>
              <p className="font-mono text-[10px] text-[#555] mt-3">
                FINRA · {new Date(drop.short_interest.settlement_date).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Creator */}
          {!drop.is_anonymous && drop.creator && (
            <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
              <h4 className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-3.5">
                Vibelord
              </h4>
              <a
                href={`/profile/${drop.creator.username}`}
                className="flex items-center gap-3 group"
              >
                <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center font-mono text-[13px] font-bold text-accent flex-shrink-0">
                  {drop.creator.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-accent-dim group-hover:text-accent transition-colors">
                    @{drop.creator.username}
                  </p>
                  {drop.creator.accuracy_score !== null && (
                    <p className="font-mono text-[11px] text-[#555] mt-0.5">
                      <strong className="text-text-dim">{drop.creator.accuracy_score.toFixed(0)}%</strong> accuracy
                    </p>
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
