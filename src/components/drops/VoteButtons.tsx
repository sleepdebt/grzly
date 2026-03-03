'use client'

// VoteButtons — cast a conviction vote on a Drop
//
// States:
//   - unauthenticated: prompts sign-in
//   - not voted: shows Bearish + Skeptical buttons
//   - voted: shows which way you voted (locked, immutable)
//   - drop resolved/archived: voting closed message
//   - optimistic update: shows new conviction immediately before server confirms

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VoteDirection, DropStatus } from '@/types'

interface VoteButtonsProps {
  dropId: string
  dropStatus: DropStatus
  initialUserVote: VoteDirection | null   // null = not voted yet
  isAuthenticated: boolean
}

export default function VoteButtons({
  dropId,
  dropStatus,
  initialUserVote,
  isAuthenticated,
}: VoteButtonsProps) {
  const [userVote, setUserVote] = useState<VoteDirection | null>(initialUserVote)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const votingOpen = dropStatus === 'active' || dropStatus === 'extended'

  async function handleVote(direction: VoteDirection) {
    if (!isAuthenticated) {
      window.location.href = `/auth/sign-in?redirectTo=${encodeURIComponent(window.location.pathname)}`
      return
    }

    if (userVote) return    // already voted — votes are immutable
    if (!votingOpen) return
    if (loading) return

    setLoading(true)
    setError(null)

    // Optimistic update — show immediately
    setUserVote(direction)

    const supabase = createClient()
    const res = await fetch(`/api/drops/${dropId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))

      // 409 = already voted (race condition) — just show the vote
      if (res.status !== 409) {
        setUserVote(null)  // revert optimistic update
        setError(data.error ?? 'Failed to cast vote. Please try again.')
      }
    }

    setLoading(false)
  }

  // Voting closed
  if (!votingOpen) {
    return (
      <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-2">Voting</p>
        <p className="text-[13px] text-text-dim">
          {dropStatus === 'resolved' || dropStatus === 'archived'
            ? 'Resolved — voting closed.'
            : 'Voting is closed.'}
        </p>
      </div>
    )
  }

  // Already voted
  if (userVote) {
    return (
      <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-3">Your vote</p>
        <div className={`w-full py-[11px] rounded-lg text-[13px] font-bold text-center border ${
          userVote === 'bearish'
            ? 'bg-hot border-hot text-white'
            : 'bg-surface-2 border-border text-text-dim'
        }`}>
          {userVote === 'bearish' ? 'Bearish' : 'Skeptical'}
          <span className="ml-2 text-[11px] opacity-50 font-normal">locked</span>
        </div>
        <p className="font-mono text-[11px] text-[#555] text-center mt-2.5">
          Votes are immutable.
        </p>
      </div>
    )
  }

  // Not yet voted
  return (
    <div className="bg-surface border border-border rounded-[12px] px-5 py-[18px]">
      <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#555] mb-3">
        {isAuthenticated ? 'Cast your vote' : 'Vote on this Drop'}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => handleVote('bearish')}
          disabled={loading}
          className="flex-1 py-[11px] rounded-lg text-[13px] font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed
            bg-hot/8 border-hot/30 text-hot hover:bg-hot/18 hover:border-hot"
        >
          Bearish
        </button>
        <button
          onClick={() => handleVote('skeptical')}
          disabled={loading}
          className="flex-1 py-[11px] rounded-lg text-[13px] font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed
            bg-surface-2 border-border text-text-dim hover:border-border-hl hover:text-text"
        >
          Skeptical
        </button>
      </div>

      {!isAuthenticated && (
        <p className="font-mono text-[11px] text-[#555] text-center mt-2.5">
          <a
            href={`/auth/sign-in?redirectTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
            className="text-accent hover:underline"
          >
            Sign in
          </a>{' '}
          to vote and build your record.
        </p>
      )}

      {error && (
        <p className="text-[11px] text-hot mt-2">{error}</p>
      )}
    </div>
  )
}
