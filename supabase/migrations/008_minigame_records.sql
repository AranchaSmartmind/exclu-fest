-- EXCLU FEST v222 · récords de minijuegos por participante
create table if not exists public.minigame_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  best_score integer not null default 0,
  best_time_seconds integer,
  last_score integer not null default 0,
  last_time_seconds integer,
  plays integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_key)
);

alter table public.minigame_records enable row level security;
drop policy if exists "read own minigame records" on public.minigame_records;
create policy "read own minigame records" on public.minigame_records for select to authenticated using (auth.uid() = user_id);

create or replace function public.save_minigame_record(p_game_key text, p_score integer, p_time_seconds integer)
returns void language plpgsql security definer set search_path=public as $$
declare r public.minigame_records%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_game_key is null or p_game_key='' or p_score<0 or p_time_seconds<0 then raise exception 'INVALID_DATA'; end if;
  select * into r from public.minigame_records where user_id=auth.uid() and game_key=p_game_key;
  if not found then
    insert into public.minigame_records(user_id,game_key,best_score,best_time_seconds,last_score,last_time_seconds,plays)
    values(auth.uid(),p_game_key,p_score,p_time_seconds,p_score,p_time_seconds,1);
  else
    update public.minigame_records set
      best_score = case when p_score>r.best_score then p_score else r.best_score end,
      best_time_seconds = case
        when p_score>r.best_score then p_time_seconds
        when p_score=r.best_score and (r.best_time_seconds is null or p_time_seconds<r.best_time_seconds) then p_time_seconds
        else r.best_time_seconds end,
      last_score=p_score,last_time_seconds=p_time_seconds,plays=r.plays+1,updated_at=now()
    where user_id=auth.uid() and game_key=p_game_key;
  end if;
end $$;
revoke all on function public.save_minigame_record(text,integer,integer) from public;
grant execute on function public.save_minigame_record(text,integer,integer) to authenticated;
