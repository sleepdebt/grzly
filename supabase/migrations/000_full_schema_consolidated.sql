-- ============================================================
-- GRZLY — Full Consolidated Schema
-- Combines: base schema + migrations 001–005
-- Run this ONCE in the Supabase SQL Editor.
-- ============================================================
-- Order:
--   0. Clean slate (drop existing GRZLY objects so this is re-runnable)
--   1. Base schema  (tables, enums, RLS, functions, realtime)
--   2. 001  reddit_mention_count column on drops
--   3. 002  live_price_change_pct + named unique on price_snapshots
--   4. 003  waitlist_signups table
--   5. 004  auth trigger (auto-create profile on signup)  ← CRITICAL
--   6. 005  drop_count trigger (increment on insert)
-- ============================================================


-- ============================================================
-- PART 0 — CLEAN SLATE
-- Drops all GRZLY objects so this file is safely re-runnable.
-- Safe for dev — no real user data exists yet.
-- ============================================================

drop table if exists public.waitlist_signups  cascade;
drop table if exists public.notifications     cascade;
drop table if exists public.short_interest    cascade;
drop table if exists public.price_snapshots   cascade;
drop table if exists public.reddit_posts      cascade;
drop table if exists public.lore_events       cascade;
drop table if exists public.votes             cascade;
drop table if exists public.drops             cascade;
drop table if exists public.profiles          cascade;

drop type if exists lore_event    cascade;
drop type if exists swayze_reason cascade;
drop type if exists vote_direction cascade;
drop type if exists drop_outcome  cascade;
drop type if exists drop_status   cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.increment_profile_drop_count() cascade;
drop function if exists public.recompute_conviction_score(uuid) cascade;
drop function if exists public.trigger_recompute_conviction() cascade;
drop function if exists public.recompute_accuracy_score(uuid) cascade;


-- ============================================================
-- PART 1 — BASE SCHEMA
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";


-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------

create type drop_status as enum (
  'active',
  'extended',
  'resolved',
  'archived'
);

create type drop_outcome as enum (
  'correct',
  'incorrect',
  'inconclusive'
);

create type vote_direction as enum (
  'bearish',
  'skeptical'
);

create type swayze_reason as enum (
  'catalyst_delayed',
  'timing_off',
  'new_information'
);

create type lore_event as enum (
  'creation',
  'conviction_surge',
  'extension',
  'resolution'
);


-- ------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ------------------------------------------------------------

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  username              text unique not null,
  display_name          text,
  avatar_url            text,
  bio                   text,

  drop_count            integer not null default 0,
  resolved_drop_count   integer not null default 0,
  correct_drop_count    integer not null default 0,
  accuracy_score        numeric(5, 2),

  is_anonymous_default  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_profiles_accuracy   on public.profiles (accuracy_score desc nulls last);
create index idx_profiles_drop_count on public.profiles (drop_count desc);


-- ------------------------------------------------------------
-- DROPS
-- ------------------------------------------------------------

create table public.drops (
  id                    uuid primary key default uuid_generate_v4(),
  ticker                text not null,
  company_name          text,

  thesis                text not null,
  evidence_links        text[],
  financial_metric      text,
  creator_note          text,

  created_by            uuid references public.profiles(id) on delete set null,
  is_anonymous          boolean not null default false,

  status                drop_status not null default 'active',
  time_horizon          interval not null,
  created_at            timestamptz not null default now(),
  resolves_at           timestamptz not null,
  extended_at           timestamptz,
  extended_resolves_at  timestamptz,
  swayze_reason         swayze_reason,
  resolved_at           timestamptz,

  target_price          numeric(12, 4),

  baseline_price        numeric(12, 4),
  resolution_price      numeric(12, 4),
  price_change_pct      numeric(8, 4),

  outcome               drop_outcome,
  was_extended          boolean not null default false,
  accuracy_weight       numeric(4, 3) not null default 1.0,

  bearish_votes         integer not null default 0,
  skeptical_votes       integer not null default 0,
  total_votes           integer not null default 0,
  conviction_score      numeric(5, 2),
  raw_conviction_pct    numeric(5, 2),

  lore_narrative        text,
  bear_book_narrative   text,

  search_vector         tsvector generated always as (
    to_tsvector('english',
      coalesce(ticker, '') || ' ' ||
      coalesce(company_name, '') || ' ' ||
      coalesce(thesis, '')
    )
  ) stored
);

create index idx_drops_ticker      on public.drops (ticker);
create index idx_drops_status      on public.drops (status);
create index idx_drops_created_by  on public.drops (created_by);
create index idx_drops_resolves_at on public.drops (resolves_at);
create index idx_drops_conviction  on public.drops (conviction_score desc nulls last);
create index idx_drops_search      on public.drops using gin(search_vector);


-- ------------------------------------------------------------
-- VOTES
-- ------------------------------------------------------------

create table public.votes (
  id                      uuid primary key default uuid_generate_v4(),
  drop_id                 uuid not null references public.drops(id) on delete cascade,
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  direction               vote_direction not null,
  voter_accuracy_at_vote  numeric(5, 2),
  created_at              timestamptz not null default now(),

  unique (drop_id, user_id)
);

create index idx_votes_drop_id on public.votes (drop_id);
create index idx_votes_user_id on public.votes (user_id);


-- ------------------------------------------------------------
-- LORE EVENTS
-- ------------------------------------------------------------

create table public.lore_events (
  id              uuid primary key default uuid_generate_v4(),
  drop_id         uuid not null references public.drops(id) on delete cascade,
  event_type      lore_event not null,
  narrative       text not null,
  prompt_version  text,
  model_used      text,
  created_at      timestamptz not null default now()
);

create index idx_lore_events_drop_id on public.lore_events (drop_id);


-- ------------------------------------------------------------
-- REDDIT POSTS
-- ------------------------------------------------------------

create table public.reddit_posts (
  id                uuid primary key default uuid_generate_v4(),
  reddit_post_id    text unique not null,
  subreddit         text not null,
  title             text not null,
  body              text,
  upvotes           integer not null default 0,
  comment_count     integer not null default 0,
  author            text,
  reddit_url        text,
  posted_at         timestamptz not null,
  tickers_mentioned text[],
  scraped_at        timestamptz not null default now()
);

create index idx_reddit_posts_tickers   on public.reddit_posts using gin(tickers_mentioned);
create index idx_reddit_posts_posted_at on public.reddit_posts (posted_at desc);
create index idx_reddit_posts_subreddit on public.reddit_posts (subreddit);


-- ------------------------------------------------------------
-- PRICE SNAPSHOTS
-- (No inline unique here — Migration 002 adds the named constraint)
-- ------------------------------------------------------------

create table public.price_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  ticker        text not null,
  price         numeric(12, 4) not null,
  snapshot_date date not null,
  source        text not null default 'polygon',
  recorded_at   timestamptz not null default now()
);

create index idx_price_snapshots_ticker_date on public.price_snapshots (ticker, snapshot_date desc);


-- ------------------------------------------------------------
-- SHORT INTEREST
-- ------------------------------------------------------------

create table public.short_interest (
  id                    uuid primary key default uuid_generate_v4(),
  ticker                text not null,
  settlement_date       date not null,
  short_interest_shares bigint,
  float_shares          bigint,
  short_pct_float       numeric(6, 3),
  days_to_cover         numeric(6, 2),
  source                text not null default 'finra',
  loaded_at             timestamptz not null default now(),

  unique (ticker, settlement_date)
);

create index idx_short_interest_ticker on public.short_interest (ticker, settlement_date desc);


-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------

create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  drop_id     uuid references public.drops(id) on delete set null,
  type        text not null,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_id on public.notifications (user_id, is_read, created_at desc);


-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.drops            enable row level security;
alter table public.votes            enable row level security;
alter table public.lore_events      enable row level security;
alter table public.reddit_posts     enable row level security;
alter table public.price_snapshots  enable row level security;
alter table public.short_interest   enable row level security;
alter table public.notifications    enable row level security;

-- Profiles
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Drops
create policy "Drops are viewable by everyone"
  on public.drops for select using (true);
create policy "Authenticated users can create drops"
  on public.drops for insert with check (auth.uid() = created_by);
create policy "Drop creators can update their own drops"
  on public.drops for update using (auth.uid() = created_by);

-- Votes
create policy "Votes are viewable by everyone"
  on public.votes for select using (true);
create policy "Authenticated users can cast votes"
  on public.votes for insert with check (auth.uid() = user_id);

-- Lore events: public read, no user writes (service role only)
create policy "Lore events are viewable by everyone"
  on public.lore_events for select using (true);

-- Reddit posts / price snapshots / short interest: public read
create policy "Reddit posts are viewable by everyone"
  on public.reddit_posts for select using (true);
create policy "Price snapshots are viewable by everyone"
  on public.price_snapshots for select using (true);
create policy "Short interest is viewable by everyone"
  on public.short_interest for select using (true);

-- Notifications: owner only
create policy "Users can view their own notifications"
  on public.notifications for select using (auth.uid() = user_id);
create policy "Users can mark their own notifications read"
  on public.notifications for update using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- FUNCTIONS
-- ------------------------------------------------------------

-- Recompute conviction score after a vote
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
    bearish_votes      = v_raw_bearish,
    skeptical_votes    = v_total_votes - v_raw_bearish,
    total_votes        = v_total_votes,
    conviction_score   = case when v_total_weight > 0
                           then round((v_weighted_bearish / v_total_weight) * 100, 2)
                           else null end,
    raw_conviction_pct = case when v_total_votes > 0
                           then round((v_raw_bearish::numeric / v_total_votes) * 100, 2)
                           else null end
  where id = p_drop_id;
end;
$$;

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


-- Recompute accuracy score when a drop resolves
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
    accuracy_score      = case when v_resolved >= 3
                            then round((v_correct::numeric / v_resolved) * 100, 2)
                            else null end,
    updated_at          = now()
  where id = p_user_id;
end;
$$;


-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------

alter publication supabase_realtime add table public.drops;
alter publication supabase_realtime add table public.notifications;


-- ============================================================
-- PART 2 — MIGRATION 001: reddit_mention_count
-- ============================================================

alter table public.drops
  add column if not exists reddit_mention_count integer not null default 0;

comment on column public.drops.reddit_mention_count is
  'Denormalized 7-day rolling Reddit mention count. Refreshed by reddit-scraper cron every 4h.';

create index if not exists idx_drops_reddit_mention_count
  on public.drops (reddit_mention_count desc)
  where status in ('active', 'extended');


-- ============================================================
-- PART 3 — MIGRATION 002: live_price_change_pct + named unique on price_snapshots
-- ============================================================

alter table public.drops
  add column if not exists live_price_change_pct numeric(8, 4);

comment on column public.drops.live_price_change_pct is
  'Denormalized current % change from baseline_price. Refreshed daily by price-snapshot cron at market close.';

-- Add named unique constraint on price_snapshots (required by idempotent cron logic)
alter table public.price_snapshots
  drop constraint if exists price_snapshots_ticker_date_unique;

alter table public.price_snapshots
  add constraint price_snapshots_ticker_date_unique unique (ticker, snapshot_date);


-- ============================================================
-- PART 4 — MIGRATION 003: waitlist_signups
-- ============================================================

create table if not exists public.waitlist_signups (
  id          uuid        default gen_random_uuid() primary key,
  email       text        not null,
  source      text        not null default 'hero',
  created_at  timestamptz default now() not null,

  constraint waitlist_signups_email_key unique (email)
);

alter table public.waitlist_signups enable row level security;

-- Public can submit; only service_role can read
create policy "allow_public_waitlist_insert"
  on public.waitlist_signups
  for insert
  to anon, authenticated
  with check (true);

create policy "service_role_can_read_waitlist"
  on public.waitlist_signups
  for select
  using (auth.role() = 'service_role');


-- ============================================================
-- PART 5 — MIGRATION 004: auth trigger (CRITICAL)
-- Auto-creates a profiles row when a new auth.users row is inserted.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
begin
  -- Prefer username from signup metadata, fall back to email-derived value
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    lower(split_part(new.email, '@', 1)) || '_' || substr(replace(new.id::text, '-', ''), 1, 6)
  );

  insert into public.profiles (id, username)
  values (new.id, v_username)
  on conflict (username) do update
    set username = excluded.username || '_' || substr(replace(new.id::text, '-', ''), 1, 4);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- PART 6 — MIGRATION 005: drop_count trigger
-- Increments profiles.drop_count on every new drop insert.
-- ============================================================

create or replace function public.increment_profile_drop_count()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is not null then
    update public.profiles
    set
      drop_count = drop_count + 1,
      updated_at = now()
    where id = new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists after_drop_insert on public.drops;

create trigger after_drop_insert
  after insert on public.drops
  for each row execute function public.increment_profile_drop_count();


-- ============================================================
-- DONE
-- All tables, RLS policies, triggers, and functions are active.
-- ============================================================
