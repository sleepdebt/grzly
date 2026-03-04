'use client'

// Drop Feed — client component with filter controls and Realtime subscription
// Receives initial SSR data as props; subscribes to Realtime for live conviction updates

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DropWithCreator, FeedParams, FeedSort, HorizonFilter } from '@/types'
import DropCard from './DropCard'

interface DropFeedProps {
  initialDrops: DropWithCreator[]
  initialParams: FeedParams
}

interface TickerSuggestion {
  symbol: string
  description: string
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export default function DropFeed({ initialDrops, initialParams }: DropFeedProps) {
  const [drops, setDrops] = useState<DropWithCreator[]>(initialDrops)
  const [sort, setSort] = useState<FeedSort>(initialParams.sort ?? 'conviction')
  const [horizon, setHorizon] = useState<HorizonFilter | undefined>(initialParams.horizon)
  const [loading, setLoading] = useState(false)

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(!!initialParams.ticker)
  const [searchInput, setSearchInput] = useState(initialParams.ticker ?? '')
  const [activeTicker, setActiveTicker] = useState<string | undefined>(initialParams.ticker)
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionLoading, setSuggestionLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchRowRef = useRef<HTMLDivElement>(null)

  // Re-fetch when filters or ticker changes
  useEffect(() => {
    async function fetchDrops() {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('sort', sort)
      if (horizon) params.set('horizon', String(horizon))
      if (activeTicker) params.set('ticker', activeTicker)

      const res = await fetch(`/api/drops?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDrops(data.drops)
      }
      setLoading(false)
    }

    fetchDrops()
  }, [sort, horizon, activeTicker])

  // Debounced company name search for suggestions
  useEffect(() => {
    if (!searchInput.trim() || searchInput === activeTicker) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      setSuggestionLoading(true)
      try {
        const res = await fetch(`/api/search/tickers?q=${encodeURIComponent(searchInput)}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.results)
          setShowSuggestions(data.results.length > 0)
        }
      } finally {
        setSuggestionLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, activeTicker])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRowRef.current && !searchRowRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  function openSearch() {
    setIsSearchOpen(true)
    // Focus after the transition starts
    requestAnimationFrame(() => {
      requestAnimationFrame(() => inputRef.current?.focus())
    })
  }

  function closeSearch() {
    setIsSearchOpen(false)
    setShowSuggestions(false)
    // Keep activeTicker — closing doesn't clear the filter
  }

  function selectTicker(symbol: string) {
    setActiveTicker(symbol)
    setSearchInput(symbol)
    setSuggestions([])
    setShowSuggestions(false)
    // Collapse search after selection
    setIsSearchOpen(false)
  }

  function clearTicker() {
    setActiveTicker(undefined)
    setSearchInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = searchInput.trim().toUpperCase()
      if (val) selectTicker(val)
    }
    if (e.key === 'Escape') {
      closeSearch()
    }
  }

  return (
    <div>
      {/* Filter bar + search (shared row) */}
      <div className="mb-6">
        {/* Filter bar — hidden while search is open */}
        <div
          className={`flex items-center gap-2 flex-wrap transition-all duration-200 ease-out ${
            isSearchOpen
              ? 'opacity-0 pointer-events-none h-0 overflow-hidden'
              : 'opacity-100'
          }`}
        >
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

          {/* Active ticker pill — visible in filter bar when search is closed */}
          {activeTicker && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <span className="inline-flex items-center gap-1.5 px-2 py-[3px] bg-surface-2 border border-border rounded font-mono text-[12px] text-accent">
                {activeTicker}
                <button
                  onClick={clearTicker}
                  className="text-[#555] hover:text-text transition-colors"
                  aria-label="Clear ticker filter"
                >
                  <XIcon className="w-2.5 h-2.5" />
                </button>
              </span>
            </>
          )}

          {/* Search icon — far right */}
          <button
            onClick={openSearch}
            className="ml-auto p-1.5 rounded text-[#555] hover:text-text hover:bg-surface transition-colors"
            aria-label="Search"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Search input row — shown while open */}
        <div
          ref={searchRowRef}
          className={`transition-all duration-200 ease-out ${
            isSearchOpen
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none h-0 overflow-hidden'
          }`}
        >
          <div className="relative flex items-center gap-2">
            {/* Input */}
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search by ticker or company…"
                className="w-full pl-9 pr-8 py-[7px] bg-surface border border-border rounded text-[13px] text-text placeholder-[#555] focus:outline-none focus:border-border-hl transition-colors"
              />
              {searchInput && (
                <button
                  onClick={clearTicker}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-text transition-colors"
                  aria-label="Clear"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Cancel */}
            <button
              onClick={closeSearch}
              className="text-[#555] hover:text-text text-[13px] transition-colors shrink-0"
            >
              Cancel
            </button>

            {/* Suggestions dropdown */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-12 mt-1 bg-surface border border-border rounded shadow-lg z-20 overflow-hidden">
                {suggestionLoading ? (
                  <div className="px-3 py-2 text-[12px] text-[#555]">Searching…</div>
                ) : (
                  suggestions.map(s => (
                    <button
                      key={s.symbol}
                      onMouseDown={() => selectTicker(s.symbol)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 transition-colors border-b border-border last:border-0"
                    >
                      <span className="font-mono text-[13px] text-accent w-14 shrink-0">{s.symbol}</span>
                      <span className="text-[12px] text-text-dim truncate">{s.description}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* Drop cards */}
      {loading ? (
        <div className="text-muted text-sm py-8 text-center">Loading...</div>
      ) : drops.length === 0 ? (
        <div className="text-muted text-sm py-16 text-center">
          {activeTicker
            ? `No active Drops for ${activeTicker}.`
            : 'No active Drops match your filters.'
          }
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
