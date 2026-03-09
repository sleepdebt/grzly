// Dynamic OG image for drop detail pages
// Renders as the og:image for /drops/[id]

import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type DropRow = {
  ticker: string
  company_name: string | null
  thesis: string | null
  conviction_score: number | null
  raw_conviction_pct: number | null
  total_votes: number | null
  status: string
  outcome: string | null
  time_horizon: string | null
  resolves_at: string
  extended_resolves_at: string | null
  is_anonymous: boolean
  price_change_pct: number | null
  creator: { username: string } | { username: string }[] | null
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  let drop: DropRow | null = null
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/drops?id=eq.${id}&select=ticker,company_name,thesis,conviction_score,raw_conviction_pct,total_votes,status,outcome,time_horizon,resolves_at,extended_resolves_at,is_anonymous,price_change_pct,creator:profiles!drops_created_by_fkey(username)&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      }
    )
    const rows = (await res.json()) as DropRow[]
    drop = rows?.[0] ?? null
  } catch {
    // Render fallback on error
  }

  const conviction = (drop?.conviction_score ?? drop?.raw_conviction_pct ?? 0) as number
  const convictionPct = Math.round(conviction)
  const barFill = Math.min(100, Math.max(0, convictionPct))

  const isResolved = drop?.status === 'resolved' || drop?.status === 'archived'
  const isCorrect  = drop?.outcome === 'correct'
  const isHot      = conviction >= 75 && ((drop?.total_votes ?? 0) as number) >= 10

  const statusColor = isResolved
    ? (isCorrect ? '#22c55e' : '#ff3b30')
    : drop?.status === 'extended' ? '#ff9500' : '#c8ff00'

  // Satori doesn't support 8-digit hex — use explicit rgba
  const statusBg = isResolved
    ? (isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(255,59,48,0.1)')
    : drop?.status === 'extended' ? 'rgba(255,149,0,0.1)' : 'rgba(200,255,0,0.1)'
  const statusBorder = isResolved
    ? (isCorrect ? 'rgba(34,197,94,0.25)' : 'rgba(255,59,48,0.25)')
    : drop?.status === 'extended' ? 'rgba(255,149,0,0.25)' : 'rgba(200,255,0,0.25)'

  const statusLabel = isResolved
    ? (isCorrect ? 'CORRECT' : 'INCORRECT')
    : drop?.status === 'extended' ? 'SWAYZE' : isHot ? 'HOT' : 'ACTIVE'

  const resolvesAt = drop
    ? new Date(drop.extended_resolves_at ?? drop.resolves_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  const thesis = (drop?.thesis ?? '') as string
  const thesisExcerpt = thesis.length > 130 ? thesis.slice(0, 130) + '...' : thesis

  const creatorRow = Array.isArray(drop?.creator) ? (drop.creator as { username: string }[])[0] : (drop?.creator as { username: string } | null)
  const creatorHandle = drop && !drop.is_anonymous && creatorRow?.username
    ? `@${creatorRow.username}`
    : null

  const metaItems = [
    drop?.time_horizon as string | null | undefined,
    resolvesAt ? `Resolves ${resolvesAt}` : null,
    creatorHandle,
  ].filter((x): x is string => typeof x === 'string' && x.length > 0)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          backgroundColor: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 72px',
        }}
      >
        {/* Top row: wordmark + status badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#c8ff00' }}>
            GRZLY
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: statusBg,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: statusBorder,
              borderRadius: '20px',
              paddingTop: '6px',
              paddingBottom: '6px',
              paddingLeft: '16px',
              paddingRight: '16px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1 }}>

          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '6px' }}>
              <span style={{ fontSize: '64px', fontWeight: 700, color: '#c8ff00', lineHeight: '1', marginRight: '16px' }}>
                ${drop?.ticker ?? '???'}
              </span>
              {drop?.company_name ? (
                <span style={{ fontSize: '20px', color: '#666666', lineHeight: '1', paddingBottom: '8px' }}>
                  {drop.company_name as string}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', fontSize: '20px', color: '#aaaaaa', lineHeight: '1.5', marginTop: '20px', flex: 1 }}>
              {thesisExcerpt}
            </div>

            <div style={{ display: 'flex', marginTop: '24px' }}>
              {metaItems.map((item, i) => (
                <span key={i} style={{ fontSize: '13px', color: '#444444', marginRight: i < metaItems.length - 1 ? '24px' : '0' }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: conviction */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingLeft: '48px',
              borderLeftWidth: '1px',
              borderLeftStyle: 'solid',
              borderLeftColor: '#1a1a1a',
              width: '220px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '80px', fontWeight: 700, color: '#ff3b30', lineHeight: '1' }}>
              {convictionPct}%
            </div>
            <div style={{ display: 'flex', fontSize: '11px', color: '#444444', marginTop: '8px', marginBottom: '20px' }}>
              BEARISH
            </div>

            <div style={{ display: 'flex', width: '160px', height: '6px', backgroundColor: '#1f1f1f', borderRadius: '3px' }}>
              <div style={{ display: 'flex', width: `${barFill}%`, height: '6px', backgroundColor: '#ff3b30', borderRadius: '3px' }} />
            </div>

            {(drop?.total_votes ?? 0) > 0 ? (
              <div style={{ display: 'flex', fontSize: '12px', color: '#444444', marginTop: '10px' }}>
                {String(drop!.total_votes)} votes
              </div>
            ) : null}

            {isResolved && drop?.price_change_pct != null ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: isCorrect ? '#22c55e' : '#ff3b30',
                  marginTop: '16px',
                }}
              >
                {isCorrect ? 'v' : '^'} {Math.abs(drop.price_change_pct as number).toFixed(1)}%
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
