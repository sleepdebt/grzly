-- Migration: 003_waitlist_signups
-- Stores email signups from the pre-launch waitlist landing page

create table if not exists waitlist_signups (
  id          uuid        default gen_random_uuid() primary key,
  email       text        not null,
  source      text        not null default 'hero',  -- 'hero' | 'bottom'
  created_at  timestamptz default now() not null,

  constraint waitlist_signups_email_key unique (email)
);

alter table waitlist_signups enable row level security;

-- Public inserts allowed (unauthenticated form)
create policy "allow_public_waitlist_insert"
  on waitlist_signups
  for insert
  to anon, authenticated
  with check (true);

-- Only service role can read (for admin export)
create policy "service_role_can_read_waitlist"
  on waitlist_signups
  for select
  using (auth.role() = 'service_role');
