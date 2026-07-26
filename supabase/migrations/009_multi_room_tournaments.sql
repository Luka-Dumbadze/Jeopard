-- Multi-room tournament cloud sync
-- Enables Laptop 1 (mentor) to create a tournament that ROOM facilitators
-- hydrate independently on Laptops 2–4 via /room/ROOM-N?t=TOURNAMENT-…

create table if not exists public.tournament_sessions (
  id text primary key,
  game_data jsonb not null,
  teams jsonb not null,
  rooms jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tournament_rooms (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournament_sessions (id) on delete cascade,
  room_id text not null,
  room_number integer not null check (room_number between 1 and 4),
  label_ka text not null,
  team_ids jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tournament_id, room_id)
);

create index if not exists tournament_rooms_tournament_id_idx
  on public.tournament_rooms (tournament_id);

alter table public.tournament_sessions enable row level security;
alter table public.tournament_rooms enable row level security;

-- Public read/write via anon key (live event / projector use-case)
drop policy if exists "Public read tournament_sessions" on public.tournament_sessions;
create policy "Public read tournament_sessions"
  on public.tournament_sessions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public insert tournament_sessions" on public.tournament_sessions;
create policy "Public insert tournament_sessions"
  on public.tournament_sessions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public update tournament_sessions" on public.tournament_sessions;
create policy "Public update tournament_sessions"
  on public.tournament_sessions
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public read tournament_rooms" on public.tournament_rooms;
create policy "Public read tournament_rooms"
  on public.tournament_rooms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public insert tournament_rooms" on public.tournament_rooms;
create policy "Public insert tournament_rooms"
  on public.tournament_rooms
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public update tournament_rooms" on public.tournament_rooms;
create policy "Public update tournament_rooms"
  on public.tournament_rooms
  for update
  to anon, authenticated
  using (true)
  with check (true);
