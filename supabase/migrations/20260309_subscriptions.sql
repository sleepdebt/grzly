-- Subscriptions table — synced from Stripe webhooks
-- Tracks Pro plan status per user

create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id   text not null,
  stripe_subscription_id text unique,
  status               text not null default 'inactive',
  -- status values: active, trialing, past_due, canceled, incomplete, inactive
  plan                 text not null default 'free',
  -- plan values: free, pro
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One subscription row per user
create unique index if not exists subscriptions_user_id_key on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);

-- RLS
alter table public.subscriptions enable row level security;

-- Users can only read their own subscription
create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only service role can insert/update (via webhook handler)
-- No insert/update policies for authenticated users

-- Updated at trigger
create or replace function public.handle_subscription_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_subscription_updated
  before update on public.subscriptions
  for each row execute procedure public.handle_subscription_updated();
