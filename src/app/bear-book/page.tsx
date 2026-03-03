// Bear Book page — publicly accessible, no auth required
// Route: /bear-book
// Visual spec: feed_and_detail.html — Bear Book screen

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Drop, Profile } from '@/types'

export const metadata: Metadata = {
  title: 'Bear Book',
  description: 'Every resolved Drop. The permanent record of collective short conviction — right and wrong.',
}

interface BearBookStats {
  total: number
  correct: number
  incorrect: number
  accuracyPct: number | null
}

type LeaderboardEntry = Pick<Profile, 'username' | 'accuracy_score' | 'correct_drop_count' | 'resolved_drop_count' | 'drop_count'>

async function getBearBookData(): Promise<{
  drops: Drop[]
  stats: BearBookStats
  leaderboard: LeaderboardEntry[]
}> {
  const supabase = await createClient()

  const [dropsResult, leaderboardResult] = await Promise.all([
    supabase
      .from('drops')
      .select('*')
      .in('status', ['resolved', 'archived'])
      .order('resolved_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('username, accuracy_score, correct_drop_count, resolved_drop_count, drop_count')
      .not('accuracy_score', 'is', null)
      .gte('resolved_drop_count', 1)
      .order('accuracy_score', { ascending: false })
      .limit(5),
  ])

  const drops = (dropsResult.data ?? []) as Drop[]
  const correct   = drops.filter(d => d.outcome === 'correct').length
  const incorrect = drops.filter(d => d.outcome === 'incorrect').length
  const total     = correct + incorrect

  return {
    drops,
    stats: {
      total,
      correct,
      incorrect,
      accuracyPct: total >= 3 ? Math.round((correct / total) * 100) : null,
    },
    leaderboard: (leaderboardResult.data ?? []) as LeaderboardEntry[],
  }
}

export default async function BearBookPage() {
  const { drops, stats, leaderboard } = await getBearBookData()

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 pb-20">

      {/* Header */}
      <div className="mb-7">
        <h1 className="font-mono text-[20px] font-bold text-text mb-1">Bear Book</h1>
        <p className="text-[13px] text-[#555]">
          Resolved Drops, archived in order. The record doesn't lie.
        </p>
      </div>

      {/* Community accuracy stats */}
      {stats.total > 0 && (
        <div className="bg-surface border border-border rounded-[10px] px-[22px] py-[18px] mb-6 flex gap-8 flex-wrap">
          {stats.accuracyPct !== null && (
            <div>
              <div className="font-mono text-[28px] font-bold text-correct leading-none">
                {stats.accuracyPct}%
              </div>
              <div className="text-[11px] text-[#555] mt-0.5">Community accuracy</div>
            </div>
          )}
          <div>
            <div className="font-mono text-[28px] font-bold text-text leading-none">{stats.total}</div>
            <div className="text-[11px] text-[#555] mt-0.5">Total resolved</div>
          </div>
          <div>
            <div className="font-mono text-[28px] font-bold text-correct leading-none">{stats.correct}</div>
            <div className="text-[11px] text-[#555] mt-0.5">Correct</div>
          </div>
          <div>
            <div className="font-mono text-[28px] font-bold text-hot leading-none">{stats.incorrect}</div>
            <div className="text-[11px] text-[#555] mt-0.5">Incorrect</div>
          </div>
        </div>
      )}

      {/* Layout: entries + leaderboard sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">

        {/* Resolved entries */}
        <div>
          {drops.length === 0 ? (
            <p className="text-[13px] text-[#555] text-center py-16">
              No resolved Drops yet. The Bear Book awaits its first entry.
            </p>
          ) : (
            <div className="space-y-3">
              {drops.map(drop => (
                <BearBookEntry key={drop.id} drop={drop} />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard sidebar */}
        {leaderboard.length > 0 && (
          <div className="lg:sticky lg:top-[80px]">
            <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
              <h2 className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-4">
                Top Vibelords
              </h2>
              <div className="space-y-3.5">
                {leaderboard.map((creator, i) => (
                  <a
                    key={creator.username}
                    href={`/profile/${creator.username}`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="font-mono text-[11px] text-[#555] w-4 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-accent-dim group-hover:text-accent transition-colors truncate">
                        @{creator.username}
                      </p>
                      <p className="font-mono text-[10px] text-[#555] mt-0.5">
                        {creator.correct_drop_count}W · {creator.resolved_drop_count - creator.correct_drop_count}L
                      </p>
                    </div>
                    <span className="font-mono text-[13px] font-bold text-correct flex-shrink-0">
                      {creator.accuracy_score?.toFixed(0)}%
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function BearBookEntry({ drop }: { drop: Drop }) {
  const isCorrect   = drop.outcome === 'correct'
  const isIncorrect = drop.outcome === 'incorrect'
  const priceChange = drop.price_change_pct

  const entryClass = [
    'bb-entry',
    isCorrect   ? 'correct'   : '',
    isIncorrect ? 'incorrect' : '',
  ].filter(Boolean).join(' ')

  return (
    <a href={`/drops/${drop.id}`} className="block">
    <article
      className={`${entryClass} bg-surface border border-border rounded-[12px] hover:border-border-hl transition-colors`}
      style={{ padding: '20px 24px' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          {/* Ticker + company */}
          <div className="flex items-center gap-2.5 mb-2">
            <span className="font-mono text-[20px] font-bold text-accent">${drop.ticker}</span>
            {drop.company_name && (
              <span className="text-[13px] text-text-dim">{drop.company_name}</span>
            )}
          </div>
          {/* Stats row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {drop.conviction_score !== null && (
              <span className="font-mono text-[12px] text-[#555]">
                Conviction: <strong className="text-text-dim">{drop.conviction_score.toFixed(0)}%</strong>
              </span>
            )}
            {priceChange !== null && (
              <span className="font-mono text-[12px] text-[#555]">
                Price:{' '}
                <strong className={isCorrect ? 'text-correct' : 'text-hot'}>
                  {isCorrect ? '▼' : '▲'} {Math.abs(priceChange).toFixed(1)}%
                </strong>
              </span>
            )}
            {drop.resolved_at && (
              <span className="font-mono text-[12px] text-[#555]">
                Resolved: <strong className="text-text-dim">
                  {new Date(drop.resolved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </strong>
              </span>
            )}
            {drop.total_votes > 0 && (
              <span className="font-mono text-[12px] text-[#555]">
                <strong className="text-text-dim">{drop.total_votes}</strong> votes
              </span>
            )}
          </div>
        </div>

        {/* Outcome badge */}
        <span className={`flex-shrink-0 px-[10px] py-[4px] rounded-full font-mono text-[11px] font-bold tracking-[0.06em] border ${
          isCorrect
            ? 'bg-correct/10 text-correct border-correct/25'
            : isIncorrect
            ? 'bg-hot/10 text-hot border-hot/25'
            : 'bg-surface-2 text-text-dim border-border'
        }`}>
          {isCorrect ? '✓ Correct' : isIncorrect ? '✗ Incorrect' : 'Inconclusive'}
        </span>
      </div>

      {/* Bear Book narrative */}
      {drop.bear_book_narrative && (
        <p className="text-[13px] text-[#555] italic leading-[1.7] mt-1">
          "{drop.bear_book_narrative}"
        </p>
      )}
    </article>
    </a>
  )
}
