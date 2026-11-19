-- Avatar und Münzen – gemeinsam für Vokaboom und Teilmal (gleiches Supabase-Projekt)
-- Im SQL Editor einfügen und «Run». Mehrmals ausführen schadet nicht. Die Datei ist in beiden Repositories gleich.
--
-- Wer ist wer?  Ein Kind wird über seinen Anmelde-Schlüssel (Token) erkannt:
--   Vokaboom-Kind            → Schlüssel „v:<Vokaboom-ID>“
--   Teilmal-Kind, verbunden  → derselbe Schlüssel „v:<Vokaboom-ID>“ (ein Avatar für beide Tools)
--   Teilmal-Kind, allein     → „e:<Teilmal-ID>“
-- Wird ein Teilmal-Kind später verbunden, werden Avatar, Münzen und gekaufte Teile zusammengeführt.
--
-- Schutz: Preise stehen in der Datenbank (fab_avatar_items). Kaufen, Anziehen und Münzen gutschreiben
-- geht nur über die Funktionen unten; pro Aufruf höchstens 5 Münzen, pro Tag höchstens 40.

create table if not exists public.fab_avatars (
  kid_key text primary key check (kid_key ~ '^[ve]:[0-9a-f-]{36}$'),
  avatar jsonb not null default '{}' check (jsonb_typeof(avatar) = 'object' and octet_length(avatar::text) <= 4000),
  owned text[] not null default '{}' check (cardinality(owned) <= 500),
  coins integer not null default 0 check (coins >= 0),
  earned integer not null default 0,
  spent integer not null default 0,
  day date not null default current_date,
  day_coins integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.fab_avatars enable row level security;
revoke all on public.fab_avatars from anon, authenticated;

-- Preisliste (nur Teile, die etwas kosten; alles andere ist das Basic-Set)
create table if not exists public.fab_avatar_items (id text primary key, price integer not null check (price > 0));
alter table public.fab_avatar_items enable row level security;
revoke all on public.fab_avatar_items from anon, authenticated;
insert into public.fab_avatar_items (id, price) values
  ('hair:mohawk', 15), ('hair:wavy', 12), ('hair:space', 18),
  ('hairc:pink', 8), ('hairc:mint', 8), ('hairc:violet', 8), ('hairc:rainbow', 20),
  ('eyes:star', 12), ('eyes:heart', 12), ('mouth:tongue', 6), ('face:freckles', 5), ('face:stars', 10),
  ('top:hero', 25), ('top:space', 30), ('top:tux', 22), ('top:rainbow', 20), ('top:kimono', 22),
  ('topc:gold', 15), ('topc:galaxy', 20),
  ('bottom:sparkle', 18), ('bottom:cargo', 10),
  ('shoes:rocket', 20), ('shoes:roller', 18),
  ('hat:crown', 30), ('hat:wizard', 25), ('hat:cat', 15), ('hat:viking', 22), ('hat:party', 10),
  ('glasses:star', 12), ('glasses:heart', 12),
  ('back:cape', 30), ('back:wings', 40), ('back:dragon', 45), ('back:jetpack', 40),
  ('hand:wand', 18), ('hand:trophy', 20), ('hand:guitar', 25),
  ('pet:cat', 35), ('pet:dog', 35), ('pet:dragon', 50), ('pet:owl', 40), ('pet:bunny', 35),
  ('bg:space', 20), ('bg:beach', 15), ('bg:jungle', 15), ('bg:rainbow', 18), ('bg:castle', 25)
on conflict (id) do update set price = excluded.price;

-- Hilfe: Schlüssel des Kindes aus dem Anmelde-Schlüssel (und verbundene Konten zusammenführen)
create or replace function public.fab_kid_key(p_app text, p_token uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  vid uuid; sid uuid; ek text; vk text; a public.fab_avatars; b public.fab_avatars;
begin
  if p_app = 'vokaboom' then
    if to_regclass('public.vokaboom_sessions') is null then return null; end if;
    select x.student_id into vid from public.vokaboom_sessions x where x.token = p_token;
    if vid is null then return null; end if;
    update public.vokaboom_sessions set last_seen = now() where token = p_token;
    vk := 'v:' || vid;
    -- schon mit Teilmal verbunden und dort vorher einen eigenen Avatar gehabt? → zusammenführen
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'einmaleins_students' and column_name = 'vokaboom_id') then
      execute 'select ''e:'' || e.id from public.einmaleins_students e where e.vokaboom_id = $1 limit 1' into ek using vid;
    end if;
  elsif p_app in ('einmaleins', 'teilmal') then
    if to_regclass('public.einmaleins_sessions') is null then return null; end if;
    select x.student_id into sid from public.einmaleins_sessions x where x.token = p_token;
    if sid is null then return null; end if;
    update public.einmaleins_sessions set last_seen = now() where token = p_token;
    ek := 'e:' || sid;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'einmaleins_students' and column_name = 'vokaboom_id') then
      execute 'select e.vokaboom_id from public.einmaleins_students e where e.id = $1' into vid using sid;
    end if;
    if vid is null then return ek; end if;
    vk := 'v:' || vid;
  else
    return null;
  end if;
  if ek is not null then
    select * into b from public.fab_avatars where kid_key = ek for update;
    if found then
      select * into a from public.fab_avatars where kid_key = vk for update;
      if not found then
        update public.fab_avatars set kid_key = vk where kid_key = ek;
      else
        update public.fab_avatars set
          coins = a.coins + b.coins, earned = a.earned + b.earned, spent = a.spent + b.spent,
          owned = (select coalesce(array_agg(distinct o), '{}') from unnest(a.owned || b.owned) o),
          avatar = case when b.updated_at > a.updated_at and b.avatar <> '{}'::jsonb then b.avatar else a.avatar end,
          updated_at = now()
        where kid_key = vk;
        delete from public.fab_avatars where kid_key = ek;
      end if;
    end if;
  end if;
  return vk;
end;
$$;

create or replace function public.fab_avatar_state(k text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('avatar', a.avatar, 'owned', to_jsonb(a.owned), 'coins', a.coins, 'earned', a.earned, 'spent', a.spent,
    'today', case when a.day = current_date then a.day_coins else 0 end, 'dayMax', 40)
    from public.fab_avatars a where a.kid_key = k),
    jsonb_build_object('avatar', '{}'::jsonb, 'owned', '[]'::jsonb, 'coins', 0, 'earned', 0, 'spent', 0, 'today', 0, 'dayMax', 40));
$$;

-- Kind: Avatar, gekaufte Teile und Münzen holen
create or replace function public.fab_avatar_get(p_app text, p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  return public.fab_avatar_state(k);
end;
$$;

-- Kind: Avatar speichern (nur Basic-Teile oder gekaufte)
create or replace function public.fab_avatar_save(p_app text, p_token uuid, p_avatar jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; own text[]; bad text;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_avatar) <> 'object' or octet_length(p_avatar::text) > 4000 then raise exception 'bad_avatar' using errcode = '22023'; end if;
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select owned into own from public.fab_avatars where kid_key = k;
  select i.id into bad from jsonb_each_text(p_avatar) v join public.fab_avatar_items i on i.id = v.key || ':' || v.value
    where not (i.id = any (own)) limit 1;
  if bad is not null then raise exception 'not_owned' using errcode = 'P0001', detail = bad; end if;
  update public.fab_avatars set avatar = p_avatar, updated_at = now() where kid_key = k;
  return public.fab_avatar_state(k);
end;
$$;

-- Kind: Teil mit Münzen kaufen
create or replace function public.fab_avatar_buy(p_app text, p_token uuid, p_item text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; pr integer; a public.fab_avatars;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  select price into pr from public.fab_avatar_items where id = p_item;
  if pr is null then raise exception 'no_item' using errcode = 'P0001'; end if;
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select * into a from public.fab_avatars where kid_key = k for update;
  if p_item = any (a.owned) then return public.fab_avatar_state(k); end if;
  if a.coins < pr then raise exception 'not_enough' using errcode = 'P0001'; end if;
  update public.fab_avatars set coins = coins - pr, spent = spent + pr, owned = array_append(owned, p_item), updated_at = now() where kid_key = k;
  return public.fab_avatar_state(k);
end;
$$;

-- Kind: verdiente Münzen gutschreiben (höchstens 5 pro Aufruf, 40 pro Tag)
create or replace function public.fab_coins_earn(p_app text, p_token uuid, p_n integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; a public.fab_avatars; n integer; today integer;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select * into a from public.fab_avatars where kid_key = k for update;
  today := case when a.day = current_date then a.day_coins else 0 end;
  n := greatest(0, least(coalesce(p_n, 0), 5, 40 - today));
  update public.fab_avatars set coins = coins + n, earned = earned + n, day = current_date, day_coins = today + n, updated_at = now() where kid_key = k;
  return public.fab_avatar_state(k) || jsonb_build_object('granted', n);
end;
$$;

-- Lehrperson: Avatare und Münzen der eigenen Kinder (für Klassenliste und Live-Spiele)
create or replace function public.fab_class_avatars(p_class uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.vokaboom_classes c where c.id = p_class and c.teacher_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(s.id, jsonb_build_object('avatar', a.avatar, 'coins', a.coins, 'earned', a.earned))
    from public.vokaboom_students s join public.fab_avatars a on a.kid_key = 'v:' || s.id where s.class_id = p_class), '{}'::jsonb);
end;
$$;

revoke all on function public.fab_kid_key(text, uuid), public.fab_avatar_state(text) from public, anon, authenticated;
grant execute on function public.fab_avatar_get(text, uuid), public.fab_avatar_save(text, uuid, jsonb),
  public.fab_avatar_buy(text, uuid, text), public.fab_coins_earn(text, uuid, integer) to anon, authenticated;
grant execute on function public.fab_class_avatars(uuid) to authenticated;
