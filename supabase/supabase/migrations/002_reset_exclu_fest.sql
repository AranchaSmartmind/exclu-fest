-- EXCLU FEST 2026 — RESET + REBUILD
-- Ejecutar SOLO en el proyecto Supabase dedicado a EXCLU FEST.
-- Este script elimina únicamente las tablas de EXCLU FEST y las recrea.
-- NO elimina usuarios de auth.users.

begin;

create extension if not exists pgcrypto;

-- Elimina funciones RPC de la versión anterior antes de recrear el esquema.
drop function if exists public.register_scan(text);
drop function if exists public.has_played(text);
drop function if exists public.play_game(text);
drop function if exists public.is_admin();
drop function if exists public.admin_dashboard(text);
drop function if exists public.admin_prizes(text);
drop function if exists public.draw_final_raffle(text);
drop function if exists public.redeem_reward(text);

-- Solo tablas propias de EXCLU FEST.
drop table if exists public.raffle_winners cascade;
drop table if exists public.raffles cascade;
drop table if exists public.raffle_entries cascade;
drop table if exists public.prize_claims cascade;
drop table if exists public.prizes cascade;
drop table if exists public.participants cascade;
drop table if exists public.scans cascade;
drop table if exists public.admin_users cascade;
drop table if exists public.festivals cascade;

create table public.festivals (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_final_winners integer not null default 3 check (max_final_winners between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (festival_id, user_id)
);

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  name text not null,
  description text not null,
  icon text not null default '🎁',
  stock_total integer not null check (stock_total >= 0),
  stock_remaining integer not null check (stock_remaining >= 0 and stock_remaining <= stock_total),
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.prize_claims (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  prize_id uuid not null references public.prizes(id) on delete restrict,
  reward_code text unique not null,
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id),
  unique (participant_id)
);

create table public.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (festival_id, participant_id)
);

create table public.raffles (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  drawn_at timestamptz not null default now(),
  drawn_by uuid references auth.users(id),
  unique (festival_id)
);

create table public.raffle_winners (
  raffle_id uuid not null references public.raffles(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  position integer not null check (position between 1 and 3),
  primary key (raffle_id, participant_id),
  unique (raffle_id, position)
);

-- Campaña 11, 12 y 13 de septiembre de 2026.
insert into public.festivals (slug, name, starts_at, ends_at, max_final_winners)
values (
  'exclu-fest-2026',
  'EXCLU FEST · Fiestas del Coto',
  '2026-09-11 00:00:00+02',
  '2026-09-14 00:00:00+02',
  3
);

-- Premios instantáneos limitados. El sorteo final NO consume stock.
insert into public.prizes (festival_id, name, description, icon, stock_total, stock_remaining, sort_order)
select id, 'Café gratis', 'Un café a elegir de la selección habitual.', '☕', 20, 20, 1
from public.festivals where slug = 'exclu-fest-2026';

insert into public.prizes (festival_id, name, description, icon, stock_total, stock_remaining, sort_order)
select id, 'Pincho / bollería', 'Un pincho o pieza de bollería según disponibilidad.', '🥐', 15, 15, 2
from public.festivals where slug = 'exclu-fest-2026';

insert into public.prizes (festival_id, name, description, icon, stock_total, stock_remaining, sort_order)
select id, 'Consumición especial', 'Una consumición incluida en las bases de la promoción.', '🍺', 10, 10, 3
from public.festivals where slug = 'exclu-fest-2026';

insert into public.prizes (festival_id, name, description, icon, stock_total, stock_remaining, sort_order)
select id, 'Cofre secreto de EXCLU', 'Acércate a la barra y elige un sobre sorpresa.', '🎁', 5, 5, 4
from public.festivals where slug = 'exclu-fest-2026';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

create or replace function public.register_scan(p_festival_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  sid uuid;
begin
  select id into fid
  from public.festivals
  where slug = p_festival_slug and active = true;

  if fid is null then
    raise exception 'Festival no encontrado';
  end if;

  insert into public.scans(festival_id, user_agent)
  values (fid, left(coalesce(current_setting('request.headers', true), ''), 1000))
  returning id into sid;

  return sid;
end;
$$;

create or replace function public.has_played(p_festival_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants p
    join public.festivals f on f.id = p.festival_id
    where f.slug = p_festival_slug
      and p.user_id = auth.uid()
  );
$$;

create or replace function public.play_game(p_festival_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  pid uuid;
  selected public.prizes%rowtype;
  total_stock integer;
  roll integer;
  target integer;
  reward text;
begin
  if auth.uid() is null then
    raise exception 'Debes verificar tu teléfono';
  end if;

  select id into fid
  from public.festivals
  where slug = p_festival_slug
    and active = true
    and now() >= starts_at
    and now() < ends_at;

  if fid is null then
    raise exception 'La promoción no está activa';
  end if;

  insert into public.participants(festival_id, user_id)
  values (fid, auth.uid())
  on conflict (festival_id, user_id) do nothing
  returning id into pid;

  if pid is null then
    return jsonb_build_object(
      'already_played', true,
      'prize', null,
      'raffle_entries', 1,
      'reward_code', null,
      'message', 'Ya has participado.'
    );
  end if;

  insert into public.raffle_entries(festival_id, participant_id)
  values (fid, pid);

  -- Un único proceso a la vez decide y descuenta stock.
  perform pg_advisory_xact_lock(hashtextextended('exclu-fest-prizes:' || fid::text, 0));

  select coalesce(sum(stock_remaining), 0)
  into total_stock
  from public.prizes
  where festival_id = fid
    and active = true
    and stock_remaining > 0;

  -- 35% no premio instantáneo / 65% premio cuando hay stock.
  if total_stock > 0 and floor(random() * 100)::integer < 65 then
    roll := floor(random() * total_stock)::integer + 1;
    target := 0;

    for selected in
      select *
      from public.prizes
      where festival_id = fid
        and active = true
        and stock_remaining > 0
      order by sort_order, id
      for update
    loop
      target := target + selected.stock_remaining;
      if roll <= target then
        exit;
      end if;
    end loop;

    update public.prizes
    set stock_remaining = stock_remaining - 1
    where id = selected.id;

    reward := 'EXC-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

    insert into public.prize_claims(festival_id, participant_id, prize_id, reward_code)
    values (fid, pid, selected.id, reward);

    return jsonb_build_object(
      'already_played', false,
      'prize', jsonb_build_object(
        'id', selected.id,
        'name', selected.name,
        'description', selected.description,
        'icon', selected.icon
      ),
      'raffle_entries', 1,
      'reward_code', reward,
      'message', '¡Has ganado!'
    );
  end if;

  return jsonb_build_object(
    'already_played', false,
    'prize', null,
    'raffle_entries', 1,
    'reward_code', null,
    'message', 'Participación registrada en el sorteo final.'
  );
end;
$$;

create or replace function public.admin_dashboard(p_festival_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  out jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select id into fid from public.festivals where slug = p_festival_slug;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  select jsonb_build_object(
    'scans', (select count(*) from public.scans where festival_id = fid),
    'participants', (select count(*) from public.participants where festival_id = fid),
    'prizes_claimed', (select count(*) from public.prize_claims where festival_id = fid),
    'raffle_entries', (select count(*) from public.raffle_entries where festival_id = fid),
    'remaining', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', name, 'remaining', stock_remaining, 'total', stock_total)
        order by sort_order
      ) from public.prizes where festival_id = fid
    ), '[]'::jsonb)
  ) into out;

  return out;
end;
$$;

create or replace function public.admin_prizes(p_festival_slug text)
returns setof public.prizes
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.prizes p
  join public.festivals f on f.id = p.festival_id
  where f.slug = p_festival_slug
    and public.is_admin()
  order by p.sort_order;
$$;

create or replace function public.draw_final_raffle(p_festival_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  rid uuid;
  i integer := 0;
  r record;
  out jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select id into fid from public.festivals where slug = p_festival_slug;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  -- Evita un segundo sorteo para la misma campaña.
  if exists (select 1 from public.raffles where festival_id = fid) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('position', w.position, 'participant_id', w.participant_id)
        order by w.position
      ), '[]'::jsonb
    ) into out
    from public.raffle_winners w
    join public.raffles rr on rr.id = w.raffle_id
    where rr.festival_id = fid;
    return out;
  end if;

  insert into public.raffles(festival_id, drawn_by)
  values (fid, auth.uid())
  returning id into rid;

  for r in
    select participant_id
    from public.raffle_entries
    where festival_id = fid
    order by random()
    limit (select max_final_winners from public.festivals where id = fid)
  loop
    i := i + 1;
    insert into public.raffle_winners(raffle_id, participant_id, position)
    values (rid, r.participant_id, i);

    out := out || jsonb_build_array(
      jsonb_build_object('position', i, 'participant_id', r.participant_id)
    );
  end loop;

  return out;
end;
$$;

create or replace function public.redeem_reward(p_reward_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.prize_claims%rowtype;
  p public.prizes%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select * into c
  from public.prize_claims
  where reward_code = upper(trim(p_reward_code))
  for update;

  if c.id is null then
    raise exception 'Código no válido';
  end if;

  if c.redeemed_at is not null then
    return jsonb_build_object(
      'valid', false,
      'message', 'Premio ya utilizado',
      'redeemed_at', c.redeemed_at
    );
  end if;

  update public.prize_claims
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = c.id;

  select * into p from public.prizes where id = c.prize_id;

  return jsonb_build_object(
    'valid', true,
    'message', 'Premio validado',
    'prize_name', p.name,
    'reward_code', c.reward_code
  );
end;
$$;

-- RLS: el navegador no puede leer/modificar tablas directamente.
alter table public.festivals enable row level security;
alter table public.admin_users enable row level security;
alter table public.scans enable row level security;
alter table public.participants enable row level security;
alter table public.prizes enable row level security;
alter table public.prize_claims enable row level security;
alter table public.raffle_entries enable row level security;
alter table public.raffles enable row level security;
alter table public.raffle_winners enable row level security;

revoke all on public.festivals from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;
revoke all on public.scans from anon, authenticated;
revoke all on public.participants from anon, authenticated;
revoke all on public.prizes from anon, authenticated;
revoke all on public.prize_claims from anon, authenticated;
revoke all on public.raffle_entries from anon, authenticated;
revoke all on public.raffles from anon, authenticated;
revoke all on public.raffle_winners from anon, authenticated;

-- Evita que las funciones queden ejecutables por PUBLIC si Supabase cambiara defaults.
revoke execute on function public.register_scan(text) from public;
revoke execute on function public.has_played(text) from public;
revoke execute on function public.play_game(text) from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.admin_dashboard(text) from public;
revoke execute on function public.admin_prizes(text) from public;
revoke execute on function public.draw_final_raffle(text) from public;
revoke execute on function public.redeem_reward(text) from public;

grant execute on function public.register_scan(text) to anon, authenticated;
grant execute on function public.has_played(text) to authenticated;
grant execute on function public.play_game(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_dashboard(text) to authenticated;
grant execute on function public.admin_prizes(text) to authenticated;
grant execute on function public.draw_final_raffle(text) to authenticated;
grant execute on function public.redeem_reward(text) to authenticated;

commit;

-- IMPORTANTE: después de crear el usuario administrador en Authentication > Users,
-- sustituye UUID_DEL_ADMIN y ejecuta:
-- insert into public.admin_users(user_id) values ('UUID_DEL_ADMIN');
