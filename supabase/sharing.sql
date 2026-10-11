-- Sharing one baby's sleep log between carers. Applied by hand with execute_sql to the Supabase
-- project eynuujdjarqnwkjofrpw on 4 October 2026, outside that project's migration history.
--
-- No account and no sign-in. A household is found by the hash of a long random key that only
-- the phones holding the share link know. The tables have RLS on and no policies, and the
-- browser roles hold no grants on them, so the four functions below are the only way in.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sleep_households (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  baby jsonb not null default '{}'::jsonb,
  baby_at bigint not null default 0,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  touched_at timestamptz not null default now()
);
-- Added 4 October 2026 with the one-off payment: a log paid for on one phone is paid for on every
-- phone in it.
alter table public.sleep_households add column if not exists paid boolean not null default false;
comment on table public.sleep_households is 'Baby Nap Track. One shared sleep log, found by the SHA-256 of its share key. Reached only through the sleep_ functions.';

create table if not exists public.sleep_entries (
  household_id uuid not null references public.sleep_households(id) on delete cascade,
  id text not null,
  s bigint not null,
  e bigint,
  kind text not null check (kind in ('nap', 'night')),
  up boolean not null default false,
  deleted boolean not null default false,
  updated_at bigint not null,
  server_at timestamptz not null default clock_timestamp(),
  primary key (household_id, id)
);
comment on table public.sleep_entries is 'Baby Nap Track. One sleep in a shared log; times are milliseconds since 1970. Reached only through the sleep_ functions.';
create index if not exists sleep_entries_pull on public.sleep_entries (household_id, server_at);

alter table public.sleep_households enable row level security;
alter table public.sleep_entries enable row level security;
revoke all on public.sleep_households, public.sleep_entries from anon, authenticated;

create or replace function public.sleep_hash(p_key text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_key, 'sha256'), 'hex')
$$;

-- Writes the rows it is given, keeping whichever copy of a sleep was changed last.
create or replace function public.sleep_write(h uuid, p_baby jsonb, p_baby_at bigint, p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 5000 then raise exception 'too many rows'; end if;
  if p_baby is not null then
    update public.sleep_households set baby = p_baby, baby_at = p_baby_at, touched_at = now()
    where id = h and p_baby_at > baby_at;
  end if;
  insert into public.sleep_entries (household_id, id, s, e, kind, up, deleted, updated_at)
  select h, r->>'id', (r->>'s')::bigint, (r->>'e')::bigint, r->>'kind',
         coalesce((r->>'up')::boolean, false), coalesce((r->>'deleted')::boolean, false), (r->>'updated_at')::bigint
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (household_id, id) do update
    set s = excluded.s, e = excluded.e, kind = excluded.kind, up = excluded.up, deleted = excluded.deleted,
        updated_at = excluded.updated_at, server_at = clock_timestamp()
    where excluded.updated_at > public.sleep_entries.updated_at;
end $$;

-- The first phone to share makes the household and sends the whole log.
create or replace function public.sleep_create(p_key text, p_baby jsonb, p_baby_at bigint, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  if p_key is null or length(p_key) < 24 then raise exception 'bad key'; end if;
  insert into public.sleep_households (key_hash, baby, baby_at)
  values (public.sleep_hash(p_key), coalesce(p_baby, '{}'::jsonb), coalesce(p_baby_at, 0))
  returning id into h;
  perform public.sleep_write(h, null, 0, p_rows);
  return jsonb_build_object('now', clock_timestamp());
end $$;

create or replace function public.sleep_push(p_key text, p_baby jsonb, p_baby_at bigint, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  select id into h from public.sleep_households where key_hash = public.sleep_hash(p_key);
  if h is null then raise exception 'no such log' using errcode = 'P0002'; end if;
  perform public.sleep_write(h, p_baby, p_baby_at, p_rows);
  return jsonb_build_object('now', clock_timestamp());
end $$;

-- Everything changed since the phone last asked, and the baby's details.
create or replace function public.sleep_pull(p_key text, p_since timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.sleep_households;
begin
  select * into h from public.sleep_households where key_hash = public.sleep_hash(p_key);
  if h.id is null then raise exception 'no such log' using errcode = 'P0002'; end if;
  update public.sleep_households set touched_at = now() where id = h.id;
  return jsonb_build_object(
    'now', clock_timestamp(), 'baby', h.baby, 'baby_at', h.baby_at, 'paid', h.paid,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 's', s, 'e', e, 'kind', kind, 'up', up, 'deleted', deleted, 'updated_at', updated_at))
      from public.sleep_entries where household_id = h.id and (p_since is null or server_at > p_since)
    ), '[]'::jsonb));
end $$;

-- Marks the log as paid for, once a phone in it has paid for the nap times.
create or replace function public.sleep_paid(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.sleep_households set paid = true, touched_at = now() where key_hash = public.sleep_hash(p_key);
  if not found then raise exception 'no such log' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Deletes the shared log for everyone who holds the link.
create or replace function public.sleep_forget(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.sleep_households where key_hash = public.sleep_hash(p_key);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sleep_hash(text), public.sleep_write(uuid, jsonb, bigint, jsonb),
  public.sleep_create(text, jsonb, bigint, jsonb), public.sleep_push(text, jsonb, bigint, jsonb),
  public.sleep_pull(text, timestamptz), public.sleep_paid(text), public.sleep_forget(text) from public, anon, authenticated;
grant execute on function public.sleep_create(text, jsonb, bigint, jsonb), public.sleep_push(text, jsonb, bigint, jsonb),
  public.sleep_pull(text, timestamptz), public.sleep_paid(text), public.sleep_forget(text) to anon, authenticated;
