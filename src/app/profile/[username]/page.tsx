// Vibelord profile page — publicly accessible, no auth required
// Route: /profile/:username

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Profile, Drop } from '@/types'

interface PageProps {
  params: Promise<{ username: string }>
}

async function getProfile(username: string): Promise<{
  profile: Profile
  activeDrops: Drop[]
  resolvedDrops: Drop[]
} | null> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (error || !profile) return null

  // Active drops (for Active tab)
  const { data: activeDrops } = await supabase
    .from('drops')
    .select('*')
    .eq('created_by', profile.id)
    .eq('is_anonymous', false)
    .in('status', ['active', 'extended'])
    .order('conviction_score', { ascending: false, nullsFirst: false })

  // Resolved drops (for Resolved tab)
  const { data: resolvedDrops } = await supabase
    .from('drops')
    .select('*')
    .eq('created_by', profile.id)
    .eq('is_anonymous', false)
    .eq('status', 'archived')
    .order('resolved_at', { ascending: false })

  return {
    profile: profile as Profile,
    activeDrops: (activeDrops ?? []) as Drop[],
    resolvedDrops: (resolvedDrops ?? []) as Drop[],
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  return {
    title: `@${username}`,
    description: `GRZLY Vibelord profile for @${username}. Short conviction track record.`,
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params
  const data = await getProfile(username)

  if (!data) notFound()

  const { profile, activeDrops, resolvedDrops } = data
  const showAccuracy = profile.resolved_drop_count >= 3

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="flex items-start gap-5 mb-8">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center font-mono font-bold text-xl text-muted flex-shrink-0">
          {profile.username.slice(0, 2).toUpperCase()}
        </div>

        {/* Identity */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold">@{profile.username}</h1>
            {showAccuracy && (
              <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent font-semibold rounded">
                Vibelord
              </span>
            )}
          </div>
          {profile.bio && (
            <p className="text-sm text-muted mb-2">{profile.bio}</p>
          )}
          <p className="text-xs text-muted">
            {profile.drop_count} Drops · Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* Accuracy score */}
        {showAccuracy && profile.accuracy_score !== null && (
          <div className="text-right">
            <div className="font-mono text-3xl font-bold text-accent">
              {profile.accuracy_score.toFixed(0)}%
            </div>
            <div className="text-xs text-muted mt-1">accuracy</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total Drops', value: profile.drop_count },
          { label: 'Correct', value: profile.correct_drop_count, color: 'text-correct' },
          { label: 'Incorrect', value: profile.resolved_drop_count - profile.correct_drop_count, color: 'text-hot' },
          { label: 'Resolved', value: profile.resolved_drop_count },
        ].map(stat => (
          <div key={stat.label} className="border border-border rounded-lg p-4 text-center">
            <div className={`font-mono text-2xl font-bold mb-1 ${stat.color ?? ''}`}>
              {stat.value}
            </div>
            <div className="text-xs text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Drop lists — simple tabs would be added as client component */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
          Active Drops ({activeDrops.length})
        </h2>
        <div className="space-y-2 mb-8">
          {activeDrops.length === 0 && (
            <p className="text-muted text-sm">No active Drops.</p>
          )}
          {activeDrops.map(drop => (
            <a
              key={drop.id}
              href={`/drops/${drop.id}`}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm">${drop.ticker}</span>
                <span className="text-sm text-muted truncate max-w-xs">
                  {drop.thesis.slice(0, 80)}...
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {drop.conviction_score !== null && (
                  <span className="font-mono text-sm text-hot">{drop.conviction_score.toFixed(0)}% bearish</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide ${
                  drop.status === 'extended'
                    ? 'bg-swayze/10 text-swayze'
                    : 'bg-surface text-muted'
                }`}>
                  {drop.status === 'extended' ? 'SWAYZE' : 'Active'}
                </span>
              </div>
            </a>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
          Resolved ({resolvedDrops.length})
        </h2>
        <div className="space-y-2">
          {resolvedDrops.length === 0 && (
            <p className="text-muted text-sm">No resolved Drops yet.</p>
          )}
          {resolvedDrops.map(drop => (
            <a
              key={drop.id}
              href={`/drops/${drop.id}`}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm">${drop.ticker}</span>
                <span className="text-sm text-muted truncate max-w-xs">
                  {drop.thesis.slice(0, 80)}...
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {drop.price_change_pct !== null && (
                  <span className={`font-mono text-sm ${drop.outcome === 'correct' ? 'text-correct' : 'text-hot'}`}>
                    {drop.price_change_pct > 0 ? '+' : ''}{drop.price_change_pct.toFixed(1)}%
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide font-semibold ${
                  drop.outcome === 'correct'
                    ? 'bg-correct/10 text-correct'
                    : 'bg-hot/10 text-hot'
                }`}>
                  {drop.outcome === 'correct' ? 'Correct' : 'Incorrect'}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
