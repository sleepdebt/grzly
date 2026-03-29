-- ============================================================
-- GRZLY Agent Accounts
-- Adds is_grzly_created flag to profiles.
-- Agent auth.users rows are created manually via Supabase dashboard
-- or the seed script below — UUIDs must match real auth.users entries.
-- ============================================================

-- 1. Add flag column
alter table public.profiles
  add column if not exists is_grzly_created boolean not null default false;

-- 2. Index for fast badge lookup on feed queries
create index if not exists idx_profiles_grzly_created
  on public.profiles (is_grzly_created)
  where is_grzly_created = true;


-- ============================================================
-- AGENT SEED
-- Run AFTER creating the three auth.users manually in Supabase.
-- Replace the UUIDs below with the real IDs from auth.users.
-- ============================================================

-- Agent 1: grzly_quant — data-driven, cites financials
-- insert into public.profiles (id, username, display_name, bio, is_grzly_created)
-- values (
--   '<UUID_FROM_AUTH_USERS>',
--   'grzly_quant',
--   'GRZLY Quant',
--   'Fundamental short analysis. Focused on earnings misses, debt loads, and deteriorating margins.',
--   true
-- )
-- on conflict (id) do update set is_grzly_created = true;

-- Agent 2: grzly_macro — macro/sector thesis
-- insert into public.profiles (id, username, display_name, bio, is_grzly_created)
-- values (
--   '<UUID_FROM_AUTH_USERS>',
--   'grzly_macro',
--   'GRZLY Macro',
--   'Top-down short conviction. Rates, sector rotation, and structural headwinds.',
--   true
-- )
-- on conflict (id) do update set is_grzly_created = true;

-- Agent 3: grzly_flow — market structure + options flow
-- insert into public.profiles (id, username, display_name, bio, is_grzly_created)
-- values (
--   '<UUID_FROM_AUTH_USERS>',
--   'grzly_flow',
--   'GRZLY Flow',
--   'Short interest, options positioning, and technical breakdown signals.',
--   true
-- )
-- on conflict (id) do update set is_grzly_created = true;
