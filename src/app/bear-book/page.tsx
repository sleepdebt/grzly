// Bear Book page — publicly accessible, no auth required
// Route: /bear-book

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Drop } from '@/types'

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

async function getBearBookData(): Promise<{ drops: Drop[]; stats: BearBookStats }> {
  const supabase = await createClient()

  const { data: drops } = await supabase
    .from('drops')
    .select('*')
    .eq('status', 'archived')
    .order('resolved_at', { ascending: false })

  const resolvedDrops = (drops ?? []) as Drop[]
  const correct = resolvedDrops.filter(d => d.outcome === 'correct').length
  const incorrect = resolvedDrops.filter(d => d.outcome === 'incorrect').length
  const total = correct + incorrect

  return {
    drops: resolvedDrops,
    stats: {
      total,
      correct,
      incorrect,
      accuracyPct: total >= 3 ? Math.round((correct / total) * 100) : null,
    },
  }
}

export default async function BearBookPage() {
  const { drops, stats } = await getBearBookData()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Bear Book</h1>
        <p className="text-muted text-sm">
          Every resolved Drop. The permanent record. The reckoning, archived.
        </p>
      </div>

      {/* Community accuracy stats */}
      {stats.total > 0 && (
        <div className="border border-border rounded-lg p-5 mb-8 flex items-center gap-8">
          {stats.accuracyPct !== null && (
            <div>
              <div className="font-mono text-3xl font-bold text-accent">{stats.accuracyPct}%</div>
              <div className="text-xs text-muted mt-1">Community accuracy</div>
            </div>
          )}
          <div>
            <div className="font-mono text-xl font-semibold">{stats.total}</div>
            <div className="text-xs text-muted mt-1">Total resolved</div>
          </div>
          <div>
            <div className="font-mono text-xl font-semibold text-correct">{stats.correct}</div>
            <div className="text-xs text-muted mt-1">Correct calls</div>
          </div>
          <div>
            <div className="font-mono text-xl font-semibold text-hot">{stats.incorrect}</div>
            <div className="text-xs text-muted mt-1">Incorrect calls</div>
          </div>
        </div>
      )}

      {/* Resolved drops list */}
      {drops.length === 0 ? (
        <p className="text-muted text-sm text-center py-16">
          No resolved Drops yet. The Bear Book awaits its first entry.
        </p>
      ) : (
        <div className="space-y-4">
          {drops.map(drop => (
            <BearBookEntry key={drop.id} drop={drop} />
          ))}
        </div>
      )}
    </div>
  )
}

function BearBookEntry({ drop }: { drop: Drop }) {
  const isCorrect = drop.outcome === 'correct'
  const priceChange = drop.price_change_pct

  return (
    <article className="border border-border rounded-lg p-5">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <a href={`/drops/${drop.id}`} className="font-mono font-bold text-lg hover:text-accent transition-colors">
            ${drop.ticker}
          </a>
          {drop.company_name && (
            <span className="text-muted text-sm ml-2">{drop.company_name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {priceChange !== null && (
            <span className={`font-mono text-sm ${isCorrect ? 'text-correct' : 'text-hot'}`}>
              {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded font-semibold uppercase tracking-wide ${
            isCorrect
              ? 'bg-correct/10 text-correct'
              : 'bg-hot/10 text-hot'
          }`}>
            {isCorrect ? 'Correct' : 'Incorrect'}
          </span>
        </div>
      </div>

      {/* Bear Book lore narrative */}
      {drop.bear_book_narrative && (
        <p className="text-sm text-muted italic border-l-2 border-border pl-3 mb-3">
          {drop.bear_book_narrative}
        </p>
      )}

      {/* Conviction at close */}
      <div className="text-xs text-muted">
        {drop.conviction_score !== null && (
          <span className="mr-4">{drop.conviction_score.toFixed(0)}% conviction at close</span>
        )}
        {drop.total_votes > 0 && (
          <span className="mr-4">{drop.total_votes} votes</span>
        )}
        {drop.resolved_at && (
          <span>Resolved {new Date(drop.resolved_at).toLocaleDateString()}</span>
        )}
      </div>
    </article>
  )
}
