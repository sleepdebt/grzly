// Feed page — server-rendered initial data, then real-time conviction updates
// Route: /
// When NEXT_PUBLIC_WAITLIST_MODE=true, redirects to the pre-launch waitlist page

import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DropWithCreator, FeedParams } from '@/types'
import DropFeed from '@/components/drops/DropFeed'

interface PageProps {
  searchParams: Promise<FeedParams>
}

// Fetch drops server-side for initial render (SEO-friendly, fast first paint)
async function getDrops(params: FeedParams): Promise<DropWithCreator[]> {
  const supabase = await createClient()
  const { sort = 'conviction', horizon, ticker, page = 1, limit = 20 } = params
  const offset = (page - 1) * limit

  let query = supabase
    .from('drops')
    .select(`
      *,
      creator:profiles!drops_created_by_fkey (
        username,
        display_name,
        avatar_url,
        accuracy_score
      )
    `)
    .in('status', ['active', 'extended'])
    .range(offset, offset + limit - 1)

  // Apply horizon filter
  if (horizon) {
    const horizonLabel = `${horizon} days`
    query = query.eq('time_horizon', horizonLabel)
  }

  // Apply ticker filter
  if (ticker) {
    query = query.eq('ticker', ticker.toUpperCase())
  }

  // Apply sort
  switch (sort) {
    case 'conviction':
      query = query.order('conviction_score', { ascending: false, nullsFirst: false })
      break
    case 'recent':
      query = query.order('created_at', { ascending: false })
      break
    case 'expiring':
      query = query.order('resolves_at', { ascending: true })
      break
  }

  const { data, error } = await query

  if (error) {
    console.error('[Feed] Failed to fetch drops:', error)
    return []
  }

  return (data ?? []) as unknown as DropWithCreator[]
}

export default async function FeedPage({ searchParams }: PageProps) {
  if (process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true') {
    redirect('/waitlist')
  }

  const params = await searchParams
  const drops = await getDrops(params)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Active Drops</h1>
        <p className="text-muted text-sm">
          Short theses ranked by collective conviction. Vote to signal your view.
        </p>
      </div>

      {/* Feed with filters — client component for interactivity */}
      <Suspense fallback={<div className="text-muted text-sm">Loading drops...</div>}>
        <DropFeed initialDrops={drops} initialParams={params} />
      </Suspense>
    </div>
  )
}
