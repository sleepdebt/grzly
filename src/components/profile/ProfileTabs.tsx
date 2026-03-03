'use client'

// ProfileTabs — interactive tabs + track record dot timeline
// Visual spec: feed_and_detail.html — Vibelord Profile screen

import { useState } from 'react'
import { Drop } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface ProfileTabsProps {
  activeDrops: Drop[]
  resolvedDrops: Drop[]
}

export default function ProfileTabs({ activeDrops, resolvedDrops }: ProfileTabsProps) {
  const [tab, setTab] = useState<'active' | 'resolved'>('active')

  // Track record: resolved oldest-first, then active drops at the end
  const trackRecord = [
    ...[...resolvedDrops].sort(
      (a, b) => new Date(a.resolved_at!).getTime() - new Date(b.resolved_at!).getTime()
    ),
    ...activeDrops,
  ]

  return (
    <div>
      {/* Track record dot timeline */}
      {trackRecord.length > 0 && (
        <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[20px] mb-6">
          <h2 className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#555] mb-4">
            Track Record
          </h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {trackRecord.map(drop => {
              const isResolved = drop.status === 'resolved' || drop.status === 'archived'
              const isCorrect  = drop.outcome === 'correct'
              const isExtended = drop.status === 'extended'

              let dotClass = ''
              let symbol = '●'
              let tooltipText = ''

              if (isResolved) {
                if (isCorrect) {
                  dotClass = 'bg-correct/15 border border-correct/30 text-correct'
                  symbol = '✓'
                  tooltipText = `$${drop.ticker} · Correct${drop.price_change_pct !== null ? ` · ▼${Math.abs(drop.price_change_pct).toFixed(1)}%` : ''}`
                } else {
                  dotClass = 'bg-hot/12 border border-hot/25 text-hot'
                  symbol = '✗'
                  tooltipText = `$${drop.ticker} · Incorrect${drop.price_change_pct !== null ? ` · ▲${drop.price_change_pct.toFixed(1)}%` : ''}`
                }
              } else if (isExtended) {
                dotClass = 'bg-swayze/10 border border-swayze/25 text-swayze'
                symbol = '●'
                tooltipText = `$${drop.ticker} · Extended · ${formatDistanceToNow(new Date(drop.extended_resolves_at ?? drop.resolves_at), { addSuffix: true })}`
              } else {
                dotClass = 'bg-accent/8 border border-accent/20 text-accent'
                symbol = '●'
                tooltipText = `$${drop.ticker} · Active · ${formatDistanceToNow(new Date(drop.resolves_at), { addSuffix: true })}`
              }

              return (
                <a
                  key={drop.id}
                  href={`/drops/${drop.id}`}
                  className={`relative group w-7 h-7 rounded-[4px] flex items-center justify-center font-mono text-[10px] font-bold cursor-pointer ${dotClass}`}
                  title={tooltipText}
                >
                  {symbol}
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block z-50 whitespace-nowrap bg-[#1e1e1e] border border-border-hl rounded-[7px] px-2.5 py-[7px] text-[11px] font-normal text-text-dim">
                    {tooltipText}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border-hl" />
                  </span>
                </a>
              )
            })}
          </div>
          {/* Legend */}
          <div className="flex gap-4 flex-wrap">
            {[
              { bg: 'bg-correct/15 border border-correct/30', label: 'Correct' },
              { bg: 'bg-hot/12 border border-hot/25', label: 'Incorrect' },
              { bg: 'bg-accent/8 border border-accent/20', label: 'Active' },
            ].map(({ bg, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-[#555]">
                <div className={`w-3 h-3 rounded-[3px] ${bg}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {([
          { key: 'active',   label: 'Active Drops', count: activeDrops.length },
          { key: 'resolved', label: 'Resolved',      count: resolvedDrops.length },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'text-accent border-accent'
                : 'text-[#555] border-transparent hover:text-text-dim'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'active' ? (
        <DropList drops={activeDrops} type="active" />
      ) : (
        <DropList drops={resolvedDrops} type="resolved" />
      )}
    </div>
  )
}

function DropList({ drops, type }: { drops: Drop[]; type: 'active' | 'resolved' }) {
  if (drops.length === 0) {
    return (
      <p className="text-[13px] text-[#555] py-8">
        {type === 'active' ? 'No active Drops.' : 'No resolved Drops yet.'}
      </p>
    )
  }

  return (
    <div>
      {drops.map(drop => {
        const isCorrect = drop.outcome === 'correct'

        return (
          <a
            key={drop.id}
            href={`/drops/${drop.id}`}
            className="flex items-center gap-4 py-3.5 border-b border-border last:border-b-0 hover:opacity-80 transition-opacity"
          >
            {/* Ticker */}
            <span className="font-mono text-[15px] font-bold text-accent w-[60px] flex-shrink-0">
              ${drop.ticker}
            </span>

            {/* Thesis excerpt */}
            <span className="flex-1 text-[13px] text-text-dim truncate min-w-0">
              {drop.thesis}
            </span>

            {/* Conviction / price change */}
            {type === 'active' && drop.conviction_score !== null && (
              <span className="font-mono text-[13px] font-bold text-hot w-11 text-right flex-shrink-0">
                {drop.conviction_score.toFixed(0)}%
              </span>
            )}
            {type === 'resolved' && drop.price_change_pct !== null && (
              <span className={`font-mono text-[12px] font-bold w-[52px] text-right flex-shrink-0 ${
                isCorrect ? 'text-correct' : 'text-hot'
              }`}>
                {isCorrect ? '▼' : '▲'}{Math.abs(drop.price_change_pct).toFixed(1)}%
              </span>
            )}

            {/* Status / outcome */}
            {type === 'active' ? (
              <span className={`font-mono text-[11px] w-[70px] text-right flex-shrink-0 ${
                drop.status === 'extended' ? 'text-swayze' : 'text-[#555]'
              }`}>
                {drop.status === 'extended' ? 'SWAYZE' : 'Active'}
              </span>
            ) : (
              <span className={`font-mono text-[11px] w-[70px] text-right flex-shrink-0 ${
                isCorrect ? 'text-correct' : 'text-hot'
              }`}>
                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
              </span>
            )}
          </a>
        )
      })}
    </div>
  )
}
