-- EXCLU FEST 2026 — 004 PANEL DE ADMINISTRACIÓN
-- Ejecutar DESPUÉS de 003_no_sms_daily_participation.sql
-- No borra datos.

begin;

-- -----------------------------------------------------------------------------
-- Compatibilidad pgcrypto: corrige los dos errores ya detectados en pruebas.
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

create or replace function public.gen_random_bytes(integer)
returns bytea
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select extensions.gen_random_bytes($1);
$$;

grant execute on function public.gen_random_bytes(integer) to authenticated;

-- Recreamos register_participant con digest cualificado.
create or replace function public.register_participant(
  p_festival_slug text,
  p_phone text,
  p_accept_terms boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_festival_id uuid;
  v_phone_normalized text;
  v_phone_hash text;
  v_phone_masked text;
  v_existing public.participants%rowtype;
  v_participant public.participants%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'No hay una sesión activa.'; end if;
  if p_accept_terms is not true then raise exception 'Debes aceptar las condiciones para participar.'; end if;

  select id into v_festival_id
  from public.festivals
  where slug = p_festival_slug
  limit 1;
  if v_festival_id is null then raise exception 'Festival no encontrado.'; end if;

  v_phone_normalized := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if v_phone_normalized like '+34%' then
    v_phone_normalized := substring(v_phone_normalized from 4);
  elsif v_phone_normalized like '34%' and length(v_phone_normalized) > 9 then
    v_phone_normalized := substring(v_phone_normalized from 3);
  end if;
  if v_phone_normalized !~ '^[0-9]{9}$' then
    raise exception 'Introduce un número de teléfono válido de 9 dígitos.';
  end if;

  v_phone_normalized := '+34' || v_phone_normalized;
  v_phone_hash := encode(extensions.digest(v_phone_normalized::text, 'sha256'::text), 'hex');
  v_phone_masked := '+34 *** *** ' || right(v_phone_normalized, 3);

  select * into v_existing
  from public.participants
  where festival_id = v_festival_id and phone_hash = v_phone_hash
  limit 1;

  if found and v_existing.user_id <> v_user_id then
    raise exception 'Este teléfono ya está registrado en otro dispositivo o sesión.';
  end if;

  select * into v_participant
  from public.participants
  where festival_id = v_festival_id and user_id = v_user_id
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'already_registered', true,
      'participant_id', v_participant.id,
      'phone_masked', v_participant.phone_masked
    );
  end if;

  insert into public.participants(festival_id,user_id,phone_hash,phone_masked,accepted_terms_at)
  values(v_festival_id,v_user_id,v_phone_hash,v_phone_masked,now())
  returning * into v_participant;

  return jsonb_build_object(
    'success', true,
    'already_registered', false,
    'participant_id', v_participant.id,
    'phone_masked', v_participant.phone_masked
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: resumen completo para el panel.
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview(p_festival_slug text)
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

  select id into fid from public.festivals where slug=p_festival_slug;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  select jsonb_build_object(
    'test_mode', (select test_mode from public.festivals where id=fid),
    'scans', (select count(*) from public.scans where festival_id=fid),
    'participants', (select count(*) from public.participants where festival_id=fid),
    'participations', (select count(*) from public.participations where festival_id=fid),
    'raffle_entries', (select count(*) from public.raffle_entries where festival_id=fid),
    'prizes_claimed', (select count(*) from public.prize_claims where festival_id=fid),
    'prizes_redeemed', (select count(*) from public.prize_claims where festival_id=fid and (status='redeemed' or redeemed_at is not null)),
    'passports_complete', (
      select count(*) from (
        select participant_id
        from public.participations
        where festival_id=fid
        group by participant_id
        having count(distinct festival_day_id) >= 3
      ) q
    ),
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'name',p.name,
        'icon',p.icon,
        'stock_total',p.stock_total,
        'stock_remaining',p.stock_remaining,
        'active',p.active
      ) order by p.sort_order)
      from public.prizes p
      where p.festival_id=fid
    ), '[]'::jsonb),
    'recent_claims', coalesce((
      select jsonb_agg(row_data order by claimed_at desc)
      from (
        select jsonb_build_object(
          'reward_code',pc.reward_code,
          'prize_name',pr.name,
          'icon',pr.icon,
          'phone_masked',coalesce(pa.phone_masked,'—'),
          'status',case when pc.status='redeemed' or pc.redeemed_at is not null then 'redeemed' else 'pending' end,
          'claimed_at',pc.claimed_at,
          'redeemed_at',pc.redeemed_at
        ) as row_data,
        pc.claimed_at
        from public.prize_claims pc
        join public.prizes pr on pr.id=pc.prize_id
        join public.participants pa on pa.id=pc.participant_id
        where pc.festival_id=fid
        order by pc.claimed_at desc
        limit 30
      ) recent
    ), '[]'::jsonb),
    'winners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position',rw.position,
        'participant_id',rw.participant_id,
        'phone_masked',coalesce(pa.phone_masked,'—'),
        'entries',(select count(*) from public.raffle_entries re where re.festival_id=fid and re.participant_id=rw.participant_id)
      ) order by rw.position)
      from public.raffle_winners rw
      join public.raffles rr on rr.id=rw.raffle_id
      join public.participants pa on pa.id=rw.participant_id
      where rr.festival_id=fid
    ), '[]'::jsonb)
  ) into out;

  return out;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: comprobar un código SIN canjearlo.
-- -----------------------------------------------------------------------------
create or replace function public.admin_lookup_reward(p_reward_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.prize_claims%rowtype;
  pr public.prizes%rowtype;
  pa public.participants%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select * into c
  from public.prize_claims
  where reward_code=upper(trim(p_reward_code));

  if c.id is null then
    return jsonb_build_object('found',false,'message','Código no encontrado');
  end if;

  select * into pr from public.prizes where id=c.prize_id;
  select * into pa from public.participants where id=c.participant_id;

  return jsonb_build_object(
    'found',true,
    'reward_code',c.reward_code,
    'prize_name',pr.name,
    'prize_icon',pr.icon,
    'phone_masked',coalesce(pa.phone_masked,'—'),
    'status',case when c.status='redeemed' or c.redeemed_at is not null then 'redeemed' else 'pending' end,
    'claimed_at',c.claimed_at,
    'redeemed_at',c.redeemed_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: ajustar stock restante desde el panel.
-- Nunca permite superar stock_total ni bajar de cero.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_prize_stock(
  p_prize_id uuid,
  p_stock_remaining integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.prizes%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select * into p from public.prizes where id=p_prize_id for update;
  if p.id is null then raise exception 'Premio no encontrado'; end if;
  if p_stock_remaining < 0 or p_stock_remaining > p.stock_total then
    raise exception 'Stock fuera de rango';
  end if;

  update public.prizes
  set stock_remaining=p_stock_remaining
  where id=p_prize_id
  returning * into p;

  return jsonb_build_object(
    'id',p.id,
    'name',p.name,
    'stock_total',p.stock_total,
    'stock_remaining',p.stock_remaining
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- SORTEO FINAL: conserva el sorteo si ya existe y devuelve datos útiles al admin.
-- Cada entrada cuenta como una opción, pero una persona solo puede ganar una vez.
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
  max_winners integer;
  out jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;

  select id,max_final_winners into fid,max_winners
  from public.festivals where slug=p_festival_slug;
  if fid is null then raise exception 'Festival no encontrado'; end if;

  select id into rid from public.raffles where festival_id=fid limit 1;

  if rid is null then
    insert into public.raffles(festival_id,drawn_by)
    values(fid,auth.uid()) returning id into rid;

    while i < max_winners loop
      select re.participant_id into selected_pid
      from public.raffle_entries re
      where re.festival_id=fid
        and not exists(
          select 1 from public.raffle_winners rw
          where rw.raffle_id=rid and rw.participant_id=re.participant_id
        )
      order by random()
      limit 1;

      exit when selected_pid is null;
      i := i + 1;
      insert into public.raffle_winners(raffle_id,participant_id,position)
      values(rid,selected_pid,i);
    end loop;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position',rw.position,
    'participant_id',rw.participant_id,
    'phone_masked',coalesce(pa.phone_masked,'—'),
    'entries',(select count(*) from public.raffle_entries re where re.festival_id=fid and re.participant_id=rw.participant_id)
  ) order by rw.position),'[]'::jsonb)
  into out
  from public.raffle_winners rw
  join public.participants pa on pa.id=rw.participant_id
  where rw.raffle_id=rid;

  return out;
end;
$$;

revoke execute on function public.admin_overview(text) from public;
revoke execute on function public.admin_lookup_reward(text) from public;
revoke execute on function public.admin_set_prize_stock(uuid,integer) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_overview(text) to authenticated;
grant execute on function public.admin_lookup_reward(text) to authenticated;
grant execute on function public.admin_set_prize_stock(uuid,integer) to authenticated;
grant execute on function public.redeem_reward(text) to authenticated;
grant execute on function public.draw_final_raffle(text) to authenticated;
grant execute on function public.register_participant(text,text,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
