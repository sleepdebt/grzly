// GET /api/profile/[username]/card
// Returns a standalone HTML embed card — suitable for <iframe> embeds
// No nav, no footer, no GRZLY chrome — just the profile card

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const supabase = createServiceRoleClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url, bio, accuracy_score, drop_count, resolved_drop_count, correct_drop_count')
    .eq('username', username)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://grzly.io'
  const profileUrl = `${appUrl}/profile/${username}`

  const showAccuracy = !!profile && profile.resolved_drop_count >= 3
  const initials = profile ? profile.username.slice(0, 2).toUpperCase() : '??'

  const avatarHtml = profile?.avatar_url
    ? `<img src="${profile.avatar_url}" alt="@${profile.username}" class="avatar-img" />`
    : `<div class="avatar-initials">${initials}</div>`

  const accuracyHtml = showAccuracy && profile!.accuracy_score !== null
    ? `<div class="accuracy-block">
        <div class="accuracy-score">${profile!.accuracy_score.toFixed(0)}%</div>
        <div class="accuracy-label">Accuracy</div>
      </div>`
    : ''

  const bioHtml = profile?.bio
    ? `<p class="bio">${escapeHtml(profile.bio)}</p>`
    : ''

  const statsHtml = profile
    ? `<div class="stats">
        <div class="stat"><span class="stat-value">${profile.drop_count}</span><span class="stat-label">Drops</span></div>
        <div class="stat"><span class="stat-value">${profile.correct_drop_count}</span><span class="stat-label">Correct</span></div>
        <div class="stat"><span class="stat-value">${profile.resolved_drop_count}</span><span class="stat-label">Resolved</span></div>
      </div>`
    : `<p style="color:#555;font-size:13px;">Profile not found.</p>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>@${profile?.username ?? username} on GRZLY</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0a0a;
      --surface: #111111;
      --border: #1f1f1f;
      --text: #f5f5f5;
      --muted: #666666;
      --accent: #c8ff00;
    }

    html, body {
      width: 420px;
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
      width: 420px;
      height: 200px;
      padding: 20px 22px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      position: relative;
    }

    .top-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      flex: 1;
    }

    .avatar-img {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #222;
      flex-shrink: 0;
    }

    .avatar-initials {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #1a1a1a;
      border: 2px solid #222;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Space Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: var(--accent);
      flex-shrink: 0;
    }

    .identity {
      flex: 1;
      min-width: 0;
    }

    .username {
      font-family: 'Space Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bio {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .accuracy-block {
      flex-shrink: 0;
      text-align: right;
      padding-left: 16px;
      border-left: 1px solid var(--border);
    }

    .accuracy-score {
      font-family: 'Space Mono', monospace;
      font-size: 36px;
      font-weight: 700;
      color: var(--accent);
      line-height: 1;
    }

    .accuracy-label {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: #444;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-top: 5px;
    }

    .bottom-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      margin-top: 14px;
      border-top: 1px solid var(--border);
    }

    .stats {
      display: flex;
      gap: 20px;
    }

    .stat {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-family: 'Space Mono', monospace;
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      line-height: 1;
    }

    .stat-label {
      font-size: 10px;
      color: var(--muted);
      margin-top: 3px;
    }

    .view-link {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: var(--accent);
      text-decoration: none;
      letter-spacing: 0.05em;
      opacity: 0.8;
    }

    .view-link:hover { opacity: 1; }

    .wordmark {
      position: absolute;
      top: 18px;
      right: 20px;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      color: #333;
      letter-spacing: 0.2em;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="wordmark">GRZLY</a>

    <div class="top-row">
      ${avatarHtml}
      <div class="identity">
        <div class="username">@${profile?.username ?? username}</div>
        ${bioHtml}
      </div>
      ${accuracyHtml}
    </div>

    <div class="bottom-row">
      ${statsHtml}
      <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="view-link">
        View profile →
      </a>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      // Allow embedding in iframes from any origin
      'Content-Security-Policy': "frame-ancestors *",
      // Override any inherited X-Frame-Options
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
