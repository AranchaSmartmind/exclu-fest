-- EXCLU FEST · 006
-- Códigos de premio definitivos: EXCLU-11SEP-123456
-- La tabla prize_claims mantiene UNIQUE(reward_code) y la función comprueba
-- colisiones antes de devolver un código.

create or replace function public.generate_exclu_reward_code(p_event_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  date_part text;
  candidate text;
  tries integer := 0;
begin
  date_part := to_char(p_event_date, 'DD') ||
    case extract(month from p_event_date)::integer
      when 1 then 'ENE' when 2 then 'FEB' when 3 then 'MAR' when 4 then 'ABR'
      when 5 then 'MAY' when 6 then 'JUN' when 7 then 'JUL' when 8 then 'AGO'
      when 9 then 'SEP' when 10 then 'OCT' when 11 then 'NOV' else 'DIC'
    end;

  loop
    tries := tries + 1;
    candidate := 'EXCLU-' || date_part || '-' || lpad(floor(random()*1000000)::integer::text, 6, '0');
    exit when not exists(select 1 from public.prize_claims where reward_code = candidate);
    if tries > 100 then
      raise exception 'No se pudo generar un código de premio único';
    end if;
  end loop;

  return candidate;
end;
$$;

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
        reward := public.generate_exclu_reward_code(fd.event_date);
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


grant execute on function public.play_daily_game(text,text,smallint,text) to authenticated;
