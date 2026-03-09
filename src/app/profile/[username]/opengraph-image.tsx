// Dynamic OG image for profile pages
// Renders as /profile/[username] Open Graph image
// Automatically picked up by Next.js for og:image meta tag

import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // Fetch via REST API to work around Supabase JS SDK in OG image context
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  type ProfileRow = {
    username: string
    avatar_url: string | null
    bio: string | null
    accuracy_score: number | null
    drop_count: number
    resolved_drop_count: number
    correct_drop_count: number
  }

  let profile: ProfileRow | null = null

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=username,avatar_url,bio,accuracy_score,drop_count,resolved_drop_count,correct_drop_count&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      }
    )
    const rows = (await res.json()) as ProfileRow[]
    profile = rows?.[0] ?? null
  } catch {
    // Return fallback image on error
  }

  const showAccuracy = !!profile && profile.resolved_drop_count >= 3
  const initials = profile ? profile.username.slice(0, 2).toUpperCase() : 'GR'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          backgroundColor: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 80px',
          fontFamily: 'monospace',
        }}
      >
        {/* GRZLY wordmark */}
        <div style={{ display: 'flex', marginBottom: '52px' }}>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#c8ff00',
              letterSpacing: '0.28em',
            }}
          >
            GRZLY
          </span>
          <span style={{ fontSize: '15px', color: '#333333', letterSpacing: '0.28em' }}>.</span>
        </div>

        {/* Main row: avatar + identity + accuracy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '48px', flex: 1 }}>

          {/* Avatar */}
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              style={{
                width: '124px',
                height: '124px',
                borderRadius: '62px',
                objectFit: 'cover',
                border: '3px solid #222222',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '124px',
                height: '124px',
                borderRadius: '62px',
                backgroundColor: '#111111',
                border: '3px solid #222222',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '46px',
                fontWeight: 700,
                color: '#c8ff00',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
          )}

          {/* Username + bio */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '54px',
                fontWeight: 700,
                color: '#f5f5f5',
                marginBottom: '14px',
                lineHeight: 1.1,
              }}
            >
              @{profile?.username ?? username}
            </div>
            {profile?.bio && (
              <div
                style={{
                  fontSize: '21px',
                  color: '#777777',
                  lineHeight: 1.5,
                }}
              >
                {profile.bio.length > 95 ? profile.bio.slice(0, 95) + '…' : profile.bio}
              </div>
            )}
          </div>

          {/* Accuracy block */}
          {showAccuracy && profile!.accuracy_score !== null && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                paddingLeft: '52px',
                borderLeft: '1px solid #1f1f1f',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: '84px',
                  fontWeight: 700,
                  color: '#c8ff00',
                  lineHeight: 1,
                }}
              >
                {profile!.accuracy_score.toFixed(0)}%
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#444444',
                  letterSpacing: '0.14em',
                  marginTop: '10px',
                }}
              >
                ACCURACY
              </div>
            </div>
          )}
        </div>

        {/* Stats footer */}
        {profile && (
          <div
            style={{
              display: 'flex',
              gap: '52px',
              paddingTop: '32px',
              marginTop: '32px',
              borderTop: '1px solid #181818',
            }}
          >
            {[
              { label: 'Drops', value: profile.drop_count },
              { label: 'Correct', value: profile.correct_drop_count },
              { label: 'Resolved', value: profile.resolved_drop_count },
            ].map(stat => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '34px', fontWeight: 700, color: '#f0f0f0' }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: '13px', color: '#444444', marginTop: '5px' }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
