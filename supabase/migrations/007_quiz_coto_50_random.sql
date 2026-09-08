-- EXCLU FEST v181 · Quiz El Coto: banco de 50 preguntas + intento aleatorio por participante
create table if not exists public.quiz_questions (
  id bigserial primary key,
  festival_slug text not null default 'exclu-fest-2026',
  category text not null,
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  question text not null,
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_index smallint not null check (correct_index between 0 and 3),
  active boolean not null default true,
  unique(festival_slug, question)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  festival_day_id uuid not null references public.festival_days(id) on delete cascade,
  question_ids bigint[] not null,
  answers jsonb,
  score smallint,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(participant_id, festival_day_id)
);

alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Banco: datos históricos/locales contrastables de El Coto. Se pueden editar desde Supabase sin tocar la app.
insert into public.quiz_questions(category,difficulty,question,options,correct_index) values
('Historia',3,'¿En qué año aparece documentado por primera vez el nombre «Coto de San Nicolás del Mar»?','["1476","1492","1521","1605"]',0),
('Historia',3,'¿Qué día se fecha el primer documento conocido que menciona el Coto de San Nicolás del Mar?','["11 de noviembre de 1476","6 de diciembre de 1492","19 de agosto de 1500","28 de febrero de 1476"]',0),
('Historia',3,'¿Quién figura como primer propietario de la colina de El Coto en aquella documentación?','["Juan de Gijón","Miguel García de la Cruz","Calixto Alvargonzález","Alfonso Menéndez"]',0),
('Historia',2,'¿Qué zonas actuales llegó a abarcar hacia el este el antiguo Coto de San Nicolás?','["El Bibio, Viesques y La Guía","La Calzada, Jove y Tremañes","Cimavilla y El Natahoyo","Roces y Montevil"]',0),
('Historia',3,'¿Hasta qué zona llegaba aproximadamente por el oeste el antiguo Coto de San Nicolás?','["La Cruz de Ceares","El Musel","La Calzada","Somió"]',0),
('Historia',2,'¿De dónde procede la parte «del Mar» del antiguo nombre San Nicolás del Mar?','["De que el terreno llegaba hasta el arenal","De una familia de marineros","De un antiguo puerto","Del nombre de una calle"]',0),
('Urbanismo',3,'¿En qué año diseñaron los hermanos Menéndez-Morán la parcelación en cuadrícula de El Coto?','["1898","1888","1909","1922"]',0),
('Urbanismo',2,'¿Con qué idea urbanística nació inicialmente la parcelación moderna de El Coto?','["Como ciudad jardín","Como barrio industrial","Como puerto comercial","Como ensanche ferroviario"]',0),
('Urbanismo',2,'¿Qué dos grandes construcciones impulsaron especialmente la urbanización de El Coto a comienzos del siglo XX?','["El cuartel y la cárcel","La plaza de toros y el puerto","La universidad y el hospital","La estación y el mercado"]',0),
('Urbanismo',3,'¿Qué servicios se extendieron en el barrio en buena medida por las necesidades del cuartel y la cárcel?','["Alcantarillado, luz y agua","Tranvía, gas y teléfono","Metro, fibra y gas","Ferrocarril, puerto y telégrafo"]',0),
('Urbanismo',2,'¿Qué rasgo conserva buena parte del trazado de calles de El Coto?','["Calles paralelas y perpendiculares de anchura considerable","Calles concéntricas muy estrechas","Un trazado medieval irregular","Una única avenida radial"]',0),
('Urbanismo',3,'¿Qué calle es conocida históricamente como Bulevar de La Cruz?','["Ramón y Cajal","Quevedo","Feijoo","Avelino González Mallada"]',0),
('Urbanismo',3,'¿Qué avenida fue conocida como Bulevar de San José?','["Pablo Iglesias","Constitución","Portugal","Schultz"]',0),
('Historia',2,'¿A partir de qué década cambió fuertemente la fisonomía de El Coto con edificios de hasta seis plantas?','["Década de 1960","Década de 1920","Década de 1980","Década de 2000"]',0),
('Cuartel',3,'¿Qué monarca colocó la primera piedra del cuartel Alfonso XIII de El Coto?','["Alfonso XIII","Alfonso XII","Juan Carlos I","Amadeo I"]',0),
('Cuartel',3,'¿Qué edad tenía Alfonso XIII cuando colocó la primera piedra del cuartel en 1900?','["14 años","18 años","21 años","10 años"]',0),
('Cuartel',3,'¿En qué fecha se colocó la primera piedra del cuartel Alfonso XIII?','["19 de agosto de 1900","9 de agosto de 1909","18 de julio de 1905","8 de febrero de 1985"]',0),
('Cuartel',2,'¿En qué año fue inaugurado el cuartel Alfonso XIII?','["1911","1900","1909","1924"]',0),
('Cuartel',3,'¿En qué año abandonó el cuartel su última guarnición?','["1985","1978","1992","1994"]',0),
('Cuartel',3,'¿Qué sobrenombre tenía el Regimiento de Infantería Tarragona nº 78 acuartelado en El Coto?','["El Firme","El Coto","El Astur","San Nicolás"]',0),
('Cuartel',3,'¿Qué unidad estuvo posteriormente en el cuartel de El Coto?','["Batallón de Zapadores Minadores 8","Regimiento Covadonga 1","Brigada Galicia 7","Batallón Pelayo 3"]',0),
('Cuartel',3,'¿En qué fecha cayó el cuartel tras el asedio durante la Guerra Civil?','["16 de agosto de 1936","18 de julio de 1936","1 de septiembre de 1937","19 de agosto de 1936"]',0),
('Cárcel',3,'¿Quién fue el arquitecto municipal del proyecto de la antigua cárcel de El Coto aprobado en 1905?','["Miguel García de la Cruz","Luis Bellido","Manuel del Busto","Juan Miguel de la Guardia"]',0),
('Cárcel',3,'¿En qué año comenzaron las obras de la antigua cárcel de El Coto?','["1906","1898","1909","1911"]',0),
('Cárcel',3,'¿En qué fecha fue inaugurada la antigua cárcel de El Coto?','["9 de agosto de 1909","19 de agosto de 1900","18 de julio de 1905","28 de febrero de 1909"]',0),
('Cárcel',2,'¿Quién era inicialmente propietario de la antigua cárcel de El Coto?','["El Ayuntamiento de Gijón","El Estado","El Ejército","La Diputación de Oviedo"]',0),
('Cárcel',3,'¿En qué año se cedió al Estado la antigua cárcel de El Coto?','["1924","1909","1936","1985"]',0),
('Cárcel',2,'¿Qué posición llegó a ocupar la cárcel de El Coto por importancia en Asturias?','["La segunda, tras la Correccional de Oviedo","La primera de Asturias","La tercera, tras Avilés y Oviedo","Nunca fue prisión provincial"]',0),
('Cárcel',3,'¿En qué año cerró definitivamente la cárcel de El Coto?','["1993","1985","1992","1997"]',0),
('Cárcel',3,'¿En qué año fue derribada la mayor parte de la antigua cárcel?','["1994","1993","1998","1989"]',0),
('Cárcel',2,'¿Qué parte de la antigua cárcel de El Coto se conserva?','["El edificio de entrada","Una torre de vigilancia","El patio central completo","El muro perimetral completo"]',0),
('Cárcel',2,'¿Qué uso tuvo el edificio de entrada conservado de la antigua cárcel?','["Hogar del Pensionista","Comisaría","Biblioteca infantil","Museo ferroviario"]',0),
('Biblioteca',3,'¿En qué año comenzó su andadura la Biblioteca Municipal de El Coto?','["1983","1975","1992","1998"]',0),
('Biblioteca',2,'¿Quién impulsó inicialmente la Biblioteca Municipal de El Coto?','["La Asociación de Vecinos","La Universidad de Oviedo","El Ejército","La Cámara de Comercio"]',0),
('Biblioteca',3,'¿En qué calle comenzó la Biblioteca Municipal de El Coto?','["Avelino González Mallada","Quevedo","Ramón y Cajal","General Suárez Valdés"]',0),
('Biblioteca',3,'¿A qué calle se trasladó la biblioteca antes de instalarse en el Centro Municipal?','["Leopoldo Alas","Feijoo","San Nicolás","Pablo Iglesias"]',0),
('Biblioteca',3,'¿En qué año se trasladó definitivamente la biblioteca al Centro Municipal Integrado de El Coto?','["1997","1983","1993","2001"]',0),
('Biblioteca',3,'¿Qué fecha corresponde a la inauguración oficial de la biblioteca en su sede del Centro Municipal?','["28 de febrero de 1998","11 de noviembre de 1997","6 de diciembre de 1998","9 de agosto de 1997"]',0),
('Barrio',2,'¿En qué plaza se encuentra el Centro Municipal Integrado de El Coto?','["Plaza de la República","Plaza Mayor","Plaza de Europa","Plaza del Humedal"]',0),
('Barrio',2,'¿En qué plaza se encuentra la Piscina Municipal de El Coto?','["Plaza de la República","Plaza de San Miguel","Plaza del Instituto","Plaza del Seis de Agosto"]',0),
('Barrio',3,'¿En qué calle tiene su sede la Asociación Vecinal El Coto?','["Avelino González Mallada","Corrida","Marqués de San Esteban","Ezcurdia"]',0),
('Parroquia',3,'¿A qué santo está dedicada la parroquia del barrio de El Coto?','["San Nicolás de Bari","San Pedro","San Lorenzo","San José"]',0),
('Parroquia',3,'¿En qué año se instaló definitivamente San Nicolás de Bari en el complejo parroquial actual?','["1992","1983","1998","1975"]',0),
('Parroquia',3,'¿En qué calle se encuentra el complejo parroquial de San Nicolás de Bari?','["Avelino González Mallada","Ramón y Cajal","Quevedo","Leopoldo Alas"]',0),
('Parroquia',3,'¿Dónde funcionó provisionalmente la parroquia de San Nicolás de Bari antes de pasar por la calle Quevedo?','["En las instalaciones del colegio de las Dominicas","En el antiguo cuartel","En la biblioteca","En la plaza de toros"]',0),
('Calles',3,'¿Qué reina visitó El Coto en agosto de 1900 junto a Alfonso XIII?','["María Cristina de Habsburgo-Lorena","Victoria Eugenia de Battenberg","Isabel II","María de las Mercedes"]',0),
('Calles',3,'¿Qué calle del barrio recuerda a la reina María Cristina por aquella visita de 1900?','["María Cristina","Quevedo","Feijoo","Leopoldo Alas"]',0),
('Fiestas',2,'¿En honor a quién se celebran las fiestas de septiembre de El Coto?','["San Nicolás","San Lorenzo","San Pedro","Nuestra Señora de Begoña"]',0),
('Fiestas',2,'¿Qué entidad organiza las Fiestas de San Nicolás de El Coto de 2026?','["La Asociación Vecinal El Coto","El Sporting de Gijón","La Universidad de Oviedo","La Autoridad Portuaria"]',0),
('Fiestas',2,'¿Qué tres días se celebran las Fiestas de San Nicolás de El Coto en 2026?','["11, 12 y 13 de septiembre","4, 5 y 6 de septiembre","18, 19 y 20 de septiembre","25, 26 y 27 de septiembre"]',0)
on conflict do nothing;

drop function if exists public.start_coto_quiz(text,smallint);
drop function if exists public.start_coto_quiz(text,integer);

create or replace function public.start_coto_quiz(p_festival_slug text, p_test_day integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare fid uuid; pid uuid; fd public.festival_days%rowtype; aid uuid; qids bigint[]; tm boolean;
begin
 if auth.uid() is null then raise exception 'Debes registrarte antes de jugar'; end if;
 select id,test_mode into fid,tm from public.festivals where slug=p_festival_slug and active=true;
 select id into pid from public.participants where festival_id=fid and user_id=auth.uid();
 if pid is null then raise exception 'Introduce tu teléfono antes de jugar'; end if;
 if tm and p_test_day is not null then select * into fd from public.festival_days where festival_id=fid and day_number=p_test_day and active=true;
 else select * into fd from public.festival_days where festival_id=fid and event_date=(now() at time zone 'Europe/Madrid')::date and active=true; end if;
 if fd.id is null or fd.game_type<>'quiz' then raise exception 'El Quiz no está disponible hoy'; end if;
 if exists(select 1 from public.participations where participant_id=pid and festival_day_id=fd.id) then raise exception 'Ya has participado en el Quiz de este día'; end if;
 select id,question_ids into aid,qids from public.quiz_attempts where participant_id=pid and festival_day_id=fd.id;
 if aid is null then
   select array_agg(id order by random()) into qids from (select id from public.quiz_questions where festival_slug=p_festival_slug and active=true order by random() limit 5) s;
   insert into public.quiz_attempts(festival_id,participant_id,festival_day_id,question_ids) values(fid,pid,fd.id,qids) returning id into aid;
 end if;
 return jsonb_build_object('attempt_id',aid,'questions',(select jsonb_agg(jsonb_build_object('id',q.id,'question',q.question,'options',q.options,'category',q.category,'difficulty',q.difficulty) order by array_position(qids,q.id)) from public.quiz_questions q where q.id=any(qids)));
end $$;

create or replace function public.finish_coto_quiz(p_festival_slug text,p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare fid uuid; pid uuid; a public.quiz_attempts%rowtype; fd public.festival_days%rowtype; item jsonb; sc int:=0; part uuid; selected public.prizes%rowtype; total_weight int; roll int; running_weight int:=0; reward text; won boolean:=false; completed int; raffle_count int;
begin
 if auth.uid() is null then raise exception 'Debes registrarte antes de jugar'; end if;
 select id into fid from public.festivals where slug=p_festival_slug and active=true;
 select id into pid from public.participants where festival_id=fid and user_id=auth.uid();
 select * into a from public.quiz_attempts where id=p_attempt_id and participant_id=pid and festival_id=fid for update;
 if a.id is null then raise exception 'Intento de Quiz no válido'; end if;
 if a.completed_at is not null then raise exception 'Este Quiz ya ha sido completado'; end if;
 select * into fd from public.festival_days where id=a.festival_day_id;
 if jsonb_array_length(p_answers)<>5 then raise exception 'Debes responder las 5 preguntas'; end if;
 for item in select * from jsonb_array_elements(p_answers) loop
   if (item->>'question_id')::bigint = any(a.question_ids) and exists(select 1 from public.quiz_questions q where q.id=(item->>'question_id')::bigint and q.correct_index=(item->>'answer_index')::int) then sc:=sc+1; end if;
 end loop;
 update public.quiz_attempts set answers=p_answers,score=sc,completed_at=now() where id=a.id;
 begin
  insert into public.participations(festival_id,festival_day_id,participant_id,game_type,choice) values(fid,fd.id,pid,'quiz','score='||sc||'/5') returning id into part;
 exception when unique_violation then raise exception 'Ya has participado en el Quiz de este día'; end;
 insert into public.raffle_entries(festival_id,participant_id,source,participation_id) values(fid,pid,'day_'||fd.day_number,part);
 -- Solo 5/5 permite optar al premio instantáneo. 0-4/5: sello + participación final, sin premio.
 if sc=5 then
   perform pg_advisory_xact_lock(hashtextextended('exclu-fest-prizes:'||fid::text,0));
   if floor(random()*100)::integer < 65 then
    select coalesce(sum(weight),0) into total_weight from public.prizes where festival_id=fid and active=true and stock_remaining>0 and (available_day is null or available_day=fd.day_number) and weight>0;
    if total_weight>0 then
     roll:=floor(random()*total_weight)::integer+1;
     for selected in select * from public.prizes where festival_id=fid and active=true and stock_remaining>0 and (available_day is null or available_day=fd.day_number) and weight>0 order by sort_order,id for update loop running_weight:=running_weight+selected.weight; if roll<=running_weight then exit; end if; end loop;
     if selected.id is not null and selected.stock_remaining>0 then update public.prizes set stock_remaining=stock_remaining-1 where id=selected.id; reward:='EXC-'||fd.day_number||'-'||upper(substr(encode(gen_random_bytes(4),'hex'),1,6)); insert into public.prize_claims(festival_id,participant_id,prize_id,participation_id,reward_code,status) values(fid,pid,selected.id,part,reward,'pending'); won:=true; end if;
    end if;
   end if;
 end if;
 select count(*) into completed from public.participations where participant_id=pid;
 if completed>=3 then insert into public.raffle_entries(festival_id,participant_id,source) values(fid,pid,'passport_bonus_1') on conflict do nothing; insert into public.raffle_entries(festival_id,participant_id,source) values(fid,pid,'passport_bonus_2') on conflict do nothing; end if;
 select count(*) into raffle_count from public.raffle_entries where festival_id=fid and participant_id=pid;
 return jsonb_build_object('already_played',false,'score',sc,'perfect',sc=5,'won',won,'day',fd.day_number,'prize_name',case when won then selected.name else null end,'prize_description',case when won then selected.description else null end,'prize_icon',case when won then selected.icon else null end,'reward_code',reward,'raffle_entries',raffle_count,'passport_complete',completed>=3,'message',case when sc<5 then 'Día 12 sellado. +1 participación para el sorteo final.' when won then '¡5/5! ¡Has ganado!' else '¡5/5! Has optado al premio instantáneo, pero esta vez no ha tocado.' end);
end $$;

grant execute on function public.start_coto_quiz(text,integer) to authenticated;
grant execute on function public.finish_coto_quiz(text,uuid,jsonb) to authenticated;

-- Fuerza a PostgREST/Supabase a refrescar la caché de funciones RPC.
notify pgrst, 'reload schema';
