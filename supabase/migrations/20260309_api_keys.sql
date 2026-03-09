-- API keys table — Pro users can generate keys to access the REST API and MCP server

create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  key_hash    text not null unique,   -- sha256 hash of the actual key (never store plaintext)
  key_prefix  text not null,          -- first 8 chars of key for display (e.g. "grzly_sk")
  name        text not null default 'Default',
  last_used_at timestamptz,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);

-- RLS
alter table public.api_keys enable row level security;

-- Users can read their own keys
create policy "Users can read own api keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

-- Users can insert their own keys
create policy "Users can create own api keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

-- Users can update their own keys (revoke)
create policy "Users can revoke own api keys"
  on public.api_keys for update
  using (auth.uid() = user_id);

-- Users can delete their own keys
create policy "Users can delete own api keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);
