-- Live buzzer state for reliable mobile unlock (DB + polling fallback)
-- Complements ephemeral Realtime broadcast channels.

alter table public.tournament_rooms
  add column if not exists buzzers_open boolean not null default false;

alter table public.tournament_rooms
  add column if not exists active_question jsonb;

alter table public.tournament_rooms
  add column if not exists buzzed_team_id text;

alter table public.tournament_rooms
  add column if not exists buzzed_team_name text;

alter table public.tournament_rooms
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists tournament_rooms_room_live_idx
  on public.tournament_rooms (tournament_id, room_id);

-- Enable Postgres Changes for mobile / host subscribers
do $$
begin
  alter publication supabase_realtime add table public.tournament_rooms;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
