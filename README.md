# GRZLY — Developer Handoff

**Version:** 1.0
**Stack:** Next.js 14 (App Router) · TypeScript · Supabase · Tailwind CSS · Vercel
**Last Updated:** March 3, 2026

---

## What is GRZLY?

GRZLY is a collective short-conviction platform. Users publish structured short theses ("Drops") on publicly traded stocks. The community votes conviction. Outcomes are tracked against real market data. The best predictors build public accuracy track records ("Vibelords"). All resolved Drops are archived in the Bear Book.

**No trades are executed.** GRZLY is a prediction and research platform only.

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works for dev)
- A [Polygon.io](https://polygon.io) account ($29/mo Starter)
- A [Finnhub](https://finnhub.io) account (free tier)
- An [OpenAI](https://platform.openai.com) API key (for lore generation)
- A Reddit API app (free, registered at https://www.reddit.com/prefs/apps)

### 2. Clone and install

```bash
git clone <your-repo>
cd grzly
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

See `.env.example` for descriptions of each variable.

### 4. Initialize Supabase

Run the schema SQL in your Supabase SQL Editor:

1. Open your Supabase project → SQL Editor
2. Paste the full contents of `../GRZLY_Schema.sql`
3. Run it — this creates all tables, enums, functions, triggers, RLS policies, and realtime subscriptions

### 5. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (fonts, providers, nav)
│   ├── page.tsx                  # Feed (/) — lists active Drops
│   ├── drops/
│   │   ├── create/
│   │   │   └── page.tsx          # Drop creation form (4-step)
│   │   └── [id]/
│   │       └── page.tsx          # Drop detail page
│   ├── bear-book/
│   │   └── page.tsx              # Bear Book (resolved Drops archive)
│   ├── profile/
│   │   └── [username]/
│   │       └── page.tsx          # Vibelord public profile
│   └── api/
│       └── drops/
│           ├── route.ts          # GET /api/drops · POST /api/drops
│           └── [id]/
│               ├── route.ts      # GET /api/drops/:id
│               └── vote/
│                   └── route.ts  # POST /api/drops/:id/vote
│
├── components/
│   ├── drops/
│   │   ├── DropCard.tsx          # Card used on feed and Bear Book
│   │   ├── DropFeed.tsx          # Feed with filters + sort
│   │   ├── ConvictionMeter.tsx   # The big % readout + vote buttons
│   │   └── LoreBlock.tsx         # AI lore narrative display
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx             # Status badges (Active / Hot / SWAYZE)
│       └── Tooltip.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client (singleton)
│   │   └── server.ts             # Server-side Supabase client (SSR)
│   ├── polygon.ts                # Polygon.io price data helpers
│   ├── finnhub.ts                # Finnhub news helpers
│   └── lore.ts                   # AI lore generation (OpenAI/Claude)
│
└── types/
    └── index.ts                  # All TypeScript types derived from schema
```

---

## Key Architectural Decisions

### App Router + SSR for SEO
Drop detail pages and the Bear Book are server-rendered (`async` page components) to ensure search engines can index thesis content and Bear Book outcomes. The feed uses client-side data fetching after initial SSR for real-time conviction score updates.

### Supabase Realtime for conviction scores
Conviction scores update live on Drop detail pages via Supabase Realtime channels. Subscribe to the `drops` table filtered by `id` on the detail page component. No polling needed.

```typescript
// Example subscription pattern
const channel = supabase
  .channel('drop-conviction')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'drops',
    filter: `id=eq.${dropId}`
  }, (payload) => {
    setConvictionScore(payload.new.conviction_score);
  })
  .subscribe();
```

### Lore generation as a server action
Lore is generated server-side (Edge Function or Server Action) on Drop state transitions. Never generated client-side — the prompt and model version must be logged to `lore_events` on every call for auditability.

### Conviction score computation
Handled entirely in the database via trigger (`after_vote_insert`). The frontend never computes conviction — it only reads `drops.conviction_score` and `drops.raw_conviction_pct`.

### SWAYZE extension
A Drop can only be extended once (`was_extended = false` check before allowing). On extension:
1. Update `drops.status` → `'extended'`
2. Set `swayze_reason`, `extended_at`, `extended_resolves_at`
3. Set `accuracy_weight = 0.85` (applied at resolution if correct)
4. Trigger lore generation for the extension narrative

---

## API Routes

### `GET /api/drops`

Returns paginated active Drops for the feed.

**Query params:**
- `sort`: `conviction` | `recent` | `expiring` (default: `conviction`)
- `horizon`: `7` | `30` | `90` | `180` (days, optional filter)
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 50)

### `POST /api/drops`

Creates a new Drop. Requires authentication.

**Body:**
```json
{
  "ticker": "TSLA",
  "thesis": "...",
  "evidence_links": ["https://..."],
  "financial_metric": "P/E 120x vs sector 22x",
  "time_horizon": "30 days",
  "target_price": null,
  "is_anonymous": false
}
```

On success, triggers lore generation and returns the full Drop object.

### `GET /api/drops/:id`

Returns a single Drop with full detail including lore narrative, price snapshot data, and Reddit mention count.

### `POST /api/drops/:id/vote`

Casts a conviction vote. Requires authentication. One vote per user per Drop (enforced at DB level).

**Body:**
```json
{
  "direction": "bearish" | "skeptical"
}
```

---

## Environment Variables

See `.env.example` for the full list. Key groups:

| Group | Variables |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Polygon.io | `POLYGON_API_KEY` |
| Finnhub | `FINNHUB_API_KEY` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_LORE_MODEL` |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| App | `NEXT_PUBLIC_APP_URL`, `LORE_PROMPT_VERSION` |

---

## Supabase Setup Notes

### Auth
Email/password auth is enabled by default. To add Google OAuth:
1. Supabase Dashboard → Authentication → Providers → Google
2. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
3. Set redirect URL to `{YOUR_URL}/auth/callback`

### RLS
All tables have Row Level Security enabled. Key policies:
- **Drops**: public read; authenticated insert; creator-only update
- **Votes**: public read; authenticated insert; no update/delete (immutable)
- **Notifications**: owner read/update only
- **Lore events**: public read; server-only write (use `SUPABASE_SERVICE_ROLE_KEY`)

### Cron jobs (Vercel)
Three cron jobs must be configured in `vercel.json`:
1. **Price snapshot** — daily at market close (4:30 PM ET): fetch Polygon closing prices for all active Drop tickers
2. **Drop resolution** — daily at 9:00 AM ET: check `resolves_at` for any expired Drops, compute outcomes, trigger Bear Book lore
3. **Reddit scraper** — every 4 hours: scrape 5 subreddits, extract tickers, upsert to `reddit_posts`

---

## Design System

Reference the HTML prototypes for visual spec:
- `../drop_creation_ui.html` — Drop creation 4-step form
- `../feed_and_detail.html` — Feed, Drop Detail, Bear Book, Vibelord Profile
- `../waitlist.html` — Landing/waitlist page

**Core tokens:**
```css
--bg: #0a0a0a;
--surface: #111111;
--border: #1e1e1e;
--text: #e8e8e8;
--text-muted: #666666;
--accent: #c8ff00;   /* lime green — conviction, CTAs */
--red: #ff3b30;      /* hot drops, incorrect outcomes */
--orange: #ff9500;   /* SWAYZE extended drops */
```

**Fonts (Google Fonts):**
- Body: `Space Grotesk` (400, 500, 600)
- Mono: `Space Mono` (400, 700) — used for prices, scores, tickers

---

## Lore Engine

The lore engine generates narrative text on 4 trigger events. All calls must:
1. Be made server-side only (never expose API keys to client)
2. Log the result to `lore_events` with `prompt_version` and `model_used`
3. Fall back to a default template string if the API call fails (never break a Drop state transition due to lore failure)

**Prompt tone:** Dark, ritualistic, internet-native. Think Dune crossed with WSB. Second-person, present tense, dramatic.

See `src/lib/lore.ts` for prompt templates and the `generateLore()` function.

---

## Week-by-Week Build Sequence

| Weeks | Milestone |
|---|---|
| 1–2 | Supabase schema ✅ · Auth + profile creation · Drop CRUD API · Polygon price fetch · Feed page (SSR) |
| 3–4 | Drop creation form (4-step) · Conviction voting · Drop lifecycle state machine · AI lore engine |
| 5–6 | Reddit scraper cron · Finnhub news on detail page · Bear Book page · Drop resolution cron |
| 7–8 | Vibelord accuracy scores · SWAYZE/KEANU UI · Lore polish · Waitlist flow · Launch |

---

## Legal Reminder

GRZLY operates under the Investment Advisers Act publisher's exclusion. Before public launch:
- Ensure "not financial advice" disclaimers appear on all pages (see waitlist.html footer for copy)
- Never hold proprietary positions related to any active Drop
- Require evidence-backed theses at creation (200 char min + one evidence type)
- One-time fintech attorney review recommended before public launch

---

*Questions? Review the PRD: `../GRZLY_MVP_PRD.md`*
