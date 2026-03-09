// Dynamic OG image for drop detail pages
// Renders as the og:image for /drops/[id]

import { ImageResponse } from 'next/og'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: drop } = await supabase
    .from('drops')
    .select(`
      ticker, company_name, thesis, conviction_score, raw_conviction_pct,
      total_votes, bearish_votes, status, outcome, time_horizon,
      resolves_at, extended_resolves_at, is_anonymous, price_change_pct,
      creator:profiles!drops_created_by_fkey (username)
    `)
    .eq('id', id)
    .single()

  const conviction = drop?.conviction_score ?? drop?.raw_conviction_pct ?? 0
  const convictionPct = Math.round(conviction)
  const barFill = Math.min(100, Math.max(0, convictionPct))

  const isResolved = drop?.status === 'resolved' || drop?.status === 'archived'
  const isCorrect  = drop?.outcome === 'correct'
  const isHot      = conviction >= 75 && (drop?.total_votes ?? 0) >= 10

  const statusColor  = isResolved
    ? (isCorrect ? '#22c55e' : '#ff3b30')
    : drop?.status === 'extended' ? '#ff9500' : '#c8ff00'

  // Satori doesn't support 8-digit hex colors — use explicit rgba
  const statusBg = isResolved
    ? (isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(255,59,48,0.1)')
    : drop?.status === 'extended' ? 'rgba(255,149,0,0.1)' : 'rgba(200,255,0,0.1)'
  const statusBorder = isResolved
    ? (isCorrect ? 'rgba(34,197,94,0.25)' : 'rgba(255,59,48,0.25)')
    : drop?.status === 'extended' ? 'rgba(255,149,0,0.25)' : 'rgba(200,255,0,0.25)'

  const statusLabel  = isResolved
    ? (isCorrect ? '✓ CORRECT' : '✗ INCORRECT')
    : drop?.status === 'extended' ? 'SWAYZE' : isHot ? '🔥 HOT' : 'ACTIVE'

  const resolvesAt = drop
    ? new Date(drop.extended_resolves_at ?? drop.resolves_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  // Truncate thesis for OG image
  const thesis = drop?.thesis ?? ''
  const thesisExcerpt = thesis.length > 130 ? thesis.slice(0, 130) + '…' : thesis

  // Creator handle (only if not anonymous)
  const creatorRow = Array.isArray(drop?.creator) ? drop.creator[0] : drop?.creator
  const creatorHandle = !drop?.is_anonymous && creatorRow?.username
    ? `@${creatorRow.username as string}`
    : null

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
          fontFamily: 'monospace',
        }}
      >
        {/* Top row: GRZLY wordmark + status badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#c8ff00', letterSpacing: '0.28em' }}>
            GRZLY
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              backgroundColor: statusBg,
              border: `1px solid ${statusBorder}`,
              borderRadius: '20px',
              padding: '6px 16px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor, letterSpacing: '0.1em' }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Main content: left (ticker + thesis) + right (conviction) */}
        <div style={{ display: 'flex', gap: '56px', flex: 1 }}>

          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '64px', fontWeight: 700, color: '#c8ff00', lineHeight: 1 }}>
                ${drop?.ticker ?? '???'}
              </span>
              {drop?.company_name && (
                <span style={{ fontSize: '20px', color: '#666666', lineHeight: 1 }}>
                  {drop.company_name}
                </span>
              )}
            </div>

            {/* Thesis */}
            <p
              style={{
                fontSize: '20px',
                color: '#aaaaaa',
                lineHeight: 1.55,
                marginTop: '20px',
                flex: 1,
              }}
            >
              {thesisExcerpt}
            </p>

            {/* Footer meta */}
            <div style={{ display: 'flex', gap: '24px', marginTop: '24px' }}>
              {[
                drop?.time_horizon,
                resolvesAt ? `Resolves ${resolvesAt}` : null,
                creatorHandle,
              ].filter(Boolean).map((item, i) => (
                <span key={i} style={{ fontSize: '13px', color: '#444444', fontFamily: 'monospace' }}>
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
              borderLeft: '1px solid #1a1a1a',
              flexShrink: 0,
              width: '220px',
            }}
          >
            {/* Score */}
            <div style={{ fontFamily: 'monospace', fontSize: '80px', fontWeight: 700, color: '#ff3b30', lineHeight: 1 }}>
              {convictionPct}%
            </div>
            <div style={{ fontSize: '11px', color: '#444444', letterSpacing: '0.12em', marginTop: '8px', marginBottom: '20px' }}>
              BEARISH
            </div>

            {/* Bar */}
            <div style={{ display: 'flex', width: '160px', height: '6px', backgroundColor: '#1f1f1f', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${barFill}%`, height: '100%', backgroundColor: '#ff3b30', borderRadius: '3px' }} />
            </div>

            {/* Vote count */}
            {(drop?.total_votes ?? 0) > 0 && (
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#444444', marginTop: '10px' }}>
                {drop!.total_votes} votes
              </div>
            )}

            {/* Outcome price change */}
            {isResolved && drop!.price_change_pct !== null && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: isCorrect ? '#22c55e' : '#ff3b30',
                  marginTop: '16px',
                }}
              >
                {isCorrect ? '▼' : '▲'}{Math.abs(drop!.price_change_pct).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
