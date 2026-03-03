'use client'

// Drop card — used on the feed and Bear Book
// Visual spec: feed_and_detail.html — Drop cards

import { DropWithCreator, isHotDrop } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface DropCardProps {
  drop: DropWithCreator
}

export default function DropCard({ drop }: DropCardProps) {
  const hot = isHotDrop(drop)
  const extended = drop.status === 'extended'
  const resolvesAt = new Date(drop.extended_resolves_at ?? drop.resolves_at)
  const timeLeft = formatDistanceToNow(resolvesAt, { addSuffix: true })
  const bearishPct = drop.conviction_score ?? drop.raw_conviction_pct ?? 0

  const cardClass = [
    'drop-card',
    hot ? 'hot' : '',
    extended ? 'extended' : '',
  ].filter(Boolean).join(' ')

  return (
    <article
      className={`${cardClass} bg-surface border border-border rounded-xl hover:border-border-hl hover:bg-surface-2 transition-colors cursor-pointer`}
      style={{ padding: '20px 24px' }}
      onClick={() => { window.location.href = `/drops/${drop.id}` }}
    >
      {/* Card top: left info + right conviction score */}
      <div className="flex items-start justify-between gap-4 mb-3.5">

        {/* Left: ticker row + status badges + thesis */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="font-mono font-bold text-lg text-accent">${drop.ticker}</span>
            {drop.company_name && (
              <span className="text-[13px] text-text-dim">{drop.company_name}</span>
            )}
            {hot && (
              <span
                className="px-[9px] py-[3px] rounded-full text-[10px] font-mono font-bold tracking-[0.08em] uppercase bg-hot/10 text-hot border border-hot/25"
                title="High conviction (≥80%) with high vote velocity — less than 7 days to resolution"
              >
                HOT
              </span>
            )}
            {extended && (
              <span
                className="px-[9px] py-[3px] rounded-full text-[10px] font-mono font-bold tracking-[0.08em] uppercase bg-swayze/10 text-swayze border border-swayze/25"
                title="Creator invoked SWAYZE — time horizon extended once. Reasoning is recorded on the Drop."
              >
                SWAYZE
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-dim leading-relaxed line-clamp-2">
            {drop.thesis}
          </p>
        </div>

        {/* Right: conviction score */}
        <div className="shrink-0 text-right">
          <div className="font-mono font-bold text-[28px] leading-none text-hot">
            {bearishPct.toFixed(0)}%
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#555] mt-0.5">
            Bearish
          </div>
          <div className="w-[120px] h-[4px] bg-border rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-hot conviction-bar rounded-full"
              style={{ width: `${bearishPct}%` }}
            />
          </div>
        </div>

      </div>

      {/* Card bottom: creator + votes + expiry */}
      <div className="flex items-center gap-4 pt-3.5 border-t border-border flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-[#555]">
          {!drop.is_anonymous && drop.creator ? (
            <>
              <a
                href={`/profile/${drop.creator.username}`}
                className="text-accent-dim font-semibold hover:text-accent transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                @{drop.creator.username}
              </a>
              {drop.creator.accuracy_score !== null && (
                <span className="px-1.5 py-px rounded bg-accent/8 text-accent-dim font-mono text-[10px] font-bold">
                  {drop.creator.accuracy_score.toFixed(0)}%
                </span>
              )}
            </>
          ) : (
            <span>Anonymous</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#555]">
          <span className="text-text-dim font-medium">{drop.total_votes}</span>
          <span>votes</span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-[#555]">
          {drop.reddit_mention_count !== undefined && drop.reddit_mention_count > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff4500]" />
              {drop.reddit_mention_count} Reddit mentions
            </span>
          )}
          <span>Resolves {timeLeft}</span>
        </div>
      </div>
    </article>
  )
}
