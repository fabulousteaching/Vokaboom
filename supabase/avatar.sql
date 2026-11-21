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
--
-- 3D-Welt (Teilmal): avatar3d = 3D-Avatar, garage = Kart-Optik fürs Turbo-Rennen. Teile heissen „a3:<platz>:<wert>“ bzw.
-- „car:<platz>:<wert>“, kosten Münzen aus demselben Konto und können erst ab einer Anzahl gesammelter Münzen freigeschaltet sein.
-- Spiele bezahlen Kinder mit fab_coins_spend (mit Auftragsnummer, so wird nie doppelt abgebucht). Jede Ausgabe steht in fab_coin_log.
-- Münzensperre: Die Lehrperson kann einem Kind das Münzen-Verdienen sperren (heute, ein paar Tage oder bis sie es aufhebt);
-- üben und spielen geht weiter. Siehe fab_coin_locks / fab_teacher_coin_lock.
-- Umtausch 2D → 3D: Seit der 3D-Avatar in beiden Tools gilt, bekommt jedes Kind beim nächsten Laden für gekaufte 2D-Teile das
-- passende 3D-Teil geschenkt; für 2D-Teile ohne 3D-Gegenstück (oder deren Gegenstück gratis ist) gibt es die Münzen zurück.

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
-- 3D-Avatar und Kart (seit der 3D-Welt; bestehende Daten bleiben unverändert)
alter table public.fab_avatars add column if not exists avatar3d jsonb not null default '{}'
  check (jsonb_typeof(avatar3d) = 'object' and octet_length(avatar3d::text) <= 3000);
alter table public.fab_avatars add column if not exists garage jsonb not null default '{}'
  check (jsonb_typeof(garage) = 'object' and octet_length(garage::text) <= 1000);
-- 2D-Teile, die schon in 3D umgetauscht bzw. zurückbezahlt wurden (nie doppelt)
alter table public.fab_avatars add column if not exists m2d text[] not null default '{}';
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
-- Freischaltung: manche Teile gibt es erst ab so vielen insgesamt gesammelten Münzen (0 = sofort)
alter table public.fab_avatar_items add column if not exists min_earned integer not null default 0 check (min_earned >= 0);
-- 3D-Avatar (a3:…) und Kart (car:…) – Grundausstattung ist gratis und steht darum nicht in der Liste
insert into public.fab_avatar_items (id, price, min_earned) values
  ('a3:eyes:star', 10, 0), ('a3:eyes:heart', 10, 0), ('a3:eyes:cat', 10, 0), ('a3:eyes:sparkle', 12, 0), ('a3:mouth:tongue', 6, 0),
  ('a3:mouth:wavy', 6, 0), ('a3:mouth:cat', 8, 0), ('a3:mouth:fang', 8, 0), ('a3:mouth:kiss', 8, 0), ('a3:deco:bandaid', 5, 0),
  ('a3:deco:whiskers', 8, 0), ('a3:deco:stars', 10, 0), ('a3:deco:hearts', 10, 0), ('a3:deco:paint', 12, 0), ('a3:hair:mohawk', 15, 0),
  ('a3:hairC:rainbow', 20, 0), ('a3:top:jersey', 12, 0), ('a3:top:denim', 12, 0), ('a3:top:sport', 15, 0), ('a3:top:puffer', 15, 0),
  ('a3:top:pastel', 18, 0), ('a3:top:overalls', 12, 0), ('a3:top:tux', 22, 0), ('a3:top:robe', 25, 0), ('a3:top:hero', 28, 0),
  ('a3:top:space', 30, 40), ('a3:bottom:cargo', 10, 0), ('a3:bottom:tutu', 15, 0), ('a3:shoes:slippers', 8, 0), ('a3:shoes:boots', 10, 0),
  ('a3:shoes:rollers', 18, 0), ('a3:shoes:rocket', 25, 30), ('a3:hat:cap', 8, 0), ('a3:hat:capback', 8, 0), ('a3:hat:beanie', 8, 0),
  ('a3:hat:bucket', 10, 0), ('a3:hat:helmet', 10, 0), ('a3:hat:party', 10, 0), ('a3:hat:flower', 12, 0), ('a3:hat:catbeanie', 15, 0),
  ('a3:hat:bunny', 15, 0), ('a3:hat:headset', 15, 0), ('a3:hat:tiara', 18, 0), ('a3:hat:viking', 22, 0), ('a3:hat:wizard', 25, 0),
  ('a3:hat:crown', 35, 60), ('a3:glasses:sun', 10, 0), ('a3:glasses:star', 12, 0), ('a3:glasses:heart', 12, 0), ('a3:glasses:goggles', 15, 0),
  ('a3:glasses:visor', 18, 0), ('a3:neck:scarf', 8, 0), ('a3:neck:bandana', 8, 0), ('a3:neck:bowtie', 10, 0), ('a3:neck:medal', 15, 0),
  ('a3:neck:pearls', 15, 0), ('a3:neck:headphones', 18, 0), ('a3:neck:goldchain', 20, 0), ('a3:wrist:band', 6, 0), ('a3:wrist:bracelet', 10, 0),
  ('a3:wrist:watch', 12, 0), ('a3:wrist:smartwatch', 15, 0), ('a3:bag:fanny', 10, 0), ('a3:bag:messenger', 12, 0), ('a3:bag:paw', 15, 0),
  ('a3:hand:pencil', 6, 0), ('a3:hand:calculator', 8, 0), ('a3:hand:book', 8, 0), ('a3:hand:flag', 8, 0), ('a3:hand:lollipop', 8, 0),
  ('a3:hand:balloon', 10, 0), ('a3:hand:icecream', 10, 0), ('a3:hand:magnifier', 10, 0), ('a3:hand:glowstick', 10, 0), ('a3:hand:basketball', 12, 0),
  ('a3:hand:flowers', 12, 0), ('a3:hand:umbrella', 12, 0), ('a3:hand:teddy', 15, 0), ('a3:hand:gamepad', 15, 0), ('a3:hand:microphone', 15, 0),
  ('a3:hand:camera', 15, 0), ('a3:hand:wand', 18, 0), ('a3:hand:trophy', 20, 0), ('a3:hand:skateboard', 20, 0), ('a3:hand:guitar', 25, 0),
  ('a3:back:backpack', 12, 0), ('a3:back:guitar', 22, 0), ('a3:back:cape', 25, 0), ('a3:back:butterfly', 30, 0), ('a3:back:wings', 35, 0),
  ('a3:back:jetpack', 40, 50), ('a3:back:dragon', 40, 50), ('a3:pet:cat', 35, 0), ('a3:pet:dog', 35, 0), ('a3:pet:bunny', 35, 0),
  ('a3:pet:robot', 45, 80), ('a3:pet:dragon', 50, 100), ('a3:effect:bubbles', 20, 0), ('a3:effect:notes', 20, 0), ('a3:effect:sparkles', 25, 0),
  ('a3:effect:hearts', 25, 0), ('a3:effect:aura', 35, 60), ('a3:emote:clap', 6, 0), ('a3:emote:jump', 8, 0), ('a3:emote:think', 8, 0),
  ('a3:emote:bow', 8, 0), ('a3:emote:shy', 8, 0), ('a3:emote:sit', 10, 0), ('a3:emote:flex', 10, 0), ('a3:emote:laugh', 10, 0),
  ('a3:emote:dance', 15, 0), ('a3:emote:spin', 15, 0), ('car:body:bathtub', 20, 0), ('car:body:hotdog', 25, 0), ('car:body:duck', 25, 0),
  ('car:body:shark', 30, 0), ('car:body:rocket', 30, 0), ('car:body:monster', 30, 0), ('car:body:carriage', 35, 0), ('car:body:ufo', 40, 50),
  ('car:finish:matte', 10, 0), ('car:finish:metal', 12, 0), ('car:finish:pearl', 18, 0), ('car:finish:glow', 20, 0), ('car:finish:chrome', 25, 40),
  ('car:pattern:center', 8, 0), ('car:pattern:racing', 10, 0), ('car:pattern:duo', 12, 0), ('car:pattern:dots', 12, 0), ('car:pattern:stars', 15, 0),
  ('car:pattern:checker', 15, 0), ('car:pattern:lightning', 18, 0), ('car:pattern:flames', 20, 0), ('car:rims:black', 8, 0),
  ('car:rims:star', 12, 0), ('car:rims:spoke', 12, 0), ('car:rims:turbine', 15, 0), ('car:rims:gold', 20, 0), ('car:rims:neon', 22, 0),
  ('car:wing:duck', 10, 0), ('car:wing:big', 15, 0), ('car:wing:fin', 18, 0), ('car:wing:double', 20, 0), ('car:exhaust:black', 8, 0),
  ('car:exhaust:gold', 12, 0), ('car:exhaust:quad', 15, 0), ('car:flames:blue', 12, 0), ('car:flames:green', 12, 0), ('car:flames:violet', 12, 0),
  ('car:flames:plasma', 18, 0), ('car:flames:rainbow', 25, 0), ('car:glow:cyan', 18, 0), ('car:glow:pink', 18, 0), ('car:glow:green', 18, 0),
  ('car:glow:violet', 18, 0), ('car:glow:gold', 20, 0), ('car:glow:rainbow', 30, 50)
on conflict (id) do update set price = excluded.price, min_earned = excluded.min_earned;
-- Erweiterung: noch mehr Teile (Stufen nach Preis: bis 10 Normal, bis 20 Gold, bis 35 Episch, darüber Legendär)
insert into public.fab_avatar_items (id, price, min_earned) values
  ('a3:eyes:spiral', 12, 0), ('a3:eyes:robot', 14, 0), ('a3:eyes:diamond', 22, 0), ('a3:top:striped', 8, 0), ('a3:top:hawaii', 14, 0),
  ('a3:hat:ninja', 8, 0), ('a3:hat:chef', 10, 0), ('a3:hat:santa', 10, 0), ('a3:hat:antlers', 15, 0), ('a3:hat:propeller', 15, 0),
  ('a3:hat:frog', 16, 0), ('a3:hat:cowboy', 16, 0), ('a3:hat:graduation', 18, 0), ('a3:hat:pirate', 20, 0), ('a3:hat:tophat', 20, 0),
  ('a3:hat:unicorn', 28, 0), ('a3:hat:dino', 30, 0), ('a3:hat:halo', 45, 80), ('a3:glasses:monocle', 14, 0), ('a3:glasses:ski', 16, 0),
  ('a3:glasses:mask', 18, 0), ('a3:glasses:rainbow', 22, 0), ('a3:glasses:pixel', 25, 0), ('a3:neck:whistle', 6, 0), ('a3:neck:tie', 8, 0),
  ('a3:neck:lei', 14, 0), ('a3:neck:diamond', 42, 80), ('a3:hand:donut', 8, 0), ('a3:hand:pizza', 8, 0), ('a3:hand:paintbrush', 8, 0),
  ('a3:hand:duck', 10, 0), ('a3:hand:tennis', 14, 0), ('a3:hand:telescope', 15, 0), ('a3:hand:fishing', 16, 0), ('a3:hand:lantern', 16, 0),
  ('a3:hand:sword', 26, 0), ('a3:hand:trident', 30, 0), ('a3:hand:orb', 40, 0), ('a3:hand:laser', 45, 80), ('a3:back:quiver', 18, 0),
  ('a3:back:tank', 18, 0), ('a3:back:surfboard', 26, 0), ('a3:back:shell', 28, 0), ('a3:back:bat', 32, 0), ('a3:back:fairy', 42, 0),
  ('a3:back:phoenix', 55, 120), ('a3:pet:penguin', 35, 0), ('a3:pet:owl', 38, 0), ('a3:pet:parrot', 38, 0), ('a3:pet:fox', 40, 0),
  ('a3:pet:panda', 42, 0), ('a3:pet:slime', 45, 60), ('a3:pet:unicorn', 60, 150), ('a3:effect:snow', 22, 0), ('a3:effect:leaves', 22, 0),
  ('a3:effect:confetti', 30, 0), ('a3:effect:lightning', 40, 80), ('a3:effect:fire', 48, 100), ('a3:effect:coins', 60, 150), ('a3:emote:run', 10, 0),
  ('a3:emote:robo', 15, 0), ('a3:emote:hero', 22, 0), ('car:body:banana', 25, 0), ('car:body:shoe', 28, 0), ('car:body:snail', 30, 0),
  ('car:body:bee', 32, 0), ('car:body:dragon', 50, 100), ('car:finish:carbon', 16, 0), ('car:finish:candy', 24, 0), ('car:finish:neon', 28, 0),
  ('car:finish:gold', 45, 100), ('car:pattern:waves', 10, 0), ('car:pattern:camo', 14, 0), ('car:pattern:hearts', 15, 0), ('car:pattern:zebra', 15, 0),
  ('car:pattern:pixel', 16, 0), ('car:pattern:leopard', 16, 0), ('car:pattern:tiger', 18, 0), ('car:pattern:circuit', 25, 0), ('car:pattern:galaxy', 30, 0),
  ('car:pattern:rainbow', 36, 0), ('car:rims:flower', 14, 0), ('car:rims:fire', 24, 0), ('car:rims:rainbow', 28, 0), ('car:rims:diamond', 40, 80),
  ('car:wing:heart', 18, 0), ('car:wing:jet', 24, 0), ('car:wing:dragon', 30, 0), ('car:wing:angel', 42, 80), ('car:exhaust:candy', 14, 0),
  ('car:exhaust:trumpet', 16, 0), ('car:exhaust:rocket', 22, 0), ('car:flames:gold', 18, 0), ('car:flames:sun', 20, 0), ('car:flames:ice', 22, 0),
  ('car:flames:shadow', 24, 0), ('car:glow:red', 18, 0), ('car:glow:orange', 18, 0), ('car:glow:white', 18, 0), ('car:topper:flag', 8, 0),
  ('car:topper:antenna', 10, 0), ('car:topper:duck', 15, 0), ('car:topper:propeller', 18, 0), ('car:topper:siren', 25, 0), ('car:topper:crown', 32, 0),
  ('car:topper:unicorn', 40, 80), ('car:topper:trophy', 48, 120)
on conflict (id) do update set price = excluded.price, min_earned = excluded.min_earned;

-- Münz-Protokoll: jede Ausgabe (Kauf, Spiel) mit Zeit; request verhindert doppeltes Abbuchen
create table if not exists public.fab_coin_log (
  id bigint generated always as identity primary key,
  kid_key text not null,
  delta integer not null,
  reason text not null check (char_length(reason) <= 40),
  request uuid unique,
  at timestamptz not null default now()
);
create index if not exists fab_coin_log_kid on public.fab_coin_log (kid_key, at desc);
alter table public.fab_coin_log enable row level security;
revoke all on public.fab_coin_log from anon, authenticated;

-- Einstellungen der Lehrperson (gelten für alle ihre Klassen, in beiden Tools):
-- {"on": true, "coins": true, "shop": true, "games": true, "perCoin": 10, "dayMax": 40}
create table if not exists public.fab_teacher_settings (
  teacher_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  avatar jsonb not null default '{}' check (jsonb_typeof(avatar) = 'object' and octet_length(avatar::text) <= 2000),
  updated_at timestamptz not null default now()
);
-- Login-Kärtchen (gelten in Vokaboom und Teilmal gleich): {"secret": "pics|password|class", "names": "full|initials", "qr": true, "cls": true}
alter table public.fab_teacher_settings add column if not exists cards jsonb not null default '{}'
  check (jsonb_typeof(cards) = 'object' and octet_length(cards::text) <= 500);
alter table public.fab_teacher_settings enable row level security;
revoke all on public.fab_teacher_settings from anon, authenticated;
grant select, insert, update on public.fab_teacher_settings to authenticated;
drop policy if exists "eigene einstellungen" on public.fab_teacher_settings;
create policy "eigene einstellungen" on public.fab_teacher_settings for all to authenticated
  using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);

-- Münzensperre durch die Lehrperson: pro Kind und Tool (Schlüssel = Vokaboom- bzw. Teilmal-ID des Kindes).
-- Das Kind kann weiter üben und spielen, verdient aber keine Münzen. until = null: bis die Lehrperson sie aufhebt.
create table if not exists public.fab_coin_locks (
  student_id uuid primary key,
  teacher_id uuid not null default auth.uid(),
  until timestamptz,
  note text not null default '' check (char_length(note) <= 80),
  created_at timestamptz not null default now()
);
alter table public.fab_coin_locks enable row level security;
revoke all on public.fab_coin_locks from anon, authenticated;

-- Hilfe: Einstellungen der Lehrperson des Kindes (mit Standardwerten)
create or replace function public.fab_kid_cfg(p_app text, p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare tid uuid; sid uuid; cfg jsonb; lk jsonb;
begin
  if p_app = 'vokaboom' and to_regclass('public.vokaboom_sessions') is not null then
    select c.teacher_id, s.id into tid, sid from public.vokaboom_sessions x join public.vokaboom_students s on s.id = x.student_id
      join public.vokaboom_classes c on c.id = s.class_id where x.token = p_token;
  elsif p_app in ('einmaleins', 'teilmal') and to_regclass('public.einmaleins_sessions') is not null then
    select c.teacher_id, s.id into tid, sid from public.einmaleins_sessions x join public.einmaleins_students s on s.id = x.student_id
      join public.einmaleins_classes c on c.id = s.class_id where x.token = p_token;
  end if;
  -- Münzensperre der Lehrperson (nur solange sie gilt)
  select jsonb_build_object('until', l.until, 'at', l.created_at) into lk from public.fab_coin_locks l
    where l.student_id = sid and (l.until is null or l.until > now());
  select t.avatar into cfg from public.fab_teacher_settings t where t.teacher_id = tid;
  cfg := coalesce(cfg, '{}'::jsonb);
  return jsonb_build_object(
    'on', coalesce((cfg ->> 'on')::boolean, true),
    'coins', coalesce((cfg ->> 'coins')::boolean, true),
    'shop', coalesce((cfg ->> 'shop')::boolean, true),
    'games', coalesce((cfg ->> 'games')::boolean, true),
    'perCoin', least(30, greatest(3, coalesce((cfg ->> 'perCoin')::integer, 10))),
    'dayMax', least(100, greatest(0, coalesce((cfg ->> 'dayMax')::integer, 40))),
    'lock', lk);
end;
$$;

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
          m2d = (select coalesce(array_agg(distinct o), '{}') from unnest(a.m2d || b.m2d) o),
          avatar = case when b.updated_at > a.updated_at and b.avatar <> '{}'::jsonb then b.avatar else a.avatar end,
          avatar3d = case when (b.updated_at > a.updated_at or a.avatar3d = '{}'::jsonb) and b.avatar3d <> '{}'::jsonb then b.avatar3d else a.avatar3d end,
          garage = case when (b.updated_at > a.updated_at or a.garage = '{}'::jsonb) and b.garage <> '{}'::jsonb then b.garage else a.garage end,
          updated_at = now()
        where kid_key = vk;
        delete from public.fab_avatars where kid_key = ek;
      end if;
    end if;
  end if;
  return vk;
end;
$$;

drop function if exists public.fab_avatar_state(text);
create or replace function public.fab_avatar_state(k text, cfg jsonb default '{}'::jsonb)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('avatar', a.avatar, 'avatar3d', a.avatar3d, 'garage', a.garage, 'owned', to_jsonb(a.owned), 'coins', a.coins,
    'earned', a.earned, 'spent', a.spent, 'today', case when a.day = current_date then a.day_coins else 0 end)
    from public.fab_avatars a where a.kid_key = k),
    jsonb_build_object('avatar', '{}'::jsonb, 'avatar3d', '{}'::jsonb, 'garage', '{}'::jsonb, 'owned', '[]'::jsonb, 'coins', 0, 'earned', 0, 'spent', 0, 'today', 0))
    || jsonb_build_object('cfg', cfg, 'dayMax', coalesce((cfg ->> 'dayMax')::integer, 40));
$$;

-- Umtausch 2D → 3D (einmal je gekauftem 2D-Teil): passendes 3D-Teil schenken, sonst Münzen zurück
create or replace function public.fab_migrate_2d(k text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.fab_avatars; it text; to3 text; refund integer := 0; add text[] := '{}'; done text[] := '{}'; pr integer;
  m constant jsonb := '{
    "hair:mohawk": "a3:hair:mohawk", "hairc:rainbow": "a3:hairC:rainbow", "eyes:star": "a3:eyes:star", "eyes:heart": "a3:eyes:heart",
    "mouth:tongue": "a3:mouth:tongue", "face:stars": "a3:deco:stars", "top:hero": "a3:top:hero", "top:space": "a3:top:space",
    "top:tux": "a3:top:tux", "bottom:cargo": "a3:bottom:cargo", "shoes:rocket": "a3:shoes:rocket", "shoes:roller": "a3:shoes:rollers",
    "hat:crown": "a3:hat:crown", "hat:wizard": "a3:hat:wizard", "hat:cat": "a3:hat:catbeanie", "hat:viking": "a3:hat:viking",
    "hat:party": "a3:hat:party", "glasses:star": "a3:glasses:star", "glasses:heart": "a3:glasses:heart", "back:cape": "a3:back:cape",
    "back:wings": "a3:back:wings", "back:dragon": "a3:back:dragon", "back:jetpack": "a3:back:jetpack", "hand:wand": "a3:hand:wand",
    "hand:trophy": "a3:hand:trophy", "hand:guitar": "a3:hand:guitar", "pet:cat": "a3:pet:cat", "pet:dog": "a3:pet:dog",
    "pet:dragon": "a3:pet:dragon", "pet:bunny": "a3:pet:bunny"
  }';
begin
  select * into a from public.fab_avatars where kid_key = k for update;
  if not found then return; end if;
  foreach it in array a.owned loop
    if it like 'a3:%' or it like 'car:%' or it = any (a.m2d) then continue; end if;
    to3 := m ->> it;
    if to3 is not null and exists (select 1 from public.fab_avatar_items i where i.id = to3) then
      if not (to3 = any (a.owned) or to3 = any (add)) then add := add || to3; end if;
    else
      select price into pr from public.fab_avatar_items where id = it;
      refund := refund + coalesce(pr, 0);
    end if;
    done := done || it;
  end loop;
  if cardinality(done) = 0 then return; end if;
  update public.fab_avatars set owned = owned || add, m2d = m2d || done, coins = coins + refund,
    spent = greatest(0, spent - refund), updated_at = now() where kid_key = k;
  if refund > 0 then insert into public.fab_coin_log (kid_key, delta, reason) values (k, refund, 'umtausch 2d-teile'); end if;
end;
$$;

-- Kind: Avatar, gekaufte Teile und Münzen holen
create or replace function public.fab_avatar_get(p_app text, p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  perform public.fab_migrate_2d(k);
  return public.fab_avatar_state(k, public.fab_kid_cfg(p_app, p_token));
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
  return public.fab_avatar_state(k, public.fab_kid_cfg(p_app, p_token));
end;
$$;

-- Kind: Teil mit Münzen kaufen
create or replace function public.fab_avatar_buy(p_app text, p_token uuid, p_item text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; pr integer; me integer; a public.fab_avatars;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  if not coalesce((public.fab_kid_cfg(p_app, p_token) ->> 'shop')::boolean, true) then raise exception 'shop_off' using errcode = 'P0001'; end if;
  select price, min_earned into pr, me from public.fab_avatar_items where id = p_item;
  if pr is null then raise exception 'no_item' using errcode = 'P0001'; end if;
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select * into a from public.fab_avatars where kid_key = k for update;
  if p_item = any (a.owned) then return public.fab_avatar_state(k, public.fab_kid_cfg(p_app, p_token)); end if;
  if a.earned < coalesce(me, 0) then raise exception 'locked' using errcode = 'P0001'; end if;
  if a.coins < pr then raise exception 'not_enough' using errcode = 'P0001'; end if;
  update public.fab_avatars set coins = coins - pr, spent = spent + pr, owned = array_append(owned, p_item), updated_at = now() where kid_key = k;
  insert into public.fab_coin_log (kid_key, delta, reason) values (k, -pr, left('kauf ' || p_item, 40));
  return public.fab_avatar_state(k, public.fab_kid_cfg(p_app, p_token));
end;
$$;

-- Kind: verdiente Münzen gutschreiben (höchstens 5 pro Aufruf, pro Tag so viele, wie die Lehrperson erlaubt – Standard 40;
-- bei einer Münzensperre der Lehrperson keine)
create or replace function public.fab_coins_earn(p_app text, p_token uuid, p_n integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; a public.fab_avatars; n integer; today integer; cfg jsonb; dmax integer;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  cfg := public.fab_kid_cfg(p_app, p_token);
  dmax := case when (cfg ->> 'coins')::boolean then (cfg ->> 'dayMax')::integer else 0 end;
  if jsonb_typeof(cfg -> 'lock') = 'object' then dmax := 0; end if;   -- Münzensperre der Lehrperson
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select * into a from public.fab_avatars where kid_key = k for update;
  today := case when a.day = current_date then a.day_coins else 0 end;
  n := greatest(0, least(coalesce(p_n, 0), 5, dmax - today));
  update public.fab_avatars set coins = coins + n, earned = earned + n, day = current_date, day_coins = today + n, updated_at = now() where kid_key = k;
  return public.fab_avatar_state(k, cfg) || jsonb_build_object('granted', n, 'locked', jsonb_typeof(cfg -> 'lock') = 'object');
end;
$$;

-- Kind: 3D-Avatar speichern (nur Gratis-Teile oder gekaufte „a3:…“-Teile)
create or replace function public.fab_avatar3d_save(p_app text, p_token uuid, p_look jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; own text[]; bad text;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_look) <> 'object' or octet_length(p_look::text) > 3000 then raise exception 'bad_avatar' using errcode = '22023'; end if;
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select owned into own from public.fab_avatars where kid_key = k for update;
  select i.id into bad from jsonb_each_text(p_look) v join public.fab_avatar_items i on i.id = 'a3:' || v.key || ':' || v.value
    where not (i.id = any (own)) limit 1;
  if bad is not null then raise exception 'not_owned' using errcode = 'P0001', detail = bad; end if;
  update public.fab_avatars set avatar3d = p_look, updated_at = now() where kid_key = k;
  return public.fab_avatar_state(k, public.fab_kid_cfg(p_app, p_token));
end;
$$;

-- Kind: Kart-Optik aus der Garage speichern (nur Gratis-Teile oder gekaufte „car:…“-Teile; fährt immer gleich schnell)
create or replace function public.fab_garage_save(p_app text, p_token uuid, p_car jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; own text[]; bad text;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_car) <> 'object' or octet_length(p_car::text) > 1000 then raise exception 'bad_car' using errcode = '22023'; end if;
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select owned into own from public.fab_avatars where kid_key = k for update;
  select i.id into bad from jsonb_each_text(p_car) v join public.fab_avatar_items i on i.id = 'car:' || v.key || ':' || v.value
    where not (i.id = any (own)) limit 1;
  if bad is not null then raise exception 'not_owned' using errcode = 'P0001', detail = bad; end if;
  update public.fab_avatars set garage = p_car, updated_at = now() where kid_key = k;
  return public.fab_avatar_state(k, public.fab_kid_cfg(p_app, p_token));
end;
$$;

-- Kind: Münzen ausgeben (z. B. 1 Münze pro Spiel in Teilmal). Höchstens 5 auf einmal; nie unter 0.
-- p_request: Auftragsnummer vom Gerät. Kommt dieselbe Nummer nochmals (z. B. Netz kurz weg), wird nicht nochmals abgebucht.
create or replace function public.fab_coins_spend(p_app text, p_token uuid, p_n integer, p_reason text, p_request uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; a public.fab_avatars; n integer; cfg jsonb;
begin
  k := public.fab_kid_key(p_app, p_token);
  if k is null then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  n := coalesce(p_n, 0);
  if n < 1 or n > 5 then raise exception 'bad_amount' using errcode = '22023'; end if;
  if p_request is null then raise exception 'bad_request' using errcode = '22023'; end if;
  cfg := public.fab_kid_cfg(p_app, p_token);
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  select * into a from public.fab_avatars where kid_key = k for update;
  if exists (select 1 from public.fab_coin_log l where l.request = p_request) then
    return public.fab_avatar_state(k, cfg) || jsonb_build_object('charged', 0, 'repeat', true);
  end if;
  if a.coins < n then raise exception 'not_enough' using errcode = 'P0001'; end if;
  update public.fab_avatars set coins = coins - n, spent = spent + n, updated_at = now() where kid_key = k;
  insert into public.fab_coin_log (kid_key, delta, reason, request) values (k, -n, left(coalesce(nullif(p_reason, ''), 'spiel'), 40), p_request);
  return public.fab_avatar_state(k, cfg) || jsonb_build_object('charged', n);
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

-- Lehrperson: Bonus-Münzen für ein Kind (z. B. für eine besondere Leistung), höchstens 50 auf einmal
create or replace function public.fab_teacher_bonus(p_student uuid, p_n integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare k text; n integer;
begin
  -- p_student: Vokaboom-Kind oder Teilmal-Kind der Lehrperson (verbunden → derselbe Avatar wie in Vokaboom)
  if exists (select 1 from public.vokaboom_students s join public.vokaboom_classes c on c.id = s.class_id where s.id = p_student and c.teacher_id = auth.uid()) then
    k := 'v:' || p_student;
  elsif to_regclass('public.einmaleins_students') is not null then
    execute 'select case when e.vokaboom_id is not null then ''v:'' || e.vokaboom_id else ''e:'' || e.id end
      from public.einmaleins_students e join public.einmaleins_classes c on c.id = e.class_id where e.id = $1 and c.teacher_id = auth.uid()'
      into k using p_student;
  end if;
  if k is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  n := greatest(1, least(coalesce(p_n, 0), 50));
  insert into public.fab_avatars (kid_key) values (k) on conflict do nothing;
  update public.fab_avatars set coins = coins + n, earned = earned + n, updated_at = now() where kid_key = k;
  return n;
end;
$$;

-- Hilfe: Gehört dieses Kind (Vokaboom- oder Teilmal-ID) der angemeldeten Lehrperson?
create or replace function public.fab_teacher_owns(p_student uuid)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare ok boolean := false;
begin
  if auth.uid() is null or p_student is null then return false; end if;
  if to_regclass('public.vokaboom_students') is not null then
    execute 'select exists (select 1 from public.vokaboom_students s join public.vokaboom_classes c on c.id = s.class_id
      where s.id = $1 and c.teacher_id = auth.uid())' into ok using p_student;
  end if;
  if not coalesce(ok, false) and to_regclass('public.einmaleins_students') is not null then
    execute 'select exists (select 1 from public.einmaleins_students e join public.einmaleins_classes c on c.id = e.class_id
      where e.id = $1 and c.teacher_id = auth.uid())' into ok using p_student;
  end if;
  return coalesce(ok, false);
end;
$$;

-- Lehrperson: Münzen eines Kindes sperren (p_on = true) oder die Sperre aufheben (p_on = false).
-- p_until: bis wann (null = bis die Lehrperson sie aufhebt). Gilt im Tool, zu dem die ID gehört (Teilmal-Kind → Teilmal).
create or replace function public.fab_teacher_coin_lock(p_student uuid, p_on boolean, p_until timestamptz default null, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.fab_teacher_owns(p_student) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not coalesce(p_on, false) or p_until <= now() then
    delete from public.fab_coin_locks where student_id = p_student;
    return null;
  end if;
  insert into public.fab_coin_locks (student_id, teacher_id, until, note, created_at)
    values (p_student, auth.uid(), p_until, left(coalesce(p_note, ''), 80), now())
    on conflict (student_id) do update set teacher_id = excluded.teacher_id, until = excluded.until, note = excluded.note, created_at = now();
  return jsonb_build_object('until', p_until, 'at', now(), 'note', left(coalesce(p_note, ''), 80));
end;
$$;

-- Lehrperson: geltende Münzensperren der eigenen Kinder (für die Übersicht)
create or replace function public.fab_teacher_coin_locks(p_students uuid[])
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(l.student_id, jsonb_build_object('until', l.until, 'at', l.created_at, 'note', l.note)), '{}'::jsonb)
  from public.fab_coin_locks l
  where l.student_id = any (p_students[1:300]) and (l.until is null or l.until > now()) and public.fab_teacher_owns(l.student_id);
$$;

revoke all on function public.fab_kid_key(text, uuid), public.fab_avatar_state(text, jsonb), public.fab_kid_cfg(text, uuid), public.fab_migrate_2d(text),
  public.fab_teacher_owns(uuid) from public, anon, authenticated;
revoke all on function public.fab_teacher_coin_lock(uuid, boolean, timestamptz, text), public.fab_teacher_coin_locks(uuid[]) from public, anon;
grant execute on function public.fab_teacher_bonus(uuid, integer), public.fab_teacher_coin_lock(uuid, boolean, timestamptz, text),
  public.fab_teacher_coin_locks(uuid[]) to authenticated;
grant execute on function public.fab_avatar_get(text, uuid), public.fab_avatar_save(text, uuid, jsonb),
  public.fab_avatar_buy(text, uuid, text), public.fab_coins_earn(text, uuid, integer),
  public.fab_avatar3d_save(text, uuid, jsonb), public.fab_garage_save(text, uuid, jsonb),
  public.fab_coins_spend(text, uuid, integer, text, uuid) to anon, authenticated;
grant execute on function public.fab_class_avatars(uuid) to authenticated;
