create extension if not exists pgcrypto;

create type public.account_role as enum ('student', 'sensei');
create type public.trial_status as enum (
  'requested',
  'contacted',
  'trial_scheduled',
  'enrolled',
  'cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.account_role not null default 'student',
  bio text not null default '',
  rank text not null default '',
  years_experience integer check (years_experience is null or years_experience >= 0),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dojos (
  id uuid primary key default gen_random_uuid(),
  sensei_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  address text not null default '',
  city text not null default '',
  region text not null default '',
  postal_code text not null default '',
  country text not null default '',
  phone text not null default '',
  public_email text not null default '',
  website text not null default '',
  cover_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dojo_schedules (
  id uuid primary key default gen_random_uuid(),
  dojo_id uuid not null references public.dojos (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  class_name text not null check (length(trim(class_name)) between 1 and 100),
  age_group text not null default '',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.dojo_pricing (
  id uuid primary key default gen_random_uuid(),
  dojo_id uuid not null references public.dojos (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '',
  monthly_price numeric(10, 2) not null check (monthly_price >= 0),
  currency char(3) not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trial_requests (
  id uuid primary key default gen_random_uuid(),
  dojo_id uuid not null references public.dojos (id) on delete restrict,
  sensei_id uuid not null references public.profiles (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  student_name text not null check (length(trim(student_name)) between 1 and 100),
  student_email text not null check (length(trim(student_email)) between 3 and 320),
  student_phone text not null default '',
  preferred_date date,
  message text not null default '',
  status public.trial_status not null default 'requested',
  sensei_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_videos (
  id uuid primary key default gen_random_uuid(),
  sensei_id uuid not null references public.profiles (id) on delete cascade,
  dojo_id uuid references public.dojos (id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  storage_path text not null unique,
  thumbnail_path text,
  event_name text not null default '',
  recorded_on date,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.belt_stories (
  id uuid primary key default gen_random_uuid(),
  sensei_id uuid not null references public.profiles (id) on delete cascade,
  dojo_id uuid references public.dojos (id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  story text not null default '',
  student_display_name text not null default '',
  belt_from text not null default '',
  belt_to text not null default '',
  promoted_on date,
  image_path text,
  student_consented boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_published = false or student_consented)
);

create table public.video_bookmarks (
  student_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.tournament_videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, video_id)
);

create table public.belt_progressions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  dojo_id uuid not null references public.dojos (id) on delete cascade,
  sensei_id uuid not null references public.profiles (id) on delete restrict,
  belt_name text not null check (length(trim(belt_name)) between 1 and 80),
  promoted_on date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, dojo_id, belt_name, promoted_on)
);

create index dojos_published_location_idx
  on public.dojos (country, region, city, postal_code)
  where is_published;
create index dojos_sensei_idx on public.dojos (sensei_id);
create index dojo_schedules_dojo_day_idx on public.dojo_schedules (dojo_id, day_of_week, starts_at);
create index dojo_pricing_active_idx on public.dojo_pricing (dojo_id, monthly_price) where is_active;
create index trial_requests_sensei_status_created_idx
  on public.trial_requests (sensei_id, status, created_at desc);
create index trial_requests_student_created_idx
  on public.trial_requests (student_id, created_at desc);
create index tournament_videos_published_created_idx
  on public.tournament_videos (created_at desc) where is_published;
create index belt_stories_published_created_idx
  on public.belt_stories (created_at desc) where is_published;
create index belt_progressions_student_date_idx
  on public.belt_progressions (student_id, promoted_on desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger dojos_set_updated_at before update on public.dojos
  for each row execute function public.set_updated_at();
create trigger dojo_pricing_set_updated_at before update on public.dojo_pricing
  for each row execute function public.set_updated_at();
create trigger trial_requests_set_updated_at before update on public.trial_requests
  for each row execute function public.set_updated_at();
create trigger tournament_videos_set_updated_at before update on public.tournament_videos
  for each row execute function public.set_updated_at();
create trigger belt_stories_set_updated_at before update on public.belt_stories
  for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), '')
  );
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.is_sensei()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'sensei'
  );
$$;

create or replace function public.owns_dojo(target_dojo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dojos d
    where d.id = target_dojo_id
      and d.sensei_id = (select auth.uid())
  );
$$;

revoke all on function public.is_sensei() from public, anon;
revoke all on function public.owns_dojo(uuid) from public, anon;
grant execute on function public.is_sensei() to authenticated;
grant execute on function public.owns_dojo(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.dojos enable row level security;
alter table public.dojo_schedules enable row level security;
alter table public.dojo_pricing enable row level security;
alter table public.trial_requests enable row level security;
alter table public.tournament_videos enable row level security;
alter table public.belt_stories enable row level security;
alter table public.video_bookmarks enable row level security;
alter table public.belt_progressions enable row level security;

grant select on public.profiles to anon, authenticated;
grant update (display_name, bio, rank, years_experience, avatar_path)
  on public.profiles to authenticated;
grant select on public.dojos, public.dojo_schedules, public.dojo_pricing,
  public.tournament_videos, public.belt_stories to anon, authenticated;
grant insert, update, delete on public.dojos, public.dojo_schedules,
  public.dojo_pricing, public.tournament_videos, public.belt_stories to authenticated;
grant select on public.trial_requests to authenticated;
grant insert (dojo_id, student_id, student_name, student_email, student_phone, preferred_date, message)
  on public.trial_requests to authenticated;
grant update (status, sensei_notes, updated_at) on public.trial_requests to authenticated;
grant select, insert, delete on public.video_bookmarks to authenticated;
grant select, insert on public.belt_progressions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "Public profiles show Sensei information"
  on public.profiles for select to anon, authenticated
  using (role = 'sensei' or id = (select auth.uid()));
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Published dojos are public"
  on public.dojos for select to anon, authenticated using (is_published);
create policy "Senseis read their own dojos"
  on public.dojos for select to authenticated using (sensei_id = (select auth.uid()));
create policy "Senseis create their own dojos"
  on public.dojos for insert to authenticated
  with check (sensei_id = (select auth.uid()) and (select public.is_sensei()));
create policy "Senseis update their own dojos"
  on public.dojos for update to authenticated
  using (sensei_id = (select auth.uid()))
  with check (sensei_id = (select auth.uid()) and (select public.is_sensei()));
create policy "Senseis delete their own dojos"
  on public.dojos for delete to authenticated
  using (sensei_id = (select auth.uid()) and (select public.is_sensei()));

create policy "Schedules for published dojos are public"
  on public.dojo_schedules for select to anon, authenticated
  using (exists (select 1 from public.dojos d where d.id = dojo_id and d.is_published));
create policy "Senseis manage their dojo schedules"
  on public.dojo_schedules for all to authenticated
  using ((select public.owns_dojo(dojo_id)) and (select public.is_sensei()))
  with check ((select public.owns_dojo(dojo_id)) and (select public.is_sensei()));

create policy "Pricing for published dojos is public"
  on public.dojo_pricing for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.dojos d where d.id = dojo_id and d.is_published
  ));
create policy "Senseis manage their dojo pricing"
  on public.dojo_pricing for all to authenticated
  using ((select public.owns_dojo(dojo_id)) and (select public.is_sensei()))
  with check ((select public.owns_dojo(dojo_id)) and (select public.is_sensei()));

create or replace function public.assign_trial_sensei()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id <> (select auth.uid()) then
    raise exception 'Trial requests must be submitted for the signed-in student';
  end if;
  select d.sensei_id
    into new.sensei_id
    from public.dojos d
    where d.id = new.dojo_id and d.is_published;
  if new.sensei_id is null then
    raise exception 'This dojo is not accepting trial requests';
  end if;
  return new;
end;
$$;

create trigger trial_requests_assign_sensei
  before insert on public.trial_requests
  for each row execute function public.assign_trial_sensei();

create policy "Students create their own trial requests"
  on public.trial_requests for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'requested'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
    and sensei_id = (
      select d.sensei_id
      from public.dojos d
      where d.id = dojo_id and d.is_published
    )
  );
create policy "Students and assigned Senseis read trial requests"
  on public.trial_requests for select to authenticated
  using (student_id = (select auth.uid()) or sensei_id = (select auth.uid()));
create policy "Assigned Senseis update trial status and notes"
  on public.trial_requests for update to authenticated
  using (sensei_id = (select auth.uid()) and (select public.is_sensei()))
  with check (sensei_id = (select auth.uid()) and (select public.is_sensei()));

create policy "Published tournament videos are public"
  on public.tournament_videos for select to anon, authenticated using (is_published);
create policy "Senseis manage their tournament videos"
  on public.tournament_videos for all to authenticated
  using (sensei_id = (select auth.uid()) and (select public.is_sensei()))
  with check (sensei_id = (select auth.uid()) and (select public.is_sensei()));

create policy "Published belt stories are public"
  on public.belt_stories for select to anon, authenticated using (is_published);
create policy "Senseis manage their belt stories"
  on public.belt_stories for all to authenticated
  using (sensei_id = (select auth.uid()) and (select public.is_sensei()))
  with check (sensei_id = (select auth.uid()) and (select public.is_sensei()));

create policy "Students manage their own bookmarks"
  on public.video_bookmarks for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

create policy "Students and their Senseis read belt progression"
  on public.belt_progressions for select to authenticated
  using (
    student_id = (select auth.uid())
    or (
      sensei_id = (select auth.uid())
      and (select public.is_sensei())
    )
  );
create policy "Senseis manage belt progression for their dojos"
  on public.belt_progressions for insert to authenticated
  with check (
    sensei_id = (select auth.uid())
    and (select public.is_sensei())
    and (select public.owns_dojo(dojo_id))
    and exists (
      select 1
      from public.trial_requests t
      where t.student_id = belt_progressions.student_id
        and t.dojo_id = belt_progressions.dojo_id
        and t.sensei_id = (select auth.uid())
        and t.status = 'enrolled'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dojo-media', 'dojo-media', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('tournament-videos', 'tournament-videos', false, 524288000, array['video/mp4', 'video/webm', 'video/quicktime']),
  ('belt-stories', 'belt-stories', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners read their private media"
  on storage.objects for select to authenticated
  using (
    (bucket_id in ('dojo-media', 'tournament-videos', 'belt-stories')
      and (storage.foldername(name))[1] = 'sensei'
      and (storage.foldername(name))[2] = (select auth.uid())::text)
    or (bucket_id = 'profile-avatars'
      and (storage.foldername(name))[1] = 'users'
      and (storage.foldername(name))[2] = (select auth.uid())::text)
    or (bucket_id = 'dojo-media' and exists (
      select 1 from public.dojos d
      where d.cover_path = name and d.is_published
    ))
    or (bucket_id = 'tournament-videos' and exists (
      select 1 from public.tournament_videos v
      where v.storage_path = name and v.is_published
    ))
    or (bucket_id = 'belt-stories' and exists (
      select 1 from public.belt_stories s
      where s.image_path = name and s.is_published
    ))
    or (bucket_id = 'profile-avatars' and exists (
      select 1 from public.profiles p
      where p.avatar_path = name and p.role = 'sensei'
    ))
  );

create policy "Senseis upload media to their own folders"
  on storage.objects for insert to authenticated
  with check (
    (bucket_id in ('dojo-media', 'tournament-videos', 'belt-stories')
      and (storage.foldername(name))[1] = 'sensei'
      and (storage.foldername(name))[2] = (select auth.uid())::text
      and (select public.is_sensei()))
    or (bucket_id = 'profile-avatars'
      and (storage.foldername(name))[1] = 'users'
      and (storage.foldername(name))[2] = (select auth.uid())::text)
  );

create policy "Users update or delete media in their own folders"
  on storage.objects for update to authenticated
  using (
    (storage.foldername(name))[2] = (select auth.uid())::text
    and (
      (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = 'users')
      or (
        bucket_id in ('dojo-media', 'tournament-videos', 'belt-stories')
        and (storage.foldername(name))[1] = 'sensei'
        and (select public.is_sensei())
      )
    )
  )
  with check (
    (storage.foldername(name))[2] = (select auth.uid())::text
    and (
      (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = 'users')
      or (
        bucket_id in ('dojo-media', 'tournament-videos', 'belt-stories')
        and (storage.foldername(name))[1] = 'sensei'
        and (select public.is_sensei())
      )
    )
  );

create policy "Users delete media in their own folders"
  on storage.objects for delete to authenticated
  using (
    (storage.foldername(name))[2] = (select auth.uid())::text
    and (
      (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = 'users')
      or (
        bucket_id in ('dojo-media', 'tournament-videos', 'belt-stories')
        and (storage.foldername(name))[1] = 'sensei'
        and (select public.is_sensei())
      )
    )
  );
