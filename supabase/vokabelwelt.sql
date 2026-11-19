-- Vokaboom: Tabelle und Zugriffsregeln für gespeicherte Vokabelportionen
-- In Supabase unter «SQL Editor» einfügen und auf «Run» klicken. Mehrmals ausführen schadet nicht.
-- Funktioniert in einem eigenen Projekt und auch im SmartSlots-Projekt (eigene Tabelle, nichts wird überschrieben).

create table if not exists public.vokabelwelt_sets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id text not null check (char_length(set_id) between 1 and 40),
  name text not null default '' check (char_length(name) <= 200),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 3000000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, set_id)
);

-- Nur angemeldete Personen, und jede nur mit ihren eigenen Portionen
alter table public.vokabelwelt_sets enable row level security;
revoke all on public.vokabelwelt_sets from anon;
grant select, insert, update, delete on public.vokabelwelt_sets to authenticated;

drop policy if exists "vokabelwelt lesen" on public.vokabelwelt_sets;
drop policy if exists "vokabelwelt erstellen" on public.vokabelwelt_sets;
drop policy if exists "vokabelwelt ändern" on public.vokabelwelt_sets;
drop policy if exists "vokabelwelt löschen" on public.vokabelwelt_sets;
create policy "vokabelwelt lesen" on public.vokabelwelt_sets for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "vokabelwelt erstellen" on public.vokabelwelt_sets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "vokabelwelt ändern" on public.vokabelwelt_sets for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "vokabelwelt löschen" on public.vokabelwelt_sets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Bei jeder Änderung: Zeit festhalten; ändern sich die Daten, zählt «version» hoch.
create or replace function public.vokabelwelt_sets_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id;
  new.set_id := old.set_id;
  new.created_at := old.created_at;
  if new.data is distinct from old.data then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;

drop trigger if exists vokabelwelt_sets_touch on public.vokabelwelt_sets;
create trigger vokabelwelt_sets_touch before update on public.vokabelwelt_sets
  for each row execute function public.vokabelwelt_sets_touch();

-- ---------------------------------------------------------------------------
-- Portionen von anderen finden: öffentliche Kopien der Portionen, die ihr Besitzer
-- im Teilen-Fenster „In der Suche zeigen“ freigibt. Nur Name, Vokabeln und Bildauswahl
-- (keine eigenen Fotos, kein Übungsstand). Lesen darf jede Person, auch ohne Konto;
-- schreiben und löschen nur der Besitzer. Wer die Portion besitzt, sehen Fremde nicht.

create table if not exists public.vokabelwelt_public (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id text not null check (char_length(set_id) between 1 and 40),
  name text not null check (char_length(name) between 1 and 200),
  words jsonb not null check (jsonb_typeof(words) = 'array' and jsonb_array_length(words) between 1 and 400 and octet_length(words::text) <= 200000),
  word_count integer generated always as (jsonb_array_length(words)) stored,
  search text not null default '' check (char_length(search) <= 20000),
  pic_style text not null default 'picto' check (pic_style in ('picto', 'clipart', 'emoji')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, set_id)
);
create index if not exists vokabelwelt_public_updated on public.vokabelwelt_public (updated_at desc);

-- Sprache der Portion (Englisch oder Französisch)
alter table public.vokabelwelt_public add column if not exists lang text not null default 'en' check (lang in ('en', 'fr'));

alter table public.vokabelwelt_public enable row level security;
revoke all on public.vokabelwelt_public from anon, authenticated;
-- Lesen: alle Spalten außer dem Besitzer
grant select (set_id, name, words, word_count, search, pic_style, lang, created_at, updated_at) on public.vokabelwelt_public to anon, authenticated;
-- Der Besitzer braucht seine eigene Spalte zum Speichern
grant select (user_id) on public.vokabelwelt_public to authenticated;
grant insert, update, delete on public.vokabelwelt_public to authenticated;

drop policy if exists "suche lesen" on public.vokabelwelt_public;
drop policy if exists "suche erstellen" on public.vokabelwelt_public;
drop policy if exists "suche ändern" on public.vokabelwelt_public;
drop policy if exists "suche löschen" on public.vokabelwelt_public;
create policy "suche lesen" on public.vokabelwelt_public for select to anon, authenticated using (true);
create policy "suche erstellen" on public.vokabelwelt_public for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "suche ändern" on public.vokabelwelt_public for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "suche löschen" on public.vokabelwelt_public for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.vokabelwelt_public_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id;
  new.set_id := old.set_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists vokabelwelt_public_touch on public.vokabelwelt_public;
create trigger vokabelwelt_public_touch before update on public.vokabelwelt_public
  for each row execute function public.vokabelwelt_public_touch();

-- ---------------------------------------------------------------------------
-- Bibliothek: Fach (Sprache) → Lehrmittel → Schuljahr → Unit → Portion.
-- Lehrmittel und Units legen Lehrpersonen selbst an. Gleiche Namen (auch anders geschrieben:
-- gross/klein, Leerzeichen, Akzente, Satzzeichen) gibt es nur einmal – die Datenbank lehnt Doppelte ab.

create or replace function public.vokaboom_lib_key(t text)
returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(t, '')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæß', 'aaaaaaceeeeiiiinooooouuuuyyoas'), '[^a-z0-9]', '', 'g');
$$;

create table if not exists public.vokaboom_lib_lehrmittel (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('en', 'fr')),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  key text generated always as (public.vokaboom_lib_key(name)) stored,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(public.vokaboom_lib_key(name)) >= 2)
);
create unique index if not exists vokaboom_lib_lehrmittel_key on public.vokaboom_lib_lehrmittel (lang, key);

-- Schuljahr: 1–9 = 1. bis 9. Klasse, 10 = ab 10. Schuljahr
create table if not exists public.vokaboom_lib_units (
  id uuid primary key default gen_random_uuid(),
  lehrmittel_id uuid not null references public.vokaboom_lib_lehrmittel (id) on delete cascade,
  grade smallint not null check (grade between 1 and 10),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  key text generated always as (public.vokaboom_lib_key(name)) stored,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(public.vokaboom_lib_key(name)) >= 1)
);
create unique index if not exists vokaboom_lib_units_key on public.vokaboom_lib_units (lehrmittel_id, grade, key);

alter table public.vokaboom_lib_lehrmittel enable row level security;
alter table public.vokaboom_lib_units enable row level security;
revoke all on public.vokaboom_lib_lehrmittel, public.vokaboom_lib_units from anon, authenticated;
grant select (id, lang, name, key, created_at) on public.vokaboom_lib_lehrmittel to anon, authenticated;
grant select (id, lehrmittel_id, grade, name, key, created_at) on public.vokaboom_lib_units to anon, authenticated;
grant insert (lang, name) on public.vokaboom_lib_lehrmittel to authenticated;
grant insert (lehrmittel_id, grade, name) on public.vokaboom_lib_units to authenticated;
drop policy if exists "bibliothek lesen" on public.vokaboom_lib_lehrmittel;
drop policy if exists "bibliothek anlegen" on public.vokaboom_lib_lehrmittel;
drop policy if exists "bibliothek lesen" on public.vokaboom_lib_units;
drop policy if exists "bibliothek anlegen" on public.vokaboom_lib_units;
create policy "bibliothek lesen" on public.vokaboom_lib_lehrmittel for select to anon, authenticated using (true);
create policy "bibliothek anlegen" on public.vokaboom_lib_lehrmittel for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "bibliothek lesen" on public.vokaboom_lib_units for select to anon, authenticated using (true);
create policy "bibliothek anlegen" on public.vokaboom_lib_units for insert to authenticated with check ((select auth.uid()) = created_by);

-- Portion einer Unit zuordnen (leer = noch nicht eingeordnet)
alter table public.vokabelwelt_public add column if not exists unit_id uuid references public.vokaboom_lib_units (id) on delete set null;
create index if not exists vokabelwelt_public_unit on public.vokabelwelt_public (unit_id);
grant select (unit_id) on public.vokabelwelt_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Klassen und Kinder-Logins
-- Die Lehrperson legt Klassen an, trägt Vorname + ersten Buchstaben des Nachnamens ein
-- und gibt Portionen frei. Kinder melden sich mit Benutzername (z. B. Baum34) und drei
-- Bildern an – ohne E-Mail und ohne Supabase-Konto. Alles, was Kinder tun, läuft über die
-- Funktionen unten (security definer) und prüft dort den Anmelde-Schlüssel.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.vokaboom_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  set_ids text[] not null default '{}' check (cardinality(set_ids) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists vokaboom_classes_teacher on public.vokaboom_classes (teacher_id);
-- Ausnahmen für einzelne Kinder: {"<Kind-ID>": {"h": [Portionen, die das Kind nicht sieht], "g": {"<Portion>": [ausgeschaltete Spiele]}}}
alter table public.vokaboom_classes add column if not exists rules jsonb not null default '{}';
alter table public.vokaboom_classes drop constraint if exists vokaboom_classes_rules_check;
alter table public.vokaboom_classes add constraint vokaboom_classes_rules_check
  check (jsonb_typeof(rules) = 'object' and octet_length(rules::text) <= 200000);

create table if not exists public.vokaboom_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.vokaboom_classes (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  last_initial text not null default '' check (char_length(last_initial) <= 1),
  username text not null unique check (username ~ '^[a-z]+[0-9]{2,4}$'),
  pics text not null check (pics ~ '^([0-9]|1[01]),([0-9]|1[01]),([0-9]|1[01])$'),
  created_at timestamptz not null default now()
);
create index if not exists vokaboom_students_class on public.vokaboom_students (class_id);

-- Passwort zum Eintippen (Alternative zu den Bildern), von der Plattform erzeugt: ein Wort und eine Zahl, z. B. „teich23“
-- (andere Wörter als bei den Benutzernamen). Jedes Kind hat beides: Bilder und Passwort. Was aufs Kärtchen kommt,
-- wählt die Lehrperson.
create or replace function public.vokaboom_new_pw()
returns text
language sql volatile set search_path = '' as $$
  select (array['teich', 'wiese', 'wald', 'bach', 'see', 'hafen', 'garten', 'turm', 'strand', 'stein', 'regen', 'schnee', 'nebel', 'wind', 'blatt', 'nest', 'feder', 'kerze', 'lampe', 'tisch', 'stuhl', 'fenster', 'dach', 'zelt', 'kiste', 'korb', 'glocke', 'ring', 'perle', 'mantel', 'schal', 'socke', 'kappe', 'brille', 'pinsel', 'farbe', 'papier', 'karte', 'nudel', 'suppe', 'honig', 'butter', 'zucker', 'kakao', 'tomate', 'gurke', 'karotte', 'mais', 'nuss', 'beere', 'traube', 'zitrone', 'orange', 'flocke', 'welle', 'sonnenhut', 'kugel', 'besen', 'leiter', 'koffer'])[1 + floor(random() * 60)::integer]
    || (10 + floor(random() * 90)::integer)::text;
$$;
-- Eingabe prüfen: Gross/klein, Leerzeichen, Bindestriche und ä/ö/ü (statt ae/oe/ue) spielen keine Rolle
create or replace function public.vokaboom_pw_norm(t text)
returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(replace(replace(replace(replace(lower(coalesce(t, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '[^a-z0-9]', '', 'g');
$$;
create or replace function public.vokaboom_pw_ok(p_pw text, p_input text)
returns boolean
language sql immutable set search_path = '' as $$
  select p_pw is not null and p_input is not null and length(p_input) <= 80
    and length(public.vokaboom_pw_norm(p_pw)) >= 4 and public.vokaboom_pw_norm(p_pw) = public.vokaboom_pw_norm(p_input);
$$;
-- Klassenpasswort: eines für alle Kinder der Klasse, von der Lehrperson festgelegt (leer = keines)
alter table public.vokaboom_classes add column if not exists class_pw text;
alter table public.vokaboom_classes drop constraint if exists vokaboom_classes_class_pw_check;
alter table public.vokaboom_classes add constraint vokaboom_classes_class_pw_check
  check (class_pw is null or (char_length(class_pw) <= 40 and length(public.vokaboom_pw_norm(class_pw)) >= 4));
alter table public.vokaboom_students add column if not exists pw text;
alter table public.vokaboom_students drop constraint if exists vokaboom_students_pw_check;
-- einfache Passwörter: frühere lange Passwörter („blau-tiger-47“) einmalig durch kurze ersetzen.
-- Das alte Passwort bleibt in pw_prev gültig (gedruckte Kärtchen), bis die Lehrperson „neues Passwort“ wählt.
alter table public.vokaboom_students add column if not exists pw_prev text check (pw_prev is null or char_length(pw_prev) <= 40);
update public.vokaboom_students set pw_prev = case when pw like '%-%' then pw else pw_prev end, pw = public.vokaboom_new_pw()
  where pw is null or pw like '%-%';
alter table public.vokaboom_students alter column pw set default public.vokaboom_new_pw();
alter table public.vokaboom_students alter column pw set not null;
alter table public.vokaboom_students add constraint vokaboom_students_pw_check check (pw ~ '^[a-z]{3,12}[0-9]{2}$');

-- Jeder Benutzername wird nur einmal vergeben, auch wenn das Kind später gelöscht wird
create table if not exists public.vokaboom_usernames (username text primary key);

create table if not exists public.vokaboom_sessions (
  token uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.vokaboom_students (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists vokaboom_sessions_student on public.vokaboom_sessions (student_id);

create table if not exists public.vokaboom_progress (
  student_id uuid not null references public.vokaboom_students (id) on delete cascade,
  set_id text not null check (char_length(set_id) between 1 and 40),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 300000),
  updated_at timestamptz not null default now(),
  primary key (student_id, set_id)
);

create table if not exists public.vokaboom_login_fails (
  username text primary key,
  fails integer not null default 0,
  last_at timestamptz not null default now()
);

-- Zugriffsregeln: Die Lehrperson sieht nur ihre eigenen Klassen, Kinder und deren Übungsstand.
alter table public.vokaboom_classes enable row level security;
alter table public.vokaboom_students enable row level security;
alter table public.vokaboom_usernames enable row level security;
alter table public.vokaboom_sessions enable row level security;
alter table public.vokaboom_progress enable row level security;
alter table public.vokaboom_login_fails enable row level security;

revoke all on public.vokaboom_classes, public.vokaboom_students, public.vokaboom_usernames,
  public.vokaboom_sessions, public.vokaboom_progress, public.vokaboom_login_fails from anon, authenticated;
grant select, insert, delete on public.vokaboom_classes to authenticated;
grant update (name, set_ids, rules, class_pw) on public.vokaboom_classes to authenticated;
grant select, delete on public.vokaboom_students to authenticated;
grant update (first_name, last_initial, pics, pw, pw_prev) on public.vokaboom_students to authenticated;
grant select on public.vokaboom_progress to authenticated;

drop policy if exists "klassen eigene" on public.vokaboom_classes;
create policy "klassen eigene" on public.vokaboom_classes for all to authenticated
  using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);

drop policy if exists "kinder lesen" on public.vokaboom_students;
drop policy if exists "kinder ändern" on public.vokaboom_students;
drop policy if exists "kinder löschen" on public.vokaboom_students;
create policy "kinder lesen" on public.vokaboom_students for select to authenticated
  using (exists (select 1 from public.vokaboom_classes c where c.id = class_id and c.teacher_id = (select auth.uid())));
create policy "kinder ändern" on public.vokaboom_students for update to authenticated
  using (exists (select 1 from public.vokaboom_classes c where c.id = class_id and c.teacher_id = (select auth.uid())))
  with check (exists (select 1 from public.vokaboom_classes c where c.id = class_id and c.teacher_id = (select auth.uid())));
create policy "kinder löschen" on public.vokaboom_students for delete to authenticated
  using (exists (select 1 from public.vokaboom_classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

drop policy if exists "übungsstand lesen" on public.vokaboom_progress;
create policy "übungsstand lesen" on public.vokaboom_progress for select to authenticated
  using (exists (select 1 from public.vokaboom_students s join public.vokaboom_classes c on c.id = s.class_id
    where s.id = student_id and c.teacher_id = (select auth.uid())));

-- Hilfe: Passwort eines Kindes prüfen – eigenes, früheres oder Klassenpasswort (auch für Teilmal)
create or replace function public.vokaboom_kid_pw_ok(p_vid uuid, p_input text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.vokaboom_pw_ok(s.pw, p_input) or public.vokaboom_pw_ok(s.pw_prev, p_input)
      or public.vokaboom_pw_ok(c.class_pw, p_input)
    from public.vokaboom_students s join public.vokaboom_classes c on c.id = s.class_id where s.id = p_vid), false);
$$;
revoke execute on function public.vokaboom_kid_pw_ok(uuid, text) from public, anon, authenticated;

-- Lehrperson: Kinder hinzufügen. Erzeugt eindeutige Benutzernamen und ein Bilder-Passwort.
-- p_students: [{"first": "Lena", "initial": "M"}, …]
create or replace function public.vokaboom_add_students(p_class uuid, p_students jsonb)
returns setof public.vokaboom_students
language plpgsql security definer set search_path = '' as $$
declare
  words text[] := array['baum', 'sonne', 'mond', 'stern', 'fisch', 'katze', 'hund', 'apfel', 'blume', 'wolke', 'pilz', 'vogel', 'fuchs', 'igel', 'frosch', 'biene', 'ball', 'boot', 'haus', 'herz', 'drache', 'pferd', 'maus', 'eule', 'wal', 'hase', 'kuh', 'panda', 'tiger', 'zebra', 'rakete', 'zug', 'auto', 'kirsche', 'birne', 'banane', 'keks', 'pizza', 'torte', 'krone', 'schiff', 'blitz', 'feuer', 'berg', 'insel', 'muschel', 'schnecke', 'raupe', 'kaktus', 'palme', 'ballon', 'gitarre', 'trommel', 'buch', 'stift', 'uhr', 'schuh', 'hut'];
  s jsonb; u text; tries integer; p text; fname text;
begin
  if not exists (select 1 from public.vokaboom_classes c where c.id = p_class and c.teacher_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) > 60 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  if (select count(*) from public.vokaboom_students st where st.class_id = p_class) + jsonb_array_length(p_students) > 60 then
    raise exception 'class_full' using errcode = '22023';
  end if;
  for s in select * from jsonb_array_elements(p_students) loop
    fname := left(btrim(coalesce(s->>'first', '')), 40);
    continue when fname = '';
    tries := 0;
    loop
      tries := tries + 1;
      u := words[1 + floor(random() * array_length(words, 1))::integer]
        || (case when tries <= 40 then 10 + floor(random() * 90)::integer
                 when tries <= 120 then 100 + floor(random() * 900)::integer
                 else 1000 + floor(random() * 9000)::integer end)::text;
      exit when not exists (select 1 from public.vokaboom_usernames x where x.username = u);
      if tries > 400 then raise exception 'no_username'; end if;
    end loop;
    insert into public.vokaboom_usernames (username) values (u);
    select string_agg(x::text, ',' order by r) into p
      from (select x, random() as r from generate_series(0, 11) as x order by random() limit 3) t;
    return query insert into public.vokaboom_students (class_id, first_name, last_initial, username, pics)
      values (p_class, fname, upper(left(btrim(coalesce(s->>'initial', '')), 1)), u, p)
      returning *;
  end loop;
end;
$$;

-- Kind: anmelden (p_pics: Bilder oder Passwort). Liefert einen Anmelde-Schlüssel oder null (falsch). Nach 8 Fehlversuchen 5 Minuten Pause.
create or replace function public.vokaboom_student_login(p_username text, p_pics text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st public.vokaboom_students; f public.vokaboom_login_fails; tok uuid;
begin
  p_username := lower(btrim(coalesce(p_username, '')));
  select * into f from public.vokaboom_login_fails x where x.username = p_username;
  if found and f.fails >= 8 and f.last_at > now() - interval '5 minutes' then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  select * into st from public.vokaboom_students x where x.username = p_username;
  -- richtig: die 3 Bilder („3,7,11“), das eigene Passwort („teich23“, auch das frühere) oder das Klassenpasswort
  if not found or (st.pics is distinct from p_pics and not public.vokaboom_kid_pw_ok(st.id, p_pics)) then
    insert into public.vokaboom_login_fails as lf (username, fails, last_at) values (p_username, 1, now())
      on conflict (username) do update set
        fails = case when lf.last_at < now() - interval '5 minutes' then 1 else lf.fails + 1 end,
        last_at = now();
    return null;
  end if;
  delete from public.vokaboom_login_fails x where x.username = p_username;
  delete from public.vokaboom_sessions x where x.student_id = st.id and x.last_seen < now() - interval '180 days';
  insert into public.vokaboom_sessions (student_id) values (st.id) returning token into tok;
  return jsonb_build_object('token', tok);
end;
$$;

-- Kind: Daten holen (freigegebene Portionen ohne Übungsstand der Lehrperson + eigener Übungsstand)
create or replace function public.vokaboom_student_data(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st public.vokaboom_students; cl public.vokaboom_classes; mine jsonb;
begin
  select s.* into st from public.vokaboom_sessions x join public.vokaboom_students s on s.id = x.student_id where x.token = p_token;
  if not found then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  update public.vokaboom_sessions set last_seen = now() where token = p_token;
  select * into cl from public.vokaboom_classes c where c.id = st.class_id;
  mine := coalesce(cl.rules -> st.id::text, '{}'::jsonb); -- Ausnahmen nur für dieses Kind
  return jsonb_build_object(
    'student', jsonb_build_object('first', st.first_name, 'initial', st.last_initial, 'username', st.username),
    'class', jsonb_build_object('name', cl.name),
    'sets', coalesce((select jsonb_agg(jsonb_build_object('set_id', v.set_id, 'data', v.data - 'progress') order by array_position(cl.set_ids, v.set_id))
      from public.vokabelwelt_sets v where v.user_id = cl.teacher_id and v.set_id = any (cl.set_ids)
        and not coalesce(mine -> 'h', '[]'::jsonb) ? v.set_id), '[]'::jsonb),
    'games_off', case when jsonb_typeof(mine -> 'g') = 'object' then mine -> 'g' else '{}'::jsonb end,
    'progress', coalesce((select jsonb_agg(jsonb_build_object('set_id', p.set_id, 'data', p.data))
      from public.vokaboom_progress p where p.student_id = st.id), '[]'::jsonb)
  );
end;
$$;

-- Kind: Übungsstand einer Portion speichern
create or replace function public.vokaboom_student_save(p_token uuid, p_set_id text, p_data jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  st public.vokaboom_students;
begin
  select s.* into st from public.vokaboom_sessions x join public.vokaboom_students s on s.id = x.student_id where x.token = p_token;
  if not found then raise exception 'session_invalid' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.vokaboom_classes c where c.id = st.class_id and p_set_id = any (c.set_ids)
      and not coalesce(c.rules -> st.id::text -> 'h', '[]'::jsonb) ? p_set_id) then
    raise exception 'not_assigned' using errcode = 'P0001';
  end if;
  insert into public.vokaboom_progress as pr (student_id, set_id, data, updated_at) values (st.id, p_set_id, p_data, now())
    on conflict (student_id, set_id) do update set data = excluded.data, updated_at = now();
  update public.vokaboom_sessions set last_seen = now() where token = p_token;
end;
$$;

-- Kind: abmelden
create or replace function public.vokaboom_student_logout(p_token uuid)
returns void
language sql security definer set search_path = '' as $$
  delete from public.vokaboom_sessions where token = p_token;
$$;

revoke execute on function public.vokaboom_add_students(uuid, jsonb) from public, anon;
grant execute on function public.vokaboom_add_students(uuid, jsonb) to authenticated;
revoke execute on function public.vokaboom_student_login(text, text), public.vokaboom_student_data(uuid),
  public.vokaboom_student_save(uuid, text, jsonb), public.vokaboom_student_logout(uuid) from public;
grant execute on function public.vokaboom_student_login(text, text), public.vokaboom_student_data(uuid),
  public.vokaboom_student_save(uuid, text, jsonb), public.vokaboom_student_logout(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audio-Speicher für die Vokaboom-Stimmen
-- Jedes Wort wird einmal auf dem Gerät der Lehrperson erzeugt und hier gespeichert.
-- Lesen darf jede Person (Kinder ohne Konto spielen die Dateien ab), hochladen nur
-- angemeldete Lehrpersonen und nur in ihren eigenen Ordner (Ordnername = Konto-ID).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vokaboom-audio', 'vokaboom-audio', true, 2097152, array['audio/wav'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vokaboom audio hochladen" on storage.objects;
create policy "vokaboom audio hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'vokaboom-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "vokaboom audio löschen" on storage.objects;
create policy "vokaboom audio löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'vokaboom-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
