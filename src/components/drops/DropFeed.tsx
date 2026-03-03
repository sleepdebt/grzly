'use client'

// Drop Feed — client component with filter controls and Realtime subscription
// Receives initial SSR data as props; subscribes to Realtime for live conviction updates

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DropWithCreator, FeedParams, FeedSort, HorizonFilter } from '@/types'
import DropCard from './DropCard'

interface DropFeedProps {
  initialDrops: DropWithCreator[]
  initialParams: FeedParams
}

const SORT_OPTIONS: { value: FeedSort; label: string }[] = [
  { value: 'conviction', label: 'Conviction' },
  { value: 'recent', label: 'Recent' },
  { value: 'expiring', label: 'Expiring Soon' },
]

const HORIZON_OPTIONS: { value: HorizonFilter; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '180d' },
]

export default function DropFeed({ initialDrops, initialParams }: DropFeedProps) {
  const [drops, setDrops] = useState<DropWithCreator[]>(initialDrops)
  const [sort, setSort] = useState<FeedSort>(initialParams.sort ?? 'conviction')
  const [horizon, setHorizon] = useState<HorizonFilter | undefined>(initialParams.horizon)
  const [loading, setLoading] = useState(false)

  // Re-fetch when filters change
  useEffect(() => {
    async function fetchDrops() {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('sort', sort)
      if (horizon) params.set('horizon', String(horizon))

      const res = await fetch(`/api/drops?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDrops(data.drops)
      }
      setLoading(false)
    }

    fetchDrops()
  }, [sort, horizon])

  // Supabase Realtime — live conviction score updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('feed-drops-conviction')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drops' },
        (payload) => {
          setDrops(prev =>
            prev.map(d =>
              d.id === payload.new.id
                ? { ...d, ...(payload.new as Partial<DropWithCreator>) }
                : d
            )
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div>
      {/* Feed legend */}
      <div className="flex items-center gap-4 text-xs text-muted mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          Active
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-hot" />
          Hot
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-swayze" />
          SWAYZE (Extended)
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-6">
        {/* Sort */}
        <div className="flex gap-1">
          {SORT_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setSort(option.value)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                sort === option.value
                  ? 'bg-accent text-bg font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Horizon filters */}
        <div className="flex gap-1">
          <button
            onClick={() => setHorizon(undefined)}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              !horizon ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
            }`}
          >
            All
          </button>
          {HORIZON_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setHorizon(horizon === option.value ? undefined : option.value)}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                horizon === option.value
                  ? 'bg-surface-2 text-text'
                  : 'text-muted hover:text-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop cards */}
      {loading ? (
        <div className="text-muted text-sm py-8 text-center">Loading...</div>
      ) : drops.length === 0 ? (
        <div className="text-muted text-sm py-16 text-center">
          No active Drops match your filters.
          <br />
          <a href="/drops/create" className="text-accent hover:underline mt-2 inline-block">
            Be the first to drop a thesis →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {drops.map(drop => (
            <DropCard key={drop.id} drop={drop} />
          ))}
        </div>
      )}
    </div>
  )
}
