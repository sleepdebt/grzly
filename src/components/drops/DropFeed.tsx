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
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#555] mr-1">
          Sort
        </span>
        {SORT_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => setSort(option.value)}
            className={`filter-chip${sort === option.value ? ' active' : ''}`}
          >
            {option.label}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#555] mr-1">
          Horizon
        </span>
        <button
          onClick={() => setHorizon(undefined)}
          className={`filter-chip${!horizon ? ' active' : ''}`}
        >
          All
        </button>
        {HORIZON_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => setHorizon(horizon === option.value ? undefined : option.value)}
            className={`filter-chip${horizon === option.value ? ' active' : ''}`}
          >
            {option.label}
          </button>
        ))}
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
