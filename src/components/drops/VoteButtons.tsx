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
      <div className="border border-border rounded-lg p-5">
        <p className="text-xs text-muted uppercase tracking-wide font-semibold mb-2">Voting</p>
        <p className="text-sm text-muted">
          {dropStatus === 'archived' ? 'This Drop has resolved. Voting is closed.' : 'Voting is closed.'}
        </p>
      </div>
    )
  }

  // Already voted
  if (userVote) {
    return (
      <div className="border border-border rounded-lg p-5 space-y-3">
        <p className="text-xs text-muted uppercase tracking-wide font-semibold">Your vote</p>

        <div className={`w-full py-2.5 rounded text-sm font-semibold text-center ${
          userVote === 'bearish'
            ? 'bg-hot/15 border-2 border-hot text-hot'
            : 'bg-surface-2 border border-border text-muted'
        }`}>
          {userVote === 'bearish' ? '🐻 Bearish' : 'Skeptical'}
          <span className="ml-2 text-xs opacity-60">· locked</span>
        </div>

        <p className="text-xs text-muted text-center">
          Votes are immutable — your conviction is on record.
        </p>
      </div>
    )
  }

  // Not yet voted
  return (
    <div className="border border-border rounded-lg p-5 space-y-3">
      <p className="text-xs text-muted uppercase tracking-wide font-semibold">
        {isAuthenticated ? 'Cast your vote' : 'Vote on this Drop'}
      </p>

      <button
        onClick={() => handleVote('bearish')}
        disabled={loading}
        className="w-full py-2.5 border-2 border-hot text-hot font-semibold rounded text-sm hover:bg-hot hover:text-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        🐻 Bearish
      </button>

      <button
        onClick={() => handleVote('skeptical')}
        disabled={loading}
        className="w-full py-2.5 border border-border text-muted font-semibold rounded text-sm hover:border-muted hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Skeptical
      </button>

      {!isAuthenticated && (
        <p className="text-xs text-muted text-center">
          <a
            href={`/auth/sign-in?redirectTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
            className="text-accent hover:underline"
          >
            Sign in
          </a>{' '}
          to vote and build your track record.
        </p>
      )}

      {error && (
        <p className="text-xs text-hot">{error}</p>
      )}
    </div>
  )
}
