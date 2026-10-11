-- Email sign-ups from the Baby Nap Track app, for news when the app adds something. Applied by hand
-- with execute_sql, beside sharing.sql and outside the project's migration history, as sharing is. The browser roles hold no grants on the table, so the one function below
-- is the only way in, and it can only add an address.

create table if not exists public.sleep_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'app',
  app_version text,
  created_at timestamptz not null default now()
);
create unique index if not exists sleep_signups_email on public.sleep_signups (lower(email));
alter table public.sleep_signups enable row level security;
revoke all on public.sleep_signups from anon, authenticated;
comment on table public.sleep_signups is 'Baby Nap Track. Email addresses a parent typed in to hear when the app adds something. Reached only through sleep_signup.';

create or replace function public.sleep_signup(p_email text, p_source text, p_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if length(e) > 254 or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'not an email' using errcode = '22023';
  end if;
  insert into public.sleep_signups (email, source, app_version)
  values (e, coalesce(left(p_source, 40), 'app'), left(p_version, 20))
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.sleep_signup(text, text, text) from public;
grant execute on function public.sleep_signup(text, text, text) to anon, authenticated;
