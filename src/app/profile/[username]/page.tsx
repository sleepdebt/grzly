// Vibelord profile page — publicly accessible, no auth required
// Route: /profile/:username
// Visual spec: feed_and_detail.html — Vibelord Profile screen

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Profile, Drop } from '@/types'
import ProfileTabs from '@/components/profile/ProfileTabs'

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

  const [activeResult, resolvedResult] = await Promise.all([
    supabase
      .from('drops')
      .select('*')
      .eq('created_by', profile.id)
      .eq('is_anonymous', false)
      .in('status', ['active', 'extended'])
      .order('conviction_score', { ascending: false, nullsFirst: false }),

    supabase
      .from('drops')
      .select('*')
      .eq('created_by', profile.id)
      .eq('is_anonymous', false)
      .in('status', ['resolved', 'archived'])
      .order('resolved_at', { ascending: false }),
  ])

  return {
    profile: profile as Profile,
    activeDrops:   (activeResult.data   ?? []) as Drop[],
    resolvedDrops: (resolvedResult.data ?? []) as Drop[],
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
  const incorrectCount = profile.resolved_drop_count - profile.correct_drop_count
  const joinedDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  })

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 pb-20">

      {/* Profile header */}
      <div className="flex items-start gap-6 mb-8 pb-8 border-b border-border">

        {/* Avatar */}
        <div className="w-[72px] h-[72px] rounded-full bg-surface-2 border-2 border-border-hl flex items-center justify-center font-mono text-[24px] font-bold text-accent flex-shrink-0">
          {profile.username.slice(0, 2).toUpperCase()}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-[24px] font-bold text-text mb-1">
            {profile.username}
          </h1>
          <p className="font-mono text-[13px] text-[#555] mb-3">
            Vibelord · joined {joinedDate} · {profile.drop_count} Drops
          </p>
          {profile.bio && (
            <p className="text-[14px] text-text-dim leading-[1.6]">{profile.bio}</p>
          )}
        </div>

        {/* Accuracy block */}
        {showAccuracy && profile.accuracy_score !== null && (
          <div className="flex-shrink-0 text-right pl-7 border-l border-border">
            <div className="font-mono text-[48px] font-bold text-accent leading-none">
              {profile.accuracy_score.toFixed(0)}%
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#555] mt-1">
              Accuracy
            </div>
            <div className="font-mono text-[11px] text-[#555] mt-1.5">
              <strong className="text-text-dim">{profile.correct_drop_count}</strong> correct
              {' · '}
              <strong className="text-text-dim">{incorrectCount}</strong> incorrect
              {' · '}
              <strong className="text-text-dim">{profile.resolved_drop_count}</strong> resolved
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total Drops',    value: profile.drop_count,            color: '' },
          { label: 'Correct calls',  value: profile.correct_drop_count,    color: 'text-correct' },
          { label: 'Incorrect',      value: incorrectCount,                color: 'text-hot' },
          { label: 'Resolved',       value: profile.resolved_drop_count,   color: '' },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-[10px] px-[18px] py-4"
          >
            <div className={`font-mono text-[24px] font-bold mb-1 ${stat.color || 'text-text'}`}>
              {stat.value}
            </div>
            <div className="text-[11px] text-[#555]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + track record (client component) */}
      <ProfileTabs activeDrops={activeDrops} resolvedDrops={resolvedDrops} />

    </div>
  )
}
