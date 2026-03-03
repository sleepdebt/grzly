-- ============================================================
-- GRZLY — Supabase Schema
-- Version: 0.1
-- Updated: 2026-03-03
-- ============================================================
-- Run this in Supabase SQL Editor to initialize the database.
-- Enable Row Level Security (RLS) on all tables after creation.
-- ============================================================


-- ------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for ticker/text search


-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------

create type drop_status as enum (
  'active',
  'extended',   -- SWAYZE: creator extended the time horizon
  'resolved',   -- KEANU: closed at time horizon, outcome computed
  'archived'    -- moved to Bear Book
);

create type drop_outcome as enum (
  'correct',      -- price declined from baseline by resolution date
  'incorrect',    -- price did not decline
  'inconclusive'  -- data unavailable or drop cancelled
);

create type vote_direction as enum (
  'bearish',    -- agrees with the short thesis
  'skeptical'   -- disagrees
);

create type swayze_reason as enum (
  'catalyst_delayed',   -- waiting on a specific event; thesis unchanged
  'timing_off',         -- timing was wrong, fundamental argument intact
  'new_information'     -- new data or development extends the timeline
);

create type lore_event as enum (
  'creation',          -- Drop first published
  'conviction_surge',  -- crossed >75% bearish with >25 votes
  'extension',         -- SWAYZE extension triggered
  'resolution'         -- KEANU — Drop resolved, Bear Book entry generated
);


-- ------------------------------------------------------------
-- USERS (extends Supabase auth.users)
-- ------------------------------------------------------------
-- Note: auth.users is managed by Supabase Auth.
-- This table stores public profile data only.

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique not null,
  display_name        text,
  avatar_url          text,
  bio                 text,

  -- Reputation
  drop_count          integer not null default 0,
  resolved_drop_count integer not null default 0,
  correct_drop_count  integer not null default 0,
  accuracy_score      numeric(5, 2),     -- null until ≥3 resolved drops
                                         -- computed: correct_drop_count / resolved_drop_count

  -- Metadata
  is_anonymous_default boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Index for leaderboard / ranking queries
create index idx_profiles_accuracy on public.profiles (accuracy_score desc nulls last);
create index idx_profiles_drop_count on public.profiles (drop_count desc);


-- ------------------------------------------------------------
-- DROPS
-- ------------------------------------------------------------

create table public.drops (
  id                  uuid primary key default uuid_generate_v4(),
  ticker              text not null,               -- e.g. 'TSLA', 'NVDA'
  company_name        text,                        -- populated from Polygon on creation

  -- Thesis content
  thesis              text not null,               -- 200–2000 chars; main argument
  evidence_links      text[],                      -- array of URLs (optional, supports quality bar)
  financial_metric    text,                        -- e.g. "P/E ratio 120x vs sector avg 22x"
  creator_note        text,                        -- optional plain-text annotation by creator (max 500 chars)

  -- Attribution
  created_by          uuid references public.profiles(id) on delete set null,
  is_anonymous        boolean not null default false,

  -- Lifecycle
  status              drop_status not null default 'active',
  time_horizon        interval not null,           -- e.g. '7 days', '30 days', '90 days', '180 days'
  created_at          timestamptz not null default now(),
  resolves_at         timestamptz not null,        -- created_at + time_horizon
  extended_at          timestamptz,               -- set when SWAYZE triggered
  extended_resolves_at timestamptz,               -- new resolution date after extension
  swayze_reason        swayze_reason,             -- required when SWAYZE is invoked; recorded permanently
  resolved_at         timestamptz,                 -- actual resolution timestamp

  -- Target price (optional — user-defined correctness)
  target_price        numeric(12, 4),              -- null = "any decline"; set = must reach this price

  -- Pricing
  baseline_price      numeric(12, 4),              -- closing price on creation date (from Polygon)
  resolution_price    numeric(12, 4),              -- closing price on resolution date (from Polygon)
  price_change_pct    numeric(8, 4),               -- (resolution_price - baseline_price) / baseline_price * 100

  -- Outcome
  outcome              drop_outcome,               -- null until resolved
  was_extended         boolean not null default false, -- true if SWAYZE was invoked
  accuracy_weight      numeric(4, 3) not null default 1.0, -- 1.0 standard; 0.85 if extended + correct

  -- Conviction (denormalized for performance)
  bearish_votes       integer not null default 0,
  skeptical_votes     integer not null default 0,
  total_votes         integer not null default 0,
  conviction_score    numeric(5, 2),               -- weighted % bearish (by voter accuracy)
  raw_conviction_pct  numeric(5, 2),               -- unweighted % bearish (for comparison)

  -- AI Lore
  lore_narrative      text,                        -- current active lore narrative
  bear_book_narrative text,                        -- generated on resolution

  -- Search
  search_vector       tsvector generated always as (
    to_tsvector('english', coalesce(ticker, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(thesis, ''))
  ) stored
);

-- Indexes
create index idx_drops_ticker on public.drops (ticker);
create index idx_drops_status on public.drops (status);
create index idx_drops_created_by on public.drops (created_by);
create index idx_drops_resolves_at on public.drops (resolves_at);
create index idx_drops_conviction on public.drops (conviction_score desc nulls last);
create index idx_drops_search on public.drops using gin(search_vector);


-- ------------------------------------------------------------
-- VOTES
-- ------------------------------------------------------------

create table public.votes (
  id          uuid primary key default uuid_generate_v4(),
  drop_id     uuid not null references public.drops(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  direction   vote_direction not null,
  -- Snapshot voter accuracy at time of vote (for weighted conviction score computation)
  voter_accuracy_at_vote  numeric(5, 2),
  created_at  timestamptz not null default now(),

  -- One vote per user per drop, immutable
  unique (drop_id, user_id)
);

create index idx_votes_drop_id on public.votes (drop_id);
create index idx_votes_user_id on public.votes (user_id);


-- ------------------------------------------------------------
-- LORE EVENTS
-- Audit log of every AI-generated narrative for a Drop.
-- Enables history, versioning, and prompt debugging.
-- ------------------------------------------------------------

create table public.lore_events (
  id              uuid primary key default uuid_generate_v4(),
  drop_id         uuid not null references public.drops(id) on delete cascade,
  event_type      lore_event not null,
  narrative       text not null,
  prompt_version  text,                  -- e.g. 'v1.2' — version-controlled prompt identifier
  model_used      text,                  -- e.g. 'gpt-4o', 'claude-3-5-sonnet'
  created_at      timestamptz not null default now()
);

create index idx_lore_events_drop_id on public.lore_events (drop_id);


-- ------------------------------------------------------------
-- REDDIT POSTS
-- Scraped from r/wallstreetbets, r/stocks, r/Superstonk,
-- r/investing, r/SecurityAnalysis every 4 hours.
-- ------------------------------------------------------------

create table public.reddit_posts (
  id                  uuid primary key default uuid_generate_v4(),
  reddit_post_id      text unique not null,         -- Reddit's native post ID (dedupe key)
  subreddit           text not null,
  title               text not null,
  body                text,
  upvotes             integer not null default 0,
  comment_count       integer not null default 0,
  author              text,
  reddit_url          text,
  posted_at           timestamptz not null,
  tickers_mentioned   text[],                       -- extracted via regex, e.g. ['TSLA', 'NVDA']
  scraped_at          timestamptz not null default now()
);

-- Indexes for ticker lookup (used on Drop detail page)
create index idx_reddit_posts_tickers on public.reddit_posts using gin(tickers_mentioned);
create index idx_reddit_posts_posted_at on public.reddit_posts (posted_at desc);
create index idx_reddit_posts_subreddit on public.reddit_posts (subreddit);


-- ------------------------------------------------------------
-- PRICE SNAPSHOTS
-- Daily closing prices for tickers with active Drops.
-- Sourced from Polygon.io via cron job.
-- ------------------------------------------------------------

create table public.price_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  ticker      text not null,
  price       numeric(12, 4) not null,
  snapshot_date date not null,
  source      text not null default 'polygon',
  recorded_at timestamptz not null default now(),

  unique (ticker, snapshot_date)
);

create index idx_price_snapshots_ticker_date on public.price_snapshots (ticker, snapshot_date desc);


-- ------------------------------------------------------------
-- SHORT INTEREST
-- Loaded from FINRA batch data twice monthly.
-- ------------------------------------------------------------

create table public.short_interest (
  id                    uuid primary key default uuid_generate_v4(),
  ticker                text not null,
  settlement_date       date not null,
  short_interest_shares bigint,              -- number of shares short
  float_shares          bigint,              -- total float
  short_pct_float       numeric(6, 3),       -- short_interest_shares / float_shares * 100
  days_to_cover         numeric(6, 2),       -- short interest / avg daily volume
  source                text not null default 'finra',
  loaded_at             timestamptz not null default now(),

  unique (ticker, settlement_date)
);

create index idx_short_interest_ticker on public.short_interest (ticker, settlement_date desc);


-- ------------------------------------------------------------
-- NOTIFICATIONS
-- In-app only for MVP (email notifications are P1).
-- ------------------------------------------------------------

create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  drop_id     uuid references public.drops(id) on delete set null,
  type        text not null,        -- 'expiry_warning' | 'drop_resolved' | 'conviction_surge'
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications (user_id, is_read, created_at desc);


-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.drops            enable row level security;
alter table public.votes            enable row level security;
alter table public.lore_events      enable row level security;
alter table public.reddit_posts     enable row level security;
alter table public.price_snapshots  enable row level security;
alter table public.short_interest   enable row level security;
alter table public.notifications    enable row level security;

-- Profiles: public read, owner write
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Drops: public read, authenticated create, owner update (status changes only)
create policy "Drops are viewable by everyone"
  on public.drops for select using (true);
create policy "Authenticated users can create drops"
  on public.drops for insert with check (auth.uid() = created_by);
create policy "Drop creators can update their own drops"
  on public.drops for update using (auth.uid() = created_by);

-- Votes: public read (for conviction score), authenticated insert, no update/delete
create policy "Votes are viewable by everyone"
  on public.votes for select using (true);
create policy "Authenticated users can cast votes"
  on public.votes for insert with check (auth.uid() = user_id);

-- Lore events: public read, no user writes (written by server/edge function only)
create policy "Lore events are viewable by everyone"
  on public.lore_events for select using (true);

-- Reddit posts, price snapshots, short interest: public read, no user writes
create policy "Reddit posts are viewable by everyone"
  on public.reddit_posts for select using (true);
create policy "Price snapshots are viewable by everyone"
  on public.price_snapshots for select using (true);
create policy "Short interest is viewable by everyone"
  on public.short_interest for select using (true);

-- Notifications: owner read only
create policy "Users can view their own notifications"
  on public.notifications for select using (auth.uid() = user_id);
create policy "Users can mark their own notifications read"
  on public.notifications for update using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- FUNCTIONS
-- ------------------------------------------------------------

-- Recompute a Drop's conviction score after a new vote.
-- Called by trigger on votes insert.
-- Weighted by voter accuracy (defaults to 0.5 if no track record yet).
create or replace function recompute_conviction_score(p_drop_id uuid)
returns void language plpgsql as $$
declare
  v_weighted_bearish  numeric := 0;
  v_total_weight      numeric := 0;
  v_raw_bearish       integer := 0;
  v_total_votes       integer := 0;
begin
  select
    sum(case when direction = 'bearish' then coalesce(voter_accuracy_at_vote, 0.5) else 0 end),
    sum(coalesce(voter_accuracy_at_vote, 0.5)),
    count(case when direction = 'bearish' then 1 end),
    count(*)
  into v_weighted_bearish, v_total_weight, v_raw_bearish, v_total_votes
  from public.votes
  where drop_id = p_drop_id;

  update public.drops set
    bearish_votes     = v_raw_bearish,
    skeptical_votes   = v_total_votes - v_raw_bearish,
    total_votes       = v_total_votes,
    conviction_score  = case when v_total_weight > 0 then round((v_weighted_bearish / v_total_weight) * 100, 2) else null end,
    raw_conviction_pct = case when v_total_votes > 0 then round((v_raw_bearish::numeric / v_total_votes) * 100, 2) else null end
  where id = p_drop_id;
end;
$$;

-- Trigger: recompute conviction after every vote insert
create or replace function trigger_recompute_conviction()
returns trigger language plpgsql as $$
begin
  perform recompute_conviction_score(new.drop_id);
  return new;
end;
$$;

create trigger after_vote_insert
  after insert on public.votes
  for each row execute function trigger_recompute_conviction();


-- Recompute a profile's accuracy score after a Drop resolves.
create or replace function recompute_accuracy_score(p_user_id uuid)
returns void language plpgsql as $$
declare
  v_resolved  integer;
  v_correct   integer;
begin
  select
    count(*) filter (where outcome in ('correct', 'incorrect')),
    count(*) filter (where outcome = 'correct')
  into v_resolved, v_correct
  from public.drops
  where created_by = p_user_id and is_anonymous = false;

  update public.profiles set
    resolved_drop_count = v_resolved,
    correct_drop_count  = v_correct,
    accuracy_score      = case when v_resolved >= 3 then round((v_correct::numeric / v_resolved) * 100, 2) else null end,
    updated_at          = now()
  where id = p_user_id;
end;
$$;


-- ------------------------------------------------------------
-- REALTIME
-- Enable Supabase Realtime on tables that need live updates.
-- ------------------------------------------------------------

-- Enable realtime on drops (conviction score updates)
alter publication supabase_realtime add table public.drops;

-- Enable realtime on notifications (in-app alerts)
alter publication supabase_realtime add table public.notifications;


-- ------------------------------------------------------------
-- SEED: Supported time horizons (for UI validation)
-- These are the only valid values for drops.time_horizon
-- '7 days'::interval, '30 days'::interval, '90 days'::interval, '180 days'::interval
-- ------------------------------------------------------------
