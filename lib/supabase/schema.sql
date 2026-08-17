-- ============================================================================
-- TDILEARNED — Supabase PostgreSQL Production Schema & RLS Policies
-- ============================================================================

-- 1. User Profiles (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  tier text default 'free' check (tier in ('free', 'pro', 'unlimited')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger: Automatically create public.profiles row on auth.users sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Persisted Mindmaps
create table if not exists public.mindmaps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  root_topic text not null,
  category text default 'General',
  share_slug text unique,
  is_public boolean default false,
  viewport jsonb default '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  node_count int default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_mindmaps_share_slug on public.mindmaps (share_slug);
create index if not exists idx_mindmaps_user_id on public.mindmaps (user_id);
create index if not exists idx_mindmaps_root_topic on public.mindmaps (root_topic);

-- 3. Saved Pinned Insights & Notes
create table if not exists public.saved_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  mindmap_id uuid references public.mindmaps(id) on delete cascade,
  source_topic text not null,
  question text not null,
  answer text not null,
  citations jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_saved_notes_user_id on public.saved_notes (user_id);

-- 4. Global Research Dossier Cache
create table if not exists public.dossier_cache (
  node_id text primary key,
  topic text not null,
  category text,
  curiosity_score int,
  dossier_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_dossier_cache_topic on public.dossier_cache (topic);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.mindmaps enable row level security;
alter table public.saved_notes enable row level security;
alter table public.dossier_cache enable row level security;

-- Profiles: Users can view and update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Mindmaps Policies:
-- 1. Public or Owned select
create policy "Mindmaps are viewable if public or owned" on public.mindmaps
  for select using (is_public = true or auth.uid() = user_id);

-- 2. Insert owned
create policy "Users can insert own mindmaps" on public.mindmaps
  for insert with check (auth.uid() = user_id);

-- 2b. Guests can insert/upsert public shareable mindmaps
create policy "Guests can create public mindmaps" on public.mindmaps
  for insert with check (auth.uid() is null and is_public = true and user_id is null);

-- 3. Update owned
create policy "Users can update own mindmaps" on public.mindmaps
  for update using (auth.uid() = user_id);

-- 3b. Guests can update their own public shareable mindmaps (re-share/rename)
create policy "Guests can update public mindmaps" on public.mindmaps
  for update using (auth.uid() is null and is_public = true and user_id is null);

-- 4. Delete owned
create policy "Users can delete own mindmaps" on public.mindmaps
  for delete using (auth.uid() = user_id);

-- Saved Notes Policies:
create policy "Users can manage own notes" on public.saved_notes
  for all using (auth.uid() = user_id);

-- Dossier Cache: Read for everyone, insert/update for service role
create policy "Dossier cache is publicly readable" on public.dossier_cache
  for select using (true);
