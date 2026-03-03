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
    <div className={`bg-surface border rounded-[12px] px-5 py-[18px] text-center transition-colors duration-300 ${
      justUpdated ? 'border-accent/60' : 'border-border'
    }`}>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${justUpdated ? 'bg-accent' : 'bg-[#555]'}`} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#555]">Live</span>
      </div>

      {/* Big score */}
      <div className={`font-mono font-bold leading-none mb-1 transition-colors duration-300 ${
        score >= 75 ? 'text-hot' : score >= 50 ? 'text-swayze' : 'text-text-dim'
      }`} style={{ fontSize: '52px' }}>
        {score.toFixed(0)}%
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#555] mt-1 mb-3">
        Bearish conviction
      </div>

      {/* Bar */}
      <div className="h-[6px] bg-border rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(score, 100)}%`,
            background: score >= 75
              ? 'linear-gradient(90deg, #ff3c3c, #ff6b6b)'
              : score >= 50
              ? 'linear-gradient(90deg, #ff9500, #ffb340)'
              : '#888',
          }}
        />
      </div>

      {/* Vote counts */}
      <div className="flex justify-between font-mono text-[11px] text-[#555] mb-4">
        <span className="text-hot">{bearishVotes} bearish</span>
        <span>{skepticalVotes} skeptical</span>
      </div>

      {/* Raw pct — only shown when meaningfully different */}
      {Math.abs(rawPct - score) > 2 && (
        <p className="text-[11px] text-[#555]">
          Raw {rawPct.toFixed(0)}% · weighted by accuracy
        </p>
      )}
    </div>
  )
}
