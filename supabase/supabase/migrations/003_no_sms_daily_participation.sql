-- EXCLU FEST 2026 — MIGRACIÓN 003
-- Registro sin SMS usando Supabase Anonymous Auth + teléfono declarado.
-- Añade participación por día, pasaporte real, premios múltiples y 2 bonus al completar 3 días.
-- Ejecutar DESPUÉS de 002_reset_exclu_fest.sql.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- ESQUEMA
-- -----------------------------------------------------------------------------

alter table public.festivals
  add column if not exists test_mode boolean not null default true;

alter table public.participants
  add column if not exists phone_hash text,
  add column if not exists phone_masked text,
  add column if not exists accepted_terms_at timestamptz;

create unique index if not exists participants_festival_phone_hash_uidx
  on public.participants(festival_id, phone_hash)
  where phone_hash is not null;

create table if not exists public.festival_days (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  event_date date not null,
  day_number smallint not null check (day_number between 1 and 31),
  game_type text not null check (game_type in ('wheel','quiz','box')),
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(festival_id, event_date),
  unique(festival_id, day_number),
  unique(festival_id, game_type)
);

insert into public.festival_days(festival_id,event_date,day_number,game_type,title)
select f.id, d.event_date, d.day_number, d.game_type, d.title
from public.festivals f
cross join (values
  ('2026-09-11'::date,11::smallint,'wheel'::text,'Ruleta de La Exclusiva'::text),
  ('2026-09-12'::date,12::smallint,'quiz'::text,'El Reto del Coto'::text),
  ('2026-09-13'::date,13::smallint,'box'::text,'La Caja Fuerte'::text)
) as d(event_date,day_number,game_type,title)
where f.slug='exclu-fest-2026'
on conflict do nothing;

create table if not exists public.participations (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  festival_day_id uuid not null references public.festival_days(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  game_type text not null,
  choice text,
  created_at timestamptz not null default now(),
  unique(participant_id, festival_day_id)
);

alter table public.prizes
  add column if not exists weight integer not null default 10 check (weight >= 0),
  add column if not exists available_day smallint check (available_day is null or available_day between 1 and 31);

alter table public.prize_claims
  add column if not exists participation_id uuid references public.participations(id) on delete set null,
  add column if not exists status text not null default 'pending' check (status in ('pending','redeemed','expired','cancelled'));

-- La versión 002 permitía solo un premio por participante. Ahora puede ganar uno por día.
alter table public.prize_claims drop constraint if exists prize_claims_participant_id_key;
create unique index if not exists prize_claims_participation_uidx
  on public.prize_claims(participation_id)
  where participation_id is not null;

-- La versión 002 permitía una sola entrada al sorteo. Ahora hay 1 por día + 2 bonus.
alter table public.raffle_entries drop constraint if exists raffle_entries_festival_id_participant_id_key;
alter table public.raffle_entries
  add column if not exists source text not null default 'legacy',
  add column if not exists participation_id uuid references public.participations(id) on delete set null;
create unique index if not exists raffle_entry_participation_uidx
  on public.raffle_entries(participation_id)
  where participation_id is not null;
create unique index if not exists raffle_entry_bonus_uidx
  on public.raffle_entries(festival_id, participant_id, source)
  where source in ('passport_bonus_1','passport_bonus_2');

-- RLS para nuevas tablas.
alter table public.festival_days enable row level security;
alter table public.participations enable row level security;
revoke all on public.festival_days from anon, authenticated;
revoke all on public.participations from anon, authenticated;

-- -----------------------------------------------------------------------------
-- FUNCIONES ANTIGUAS REEMPLAZADAS
-- -----------------------------------------------------------------------------

drop function if exists public.has_played(text);
drop function if exists public.play_game(text);
drop function if exists public.draw_final_raffle(text);

-- -----------------------------------------------------------------------------
-- HELPERS
-- -----------------------------------------------------------------------------

create or replace function public.normalize_es_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');

  if length(digits)=11 and left(digits,2)='34' then
    digits := substr(digits,3);
  end if;

  if length(digits) <> 9 or left(digits,1) not in ('6','7','8','9') then
    raise exception 'Introduce un teléfono español válido de 9 cifras';
  end if;

  return '+34' || digits;
end;
$$;

create or replace function public.mask_phone(p_normalized text)
returns text
language sql
immutable
as $$
  select '+34 *** *** ' || right(regexp_replace(coalesce(p_normalized,''), '[^0-9]', '', 'g'),3);
$$;

-- -----------------------------------------------------------------------------
-- REGISTRO SIN SMS
-- -----------------------------------------------------------------------------

create or replace function public.register_participant(
  p_festival_slug text,
  p_phone text,
  p_accept_terms boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  pid uuid;
  normalized text;
  phash text;
  masked text;
  existing_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'No se ha podido crear la sesión del dispositivo';
  end if;

  if coalesce(p_accept_terms,false) is not true then
    raise exception 'Debes aceptar las bases y la política de privacidad';
  end if;

  select id into fid from public.festivals where slug=p_festival_slug and active=true;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  normalized := public.normalize_es_phone(p_phone);
  phash := encode(digest(normalized, 'sha256'),'hex');
  masked := public.mask_phone(normalized);

  select user_id into existing_owner
  from public.participants
  where festival_id=fid and phone_hash=phash
  limit 1;

  if existing_owner is not null and existing_owner <> auth.uid() then
    raise exception 'Este teléfono ya está registrado en otro dispositivo para EXCLU FEST';
  end if;

  insert into public.participants(festival_id,user_id,phone_hash,phone_masked,accepted_terms_at)
  values(fid,auth.uid(),phash,masked,now())
  on conflict (festival_id,user_id)
  do update set
    phone_hash=excluded.phone_hash,
    phone_masked=excluded.phone_masked,
    accepted_terms_at=coalesce(public.participants.accepted_terms_at,excluded.accepted_terms_at)
  returning id into pid;

  return jsonb_build_object(
    'ok',true,
    'participant_id',pid,
    'phone_masked',masked
  );
exception
  when unique_violation then
    raise exception 'Este teléfono ya está registrado para EXCLU FEST';
end;
$$;

-- -----------------------------------------------------------------------------
-- ESTADO DEL CLIENTE / PASAPORTE / PREMIOS
-- -----------------------------------------------------------------------------

create or replace function public.get_my_festival_status(p_festival_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  pid uuid;
  masked text;
  played jsonb;
  rewards jsonb;
  raffle_count integer;
  test_mode_value boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('registered',false);
  end if;

  select id,test_mode into fid,test_mode_value
  from public.festivals where slug=p_festival_slug;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  select id,phone_masked into pid,masked
  from public.participants
  where festival_id=fid and user_id=auth.uid();

  if pid is null then
    return jsonb_build_object('registered',false,'test_mode',test_mode_value);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'day',fd.day_number,
    'game_type',pa.game_type,
    'played_at',pa.created_at
  ) order by fd.day_number),'[]'::jsonb)
  into played
  from public.participations pa
  join public.festival_days fd on fd.id=pa.festival_day_id
  where pa.participant_id=pid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name',pr.name,
    'icon',pr.icon,
    'reward_code',pc.reward_code,
    'status',pc.status,
    'claimed_at',pc.claimed_at,
    'redeemed_at',pc.redeemed_at
  ) order by pc.claimed_at desc),'[]'::jsonb)
  into rewards
  from public.prize_claims pc
  join public.prizes pr on pr.id=pc.prize_id
  where pc.participant_id=pid;

  select count(*) into raffle_count
  from public.raffle_entries
  where festival_id=fid and participant_id=pid;

  return jsonb_build_object(
    'registered',true,
    'phone_masked',masked,
    'played_days',played,
    'rewards',rewards,
    'raffle_entries',raffle_count,
    'passport_complete',(select count(*)=3 from public.participations where participant_id=pid),
    'test_mode',test_mode_value
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- JUEGO DIARIO
-- En test_mode el frontend envía p_test_day=11/12/13 para probar cualquier juego.
-- En producción (test_mode=false) el backend ignora ese valor y usa la fecha de Madrid.
-- -----------------------------------------------------------------------------

create or replace function public.play_daily_game(
  p_festival_slug text,
  p_game_type text,
  p_test_day smallint default null,
  p_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  pid uuid;
  fd public.festival_days%rowtype;
  test_mode_value boolean;
  effective_date date;
  participation_id_value uuid;
  selected public.prizes%rowtype;
  total_weight integer;
  roll integer;
  running_weight integer := 0;
  reward text;
  won boolean := false;
  completed integer;
  raffle_count integer;
begin
  if auth.uid() is null then raise exception 'Debes registrarte antes de jugar'; end if;

  select id,test_mode into fid,test_mode_value
  from public.festivals
  where slug=p_festival_slug and active=true;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  select id into pid from public.participants
  where festival_id=fid and user_id=auth.uid();
  if pid is null then raise exception 'Introduce tu teléfono antes de jugar'; end if;

  if test_mode_value and p_test_day is not null then
    select * into fd from public.festival_days
    where festival_id=fid and day_number=p_test_day and active=true;
  else
    effective_date := (now() at time zone 'Europe/Madrid')::date;
    select * into fd from public.festival_days
    where festival_id=fid and event_date=effective_date and active=true;
  end if;

  if fd.id is null then
    raise exception 'Hoy no hay ningún juego activo';
  end if;

  if fd.game_type <> p_game_type then
    raise exception 'Este no es el juego disponible para hoy';
  end if;

  begin
    insert into public.participations(festival_id,festival_day_id,participant_id,game_type,choice)
    values(fid,fd.id,pid,p_game_type,left(coalesce(p_choice,''),60))
    returning id into participation_id_value;
  exception
    when unique_violation then
      select count(*) into raffle_count from public.raffle_entries where festival_id=fid and participant_id=pid;
      return jsonb_build_object(
        'already_played',true,
        'won',false,
        'message','Ya has participado en el juego de este día.',
        'day',fd.day_number,
        'raffle_entries',raffle_count
      );
  end;

  insert into public.raffle_entries(festival_id,participant_id,source,participation_id)
  values(fid,pid,'day_'||fd.day_number,participation_id_value);

  -- Bloqueo transaccional global del stock del festival.
  perform pg_advisory_xact_lock(hashtextextended('exclu-fest-prizes:'||fid::text,0));

  -- 35% no premio instantáneo. Si entra en el 65%, se usa weighted random.
  if floor(random()*100)::integer < 65 then
    select coalesce(sum(weight),0) into total_weight
    from public.prizes
    where festival_id=fid and active=true and stock_remaining>0
      and (available_day is null or available_day=fd.day_number)
      and weight>0;

    if total_weight > 0 then
      roll := floor(random()*total_weight)::integer + 1;

      for selected in
        select * from public.prizes
        where festival_id=fid and active=true and stock_remaining>0
          and (available_day is null or available_day=fd.day_number)
          and weight>0
        order by sort_order,id
        for update
      loop
        running_weight := running_weight + selected.weight;
        if roll <= running_weight then exit; end if;
      end loop;

      if selected.id is not null and selected.stock_remaining > 0 then
        update public.prizes set stock_remaining=stock_remaining-1 where id=selected.id;
        reward := 'EXC-'||fd.day_number||'-'||upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
        insert into public.prize_claims(festival_id,participant_id,prize_id,participation_id,reward_code,status)
        values(fid,pid,selected.id,participation_id_value,reward,'pending');
        won := true;
      end if;
    end if;
  end if;

  select count(*) into completed from public.participations where participant_id=pid;

  if completed >= 3 then
    insert into public.raffle_entries(festival_id,participant_id,source)
    values(fid,pid,'passport_bonus_1') on conflict do nothing;
    insert into public.raffle_entries(festival_id,participant_id,source)
    values(fid,pid,'passport_bonus_2') on conflict do nothing;
  end if;

  select count(*) into raffle_count from public.raffle_entries where festival_id=fid and participant_id=pid;

  return jsonb_build_object(
    'already_played',false,
    'won',won,
    'day',fd.day_number,
    'prize_name',case when won then selected.name else null end,
    'prize_description',case when won then selected.description else null end,
    'prize_icon',case when won then selected.icon else null end,
    'reward_code',reward,
    'raffle_entries',raffle_count,
    'passport_complete',completed>=3,
    'message',case when won then '¡Has ganado!' else 'Tu participación ya está en el sorteo final.' end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- SORTEO FINAL: entradas ponderadas, 3 personas distintas
-- -----------------------------------------------------------------------------

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
  selected_pid uuid;
  out jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select id into fid from public.festivals where slug=p_festival_slug;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  if exists(select 1 from public.raffles where festival_id=fid) then
    select coalesce(jsonb_agg(jsonb_build_object('position',w.position,'participant_id',w.participant_id) order by w.position),'[]'::jsonb)
    into out
    from public.raffle_winners w
    join public.raffles r on r.id=w.raffle_id
    where r.festival_id=fid;
    return out;
  end if;

  insert into public.raffles(festival_id,drawn_by) values(fid,auth.uid()) returning id into rid;

  while i < (select max_final_winners from public.festivals where id=fid) loop
    select re.participant_id into selected_pid
    from public.raffle_entries re
    where re.festival_id=fid
      and not exists(select 1 from public.raffle_winners rw where rw.raffle_id=rid and rw.participant_id=re.participant_id)
    order by random()
    limit 1;

    exit when selected_pid is null;
    i := i + 1;
    insert into public.raffle_winners(raffle_id,participant_id,position)
    values(rid,selected_pid,i);
    out := out || jsonb_build_array(jsonb_build_object('position',i,'participant_id',selected_pid));
  end loop;

  return out;
end;
$$;

-- -----------------------------------------------------------------------------
-- CANJE: sincroniza status
-- -----------------------------------------------------------------------------

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

  select * into c from public.prize_claims
  where reward_code=upper(trim(p_reward_code)) for update;

  if c.id is null then raise exception 'Código no válido'; end if;
  if c.status='redeemed' or c.redeemed_at is not null then
    return jsonb_build_object('valid',false,'message','Premio ya utilizado','redeemed_at',c.redeemed_at);
  end if;

  update public.prize_claims
  set redeemed_at=now(), redeemed_by=auth.uid(), status='redeemed'
  where id=c.id;

  select * into p from public.prizes where id=c.prize_id;
  return jsonb_build_object('valid',true,'message','Premio validado','prize_name',p.name,'reward_code',c.reward_code);
end;
$$;

-- -----------------------------------------------------------------------------
-- GRANTS
-- Anonymous Auth genera role=authenticated tras signInAnonymously().
-- register_scan sigue siendo accesible antes del registro.
-- -----------------------------------------------------------------------------

revoke execute on function public.normalize_es_phone(text) from public;
revoke execute on function public.mask_phone(text) from public;
revoke execute on function public.register_participant(text,text,boolean) from public;
revoke execute on function public.get_my_festival_status(text) from public;
revoke execute on function public.play_daily_game(text,text,smallint,text) from public;
revoke execute on function public.draw_final_raffle(text) from public;
revoke execute on function public.redeem_reward(text) from public;

grant execute on function public.register_participant(text,text,boolean) to authenticated;
grant execute on function public.get_my_festival_status(text) to authenticated;
grant execute on function public.play_daily_game(text,text,smallint,text) to authenticated;
grant execute on function public.draw_final_raffle(text) to authenticated;
grant execute on function public.redeem_reward(text) to authenticated;

commit;

-- PRODUCCIÓN:
-- Cuando terminen las pruebas, ejecutar:
-- update public.festivals set test_mode=false where slug='exclu-fest-2026';
