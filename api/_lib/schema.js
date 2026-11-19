// cLOCK IN database schema (Supabase Postgres).
// The API runs this automatically on first use (CREATE ... IF NOT EXISTS), so nobody has to run SQL by hand.
//
// Row level security is ON with no policies: nothing is readable through Supabase's public REST API.
// Only our own /api functions, which connect as the database owner, can read or write these tables.
export const SCHEMA = `
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;

create table if not exists public.crews (
  code       text primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.crews enable row level security;
alter table public.crews add column if not exists name text;

create table if not exists public.crew_members (
  crew_code  text not null references public.crews(code) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  card       jsonb not null,
  joined_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (crew_code, user_id)
);
alter table public.crew_members enable row level security;
create index if not exists crew_members_user_idx on public.crew_members (user_id);
`;
