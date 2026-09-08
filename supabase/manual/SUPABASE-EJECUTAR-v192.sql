-- EXCLU-FEST v192 · feedback inmediato del Quiz
-- Ejecutar UNA sola vez en Supabase > SQL Editor.
-- Permite comprobar una respuesta del intento actual y devuelve el índice correcto
-- para mostrar verde/rojo antes de pasar a la siguiente pregunta.

create or replace function public.check_coto_quiz_answer(
  p_festival_slug text,
  p_attempt_id uuid,
  p_question_id bigint,
  p_answer_index integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  fid uuid;
  pid uuid;
  a public.quiz_attempts%rowtype;
  ci integer;
begin
  if auth.uid() is null then
    raise exception 'Debes registrarte antes de jugar';
  end if;

  select id into fid
  from public.festivals
  where slug=p_festival_slug and active=true;

  select id into pid
  from public.participants
  where festival_id=fid and user_id=auth.uid();

  if pid is null then
    raise exception 'Participante no válido';
  end if;

  select * into a
  from public.quiz_attempts
  where id=p_attempt_id
    and participant_id=pid
    and festival_id=fid;

  if a.id is null then
    raise exception 'Intento de Quiz no válido';
  end if;

  if not (p_question_id = any(a.question_ids)) then
    raise exception 'La pregunta no pertenece a este intento';
  end if;

  select correct_index into ci
  from public.quiz_questions
  where id=p_question_id and active=true;

  if ci is null then
    raise exception 'Pregunta no válida';
  end if;

  return jsonb_build_object(
    'is_correct', ci=p_answer_index,
    'correct_index', ci
  );
end;
$$;

grant execute on function public.check_coto_quiz_answer(text,uuid,bigint,integer) to authenticated;
notify pgrst, 'reload schema';

-- Comprobación: debe devolver una fila con check_coto_quiz_answer.
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as parametros
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='check_coto_quiz_answer';
