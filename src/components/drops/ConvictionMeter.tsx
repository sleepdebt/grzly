'use client'

// ConvictionMeter — live conviction score display with Supabase Realtime
//
// Receives initial values from the SSR page (no loading flash).
// Subscribes to postgres_changes on the drops table filtered by drop ID.
// Updates the score and bar in real-time as votes come in.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ConvictionMeterProps {
  dropId: string
  initialScore: number        // accuracy-weighted % bearish
  initialRawPct: number       // unweighted % bearish (shown as secondary)
  initialTotalVotes: number
  initialBearishVotes: number
}

export default function ConvictionMeter({
  dropId,
  initialScore,
  initialRawPct,
  initialTotalVotes,
  initialBearishVotes,
}: ConvictionMeterProps) {
  const [score, setScore] = useState(initialScore)
  const [rawPct, setRawPct] = useState(initialRawPct)
  const [totalVotes, setTotalVotes] = useState(initialTotalVotes)
  const [bearishVotes, setBearishVotes] = useState(initialBearishVotes)
  const [justUpdated, setJustUpdated] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`conviction-${dropId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drops',
          filter: `id=eq.${dropId}`,
        },
        (payload) => {
          const updated = payload.new as {
            conviction_score: number
            raw_conviction_pct: number
            total_votes: number
            bearish_votes: number
          }

          setScore(updated.conviction_score ?? 0)
          setRawPct(updated.raw_conviction_pct ?? 0)
          setTotalVotes(updated.total_votes ?? 0)
          setBearishVotes(updated.bearish_votes ?? 0)

          // Brief flash to signal a live update
          setJustUpdated(true)
          setTimeout(() => setJustUpdated(false), 1200)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dropId])

  const skepticalVotes = totalVotes - bearishVotes

  return (
    <div className={`border rounded-lg p-5 text-center transition-colors duration-300 ${
      justUpdated ? 'border-accent/60' : 'border-border'
    }`}>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <div className={`w-1.5 h-1.5 rounded-full ${justUpdated ? 'bg-accent' : 'bg-muted'} transition-colors`} />
        <span className="text-xs text-muted">Live</span>
      </div>

      {/* Big score */}
      <div className={`font-mono text-5xl font-bold mb-1 transition-colors duration-300 ${
        score >= 75 ? 'text-hot' : score >= 50 ? 'text-swayze' : 'text-muted'
      }`}>
        {score.toFixed(0)}%
      </div>
      <div className="text-xs text-muted mb-4">Bearish conviction</div>

      {/* Bar */}
      <div className="h-2 bg-border rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 ease-out ${
            score >= 75 ? 'bg-hot' : score >= 50 ? 'bg-swayze' : 'bg-muted'
          }`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>

      {/* Vote breakdown */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-surface-2 rounded p-2">
          <div className="font-mono font-semibold text-hot">{bearishVotes}</div>
          <div className="text-muted">Bearish</div>
        </div>
        <div className="bg-surface-2 rounded p-2">
          <div className="font-mono font-semibold">{skepticalVotes}</div>
          <div className="text-muted">Skeptical</div>
        </div>
      </div>

      {/* Raw (unweighted) pct — shown below weighted score for transparency */}
      {Math.abs(rawPct - score) > 2 && (
        <p className="text-xs text-muted mt-3">
          Raw {rawPct.toFixed(0)}% · weighted by voter accuracy
        </p>
      )}
    </div>
  )
}
