-- Migration 004: Auto-create profile row when a new Supabase Auth user signs up
--
-- The sign-up page passes username via:
--   supabase.auth.signUp({ options: { data: { username: 'chosen_name' } } })
-- That lands in auth.users.raw_user_meta_data->>'username'.
--
-- Fallback: if username is missing/blank, generate from email prefix + 6-char ID suffix.
-- On conflict (rare race condition): append ID suffix to keep unique constraint happy.

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

-- Drop if exists (idempotent re-run)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
