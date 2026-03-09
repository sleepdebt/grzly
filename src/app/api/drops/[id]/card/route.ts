// GET /api/drops/[id]/card
// Returns a standalone HTML embed card for a drop — suitable for <iframe> embeds

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: drop } = await supabase
    .from('drops')
    .select(`
      ticker, company_name, thesis, conviction_score, raw_conviction_pct,
      total_votes, status, outcome, time_horizon,
      resolves_at, extended_resolves_at, is_anonymous, price_change_pct,
      creator:profiles!drops_created_by_fkey (username)
    `)
    .eq('id', id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://grzly.io'
  const dropUrl = `${appUrl}/drops/${id}`

  const conviction  = drop?.conviction_score ?? drop?.raw_conviction_pct ?? 0
  const convPct     = Math.round(conviction)
  const barFill     = Math.min(100, Math.max(0, convPct))

  const isResolved  = drop?.status === 'resolved' || drop?.status === 'archived'
  const isCorrect   = drop?.outcome === 'correct'

  const statusColor = isResolved
    ? (isCorrect ? '#22c55e' : '#ff3b30')
    : drop?.status === 'extended' ? '#ff9500' : '#c8ff00'

  const statusLabel = isResolved
    ? (isCorrect ? '✓ Correct' : '✗ Incorrect')
    : drop?.status === 'extended' ? 'SWAYZE' : 'Active'

  const resolvesAt = drop
    ? new Date(drop.extended_resolves_at ?? drop.resolves_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  const thesisExcerpt = drop?.thesis
    ? (drop.thesis.length > 160 ? drop.thesis.slice(0, 160) + '…' : drop.thesis)
    : ''

  const creatorRow = Array.isArray(drop?.creator) ? drop.creator[0] : drop?.creator
  const creatorHandle = !drop?.is_anonymous && creatorRow?.username
    ? `@${creatorRow.username as string}`
    : null

  const outcomeHtml = isResolved && drop!.price_change_pct !== null
    ? `<span class="outcome ${isCorrect ? 'correct' : 'incorrect'}">
        ${isCorrect ? '▼' : '▲'}${Math.abs(drop!.price_change_pct).toFixed(1)}%
      </span>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>$${drop?.ticker ?? '???'} on GRZLY</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:      #0a0a0a;
      --surface: #111111;
      --border:  #1f1f1f;
      --text:    #f5f5f5;
      --muted:   #555555;
      --accent:  #c8ff00;
      --hot:     #ff3b30;
    }

    html, body {
      width: 520px;
      height: 200px;
      overflow: hidden;
      background: var(--bg);
      font-family: 'Space Grotesk', system-ui, sans-serif;
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }

    .card {
      display: flex;
      flex-direction: column;
      width: 520px;
      height: 200px;
      padding: 18px 20px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      position: relative;
    }

    .top-row {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      flex: 1;
      min-height: 0;
    }

    .left {
      flex: 1;
      min-width: 0;
    }

    .ticker-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 7px;
    }

    .ticker {
      font-family: 'Space Mono', monospace;
      font-size: 22px;
      font-weight: 700;
      color: var(--accent);
      line-height: 1;
    }

    .company {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 10px;
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      border: 1px solid;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .thesis {
      font-size: 12px;
      color: #999;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      width: 96px;
      padding-left: 14px;
      border-left: 1px solid var(--border);
    }

    .conv-score {
      font-family: 'Space Mono', monospace;
      font-size: 32px;
      font-weight: 700;
      color: var(--hot);
      line-height: 1;
    }

    .conv-label {
      font-family: 'Space Mono', monospace;
      font-size: 8px;
      color: var(--muted);
      letter-spacing: 0.1em;
      margin-top: 4px;
      margin-bottom: 10px;
    }

    .bar-track {
      width: 80px;
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: var(--hot);
      border-radius: 2px;
    }

    .votes {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: var(--muted);
      margin-top: 6px;
    }

    .outcome {
      font-family: 'Space Mono', monospace;
      font-size: 14px;
      font-weight: 700;
      margin-top: 8px;
    }
    .outcome.correct   { color: #22c55e; }
    .outcome.incorrect { color: var(--hot); }

    .bottom-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 10px;
      margin-top: 10px;
      border-top: 1px solid var(--border);
    }

    .meta {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .meta-item {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: var(--muted);
    }

    .view-link {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: var(--accent);
      text-decoration: none;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }
    .view-link:hover { opacity: 1; }

    .wordmark {
      position: absolute;
      top: 16px;
      right: 18px;
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      color: #2a2a2a;
      letter-spacing: 0.2em;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <a href="${dropUrl}" target="_blank" rel="noopener noreferrer" class="wordmark">GRZLY</a>

    <div class="top-row">
      <div class="left">
        <div class="ticker-row">
          <span class="ticker">$${escapeHtml(drop?.ticker ?? '???')}</span>
          ${drop?.company_name ? `<span class="company">${escapeHtml(drop.company_name)}</span>` : ''}
          <span class="status-badge" style="color:${statusColor};border-color:${statusColor}40;background:${statusColor}12;">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        <p class="thesis">${escapeHtml(thesisExcerpt)}</p>
      </div>

      <div class="right">
        <div class="conv-score">${convPct}%</div>
        <div class="conv-label">BEARISH</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${barFill}%"></div>
        </div>
        <div class="votes">${drop?.total_votes ?? 0} votes</div>
        ${outcomeHtml}
      </div>
    </div>

    <div class="bottom-row">
      <div class="meta">
        ${drop?.time_horizon ? `<span class="meta-item">${escapeHtml(drop.time_horizon)}</span>` : ''}
        ${resolvesAt ? `<span class="meta-item">Resolves ${escapeHtml(resolvesAt)}</span>` : ''}
        ${creatorHandle ? `<span class="meta-item">${escapeHtml(creatorHandle)}</span>` : ''}
      </div>
      <a href="${dropUrl}" target="_blank" rel="noopener noreferrer" class="view-link">
        View Drop →
      </a>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      'Content-Security-Policy': 'frame-ancestors *',
      'X-Frame-Options': 'ALLOWALL',
    },
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
