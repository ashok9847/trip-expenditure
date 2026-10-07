-- TripSplit Supabase schema and Row Level Security policies
-- Run this in the Supabase SQL Editor to set up the database

-- Enable UUID extension for ID generation
create extension if not exists "uuid-ossp";

-- Trips table (one row per trip)
create table trips (
  id text primary key,
  name text not null check (char_length(name) >= 1 and char_length(name) <= 60),
  start_date text not null check (char_length(start_date) <= 10),
  end_date text not null check (char_length(end_date) <= 10),
  created_at text not null check (char_length(created_at) <= 40),
  last_payer_id text check (last_payer_id is null or char_length(last_payer_id) <= 64),
  participants jsonb not null default '[]'::jsonb,
  settled jsonb not null default '{}'::jsonb,
  owner_uid text not null,
  owner_email text not null,
  member_emails text[] not null check (array_length(member_emails, 1) >= 1 and array_length(member_emails, 1) <= 30),
  constraint owner_in_members check (owner_email = any(member_emails))
);

-- Expenses table (one row per expense, trip_id is FK)
create table expenses (
  id text primary key,
  trip_id text not null references trips(id) on delete cascade,
  description text not null check (char_length(description) >= 1 and char_length(description) <= 60),
  category text check (category is null or char_length(category) <= 30),
  amount bigint not null check (amount > 0 and amount <= 10000000000),
  paid_by text not null check (char_length(paid_by) <= 64),
  date_time text not null check (char_length(date_time) <= 40),
  split_mode text not null check (split_mode in ('equal', 'custom')),
  participant_ids text[] not null check (array_length(participant_ids, 1) >= 1 and array_length(participant_ids, 1) <= 50),
  custom_shares jsonb check (custom_shares is null or jsonb_typeof(custom_shares) = 'object')
);

create index expenses_trip_id_idx on expenses(trip_id);

-- Media table (one row per participant with images, trip_id is FK)
create table media (
  trip_id text not null references trips(id) on delete cascade,
  participant_id text not null check (char_length(participant_id) <= 64),
  photo text check (photo is null or (char_length(photo) < 300000 and photo ~ '^data:image/(jpeg|png|webp);base64,')),
  qr text check (qr is null or (char_length(qr) < 900000 and qr ~ '^data:image/(jpeg|png|webp);base64,')),
  primary key (trip_id, participant_id)
);

-- Row Level Security policies
alter table trips enable row level security;
alter table expenses enable row level security;
alter table media enable row level security;

-- Trips: read if you're a member, create if signed in, update if member, delete if owner
create policy "Users can read trips they're members of"
  on trips for select
  using (auth.jwt()->>'email' = any(member_emails));

create policy "Signed-in users can create trips"
  on trips for insert
  with check (
    auth.uid()::text = owner_uid
    and auth.jwt()->>'email' = owner_email
    and auth.jwt()->>'email' = any(member_emails)
  );

create policy "Members can update trips"
  on trips for update
  using (auth.jwt()->>'email' = any(member_emails))
  with check (
    owner_uid = (select owner_uid from trips where id = trips.id)
    and owner_email = (select owner_email from trips where id = trips.id)
    and (
      auth.uid()::text = owner_uid  -- owner can change anything
      or member_emails = (select member_emails from trips where id = trips.id)  -- member cannot change member list
      or (
        -- member can leave (remove themselves)
        array_length(member_emails, 1) = array_length((select member_emails from trips where id = trips.id), 1) - 1
        and not (auth.jwt()->>'email' = any(member_emails))
      )
    )
  );

create policy "Owners can delete trips"
  on trips for delete
  using (auth.uid()::text = owner_uid);

-- Expenses: read/write if you're a member of the trip
create policy "Users can read expenses for their trips"
  on expenses for select
  using (exists (select 1 from trips where trips.id = expenses.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

create policy "Members can create expenses for their trips"
  on expenses for insert
  with check (exists (select 1 from trips where trips.id = expenses.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

create policy "Members can update expenses for their trips"
  on expenses for update
  using (exists (select 1 from trips where trips.id = expenses.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

create policy "Members can delete expenses for their trips"
  on expenses for delete
  using (exists (select 1 from trips where trips.id = expenses.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

-- Media: read/write if you're a member of the trip
create policy "Users can read media for their trips"
  on media for select
  using (exists (select 1 from trips where trips.id = media.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

create policy "Members can create media for their trips"
  on media for insert
  with check (exists (select 1 from trips where trips.id = media.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

create policy "Members can update media for their trips"
  on media for update
  using (exists (select 1 from trips where trips.id = media.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

create policy "Members can delete media for their trips"
  on media for delete
  using (exists (select 1 from trips where trips.id = media.trip_id and auth.jwt()->>'email' = any(trips.member_emails)));

-- Stored procedure for atomic trip sync (upsert trip + all expenses + all media)
create or replace function sync_trip(
  p_trip jsonb,
  p_expenses jsonb,
  p_media jsonb
) returns void as $$
begin
  -- Upsert the trip
  insert into trips (
    id, name, start_date, end_date, created_at, last_payer_id,
    participants, settled, owner_uid, owner_email, member_emails
  )
  values (
    p_trip->>'id',
    p_trip->>'name',
    p_trip->>'start_date',
    p_trip->>'end_date',
    p_trip->>'created_at',
    p_trip->>'last_payer_id',
    (p_trip->'participants')::jsonb,
    (p_trip->'settled')::jsonb,
    p_trip->>'owner_uid',
    p_trip->>'owner_email',
    (select array_agg(elem::text) from jsonb_array_elements_text(p_trip->'member_emails') elem)
  )
  on conflict (id) do update set
    name = excluded.name,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    last_payer_id = excluded.last_payer_id,
    participants = excluded.participants,
    settled = excluded.settled,
    member_emails = excluded.member_emails;

  -- Upsert all expenses for this trip
  insert into expenses (
    id, trip_id, description, category, amount, paid_by, date_time,
    split_mode, participant_ids, custom_shares
  )
  select
    e->>'id',
    e->>'trip_id',
    e->>'description',
    e->>'category',
    (e->>'amount')::bigint,
    e->>'paid_by',
    e->>'date_time',
    e->>'split_mode',
    (select array_agg(elem::text) from jsonb_array_elements_text(e->'participant_ids') elem),
    (e->'custom_shares')::jsonb
  from jsonb_array_elements(p_expenses) e
  on conflict (id) do update set
    description = excluded.description,
    category = excluded.category,
    amount = excluded.amount,
    paid_by = excluded.paid_by,
    date_time = excluded.date_time,
    split_mode = excluded.split_mode,
    participant_ids = excluded.participant_ids,
    custom_shares = excluded.custom_shares;

  -- Upsert all media for this trip
  insert into media (trip_id, participant_id, photo, qr)
  select
    m->>'trip_id',
    m->>'participant_id',
    m->>'photo',
    m->>'qr'
  from jsonb_array_elements(p_media) m
  on conflict (trip_id, participant_id) do update set
    photo = excluded.photo,
    qr = excluded.qr;
end;
$$ language plpgsql security definer;
