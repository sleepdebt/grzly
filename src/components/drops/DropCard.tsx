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

  // Border color by state
  const borderColor = hot
    ? 'border-l-hot'
    : extended
    ? 'border-l-swayze'
    : 'border-l-border'

  return (
    <article
      className={`
        bg-surface border border-border border-l-4 ${borderColor}
        rounded-lg p-4 hover:border-muted transition-colors cursor-pointer
      `}
      onClick={() => { window.location.href = `/drops/${drop.id}` }}
    >
      {/* Top row: ticker + status badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-base">${drop.ticker}</span>
          {drop.company_name && (
            <span className="text-muted text-sm">{drop.company_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hot && (
            <span
              className="text-xs bg-hot/15 text-hot px-2 py-0.5 rounded font-semibold uppercase tracking-wide"
              title="High conviction (≥80%) with high vote velocity — less than 7 days to resolution"
            >
              🔥 Hot
            </span>
          )}
          {extended && (
            <span
              className="text-xs bg-swayze/15 text-swayze px-2 py-0.5 rounded font-semibold uppercase tracking-wide"
              title="Creator invoked SWAYZE — time horizon extended once. Reasoning is recorded on the Drop."
            >
              SWAYZE
            </span>
          )}
        </div>
      </div>

      {/* Thesis excerpt */}
      <p className="text-sm text-muted mb-4 line-clamp-2">
        {drop.thesis}
      </p>

      {/* Conviction bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-mono text-hot font-semibold">{bearishPct.toFixed(0)}% Bearish</span>
          <span className="text-muted">{drop.total_votes} votes</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-hot conviction-bar"
            style={{ width: `${bearishPct}%` }}
          />
        </div>
      </div>

      {/* Footer: creator + expiry + reddit */}
      <div className="flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-2">
          {!drop.is_anonymous && drop.creator ? (
            <a
              href={`/profile/${drop.creator.username}`}
              className="hover:text-text transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              @{drop.creator.username}
              {drop.creator.accuracy_score !== null && (
                <span className="ml-1 text-accent">{drop.creator.accuracy_score.toFixed(0)}%</span>
              )}
            </a>
          ) : (
            <span>Anonymous</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {drop.reddit_mention_count !== undefined && drop.reddit_mention_count > 0 && (
            <span>{drop.reddit_mention_count} Reddit mentions</span>
          )}
          <span>Resolves {timeLeft}</span>
        </div>
      </div>
    </article>
  )
}
