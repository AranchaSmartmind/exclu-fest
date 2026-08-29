-- EXCLU FEST 2026 — 005 HERRAMIENTAS DE PRUEBA SEGURAS
-- Ejecutar DESPUÉS de 004_admin_panel.sql
-- No borra participantes ni configuración. Solo funciona con test_mode=true.

begin;

-- -----------------------------------------------------------------------------
-- Reset del participante DEL NAVEGADOR/SESIÓN ACTUAL.
-- Mantiene su registro y teléfono, pero elimina sus jugadas, entradas y premios
-- para poder repetir el circuito de los días 11/12/13.
-- El stock consumido por sus premios se devuelve exactamente al inventario.
-- -----------------------------------------------------------------------------
create or replace function public.admin_test_reset_current_device(p_festival_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  pid uuid;
  is_test boolean;
  phone text;
  participations_deleted integer := 0;
  entries_deleted integer := 0;
  claims_deleted integer := 0;
  r record;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select id, test_mode into fid, is_test
  from public.festivals
  where slug = p_festival_slug;

  if fid is null then raise exception 'Festival no encontrado'; end if;
  if coalesce(is_test,false) is not true then
    raise exception 'Esta herramienta solo está disponible en MODO PRUEBAS';
  end if;

  select id, phone_masked into pid, phone
  from public.participants
  where festival_id = fid and user_id = auth.uid()
  limit 1;

  if pid is null then
    return jsonb_build_object(
      'ok', true,
      'nothing_to_reset', true,
      'message', 'Este navegador todavía no tiene un participante registrado.'
    );
  end if;

  -- Si este participante figura como ganador, primero debe resetearse el sorteo.
  if exists (
    select 1
    from public.raffle_winners rw
    join public.raffles rr on rr.id = rw.raffle_id
    where rr.festival_id = fid and rw.participant_id = pid
  ) then
    raise exception 'Este participante figura como ganador. Resetea primero el sorteo de prueba.';
  end if;

  -- Devolver al stock únicamente los premios generados por este participante.
  for r in
    select pc.prize_id, count(*)::integer as qty
    from public.prize_claims pc
    where pc.festival_id = fid and pc.participant_id = pid
    group by pc.prize_id
  loop
    update public.prizes p
    set stock_remaining = least(p.stock_total, p.stock_remaining + r.qty)
    where p.id = r.prize_id;
  end loop;

  delete from public.prize_claims
  where festival_id = fid and participant_id = pid;
  get diagnostics claims_deleted = row_count;

  delete from public.raffle_entries
  where festival_id = fid and participant_id = pid;
  get diagnostics entries_deleted = row_count;

  delete from public.participations
  where festival_id = fid and participant_id = pid;
  get diagnostics participations_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'phone_masked', coalesce(phone,'—'),
    'participations_deleted', participations_deleted,
    'raffle_entries_deleted', entries_deleted,
    'prize_claims_deleted', claims_deleted,
    'registration_kept', true,
    'message', 'Participante de prueba reseteado. El registro se conserva y puede volver a jugar los 3 días.'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Reset SOLO del sorteo final en modo pruebas.
-- Elimina el registro del sorteo y sus ganadores; NO toca entradas ni jugadores.
-- -----------------------------------------------------------------------------
create or replace function public.admin_test_reset_raffle(p_festival_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  is_test boolean;
  raffles_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select id, test_mode into fid, is_test
  from public.festivals
  where slug = p_festival_slug;

  if fid is null then raise exception 'Festival no encontrado'; end if;
  if coalesce(is_test,false) is not true then
    raise exception 'Esta herramienta solo está disponible en MODO PRUEBAS';
  end if;

  delete from public.raffles where festival_id = fid;
  get diagnostics raffles_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'raffles_deleted', raffles_deleted,
    'message', case when raffles_deleted > 0
      then 'Sorteo de prueba reseteado. Las participaciones siguen intactas.'
      else 'No había ningún sorteo de prueba que resetear.'
    end
  );
end;
$$;

revoke execute on function public.admin_test_reset_current_device(text) from public;
revoke execute on function public.admin_test_reset_raffle(text) from public;
grant execute on function public.admin_test_reset_current_device(text) to authenticated;
grant execute on function public.admin_test_reset_raffle(text) to authenticated;

notify pgrst, 'reload schema';
commit;
