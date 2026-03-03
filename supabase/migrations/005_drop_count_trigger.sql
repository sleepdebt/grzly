-- Migration 005: Increment profiles.drop_count when a drop is inserted
--
-- The profile page displays "N Drops" under the username.
-- Without this trigger, drop_count stays at 0 forever for all users.
-- Only counts non-anonymous drops (consistent with accuracy scoring).

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
