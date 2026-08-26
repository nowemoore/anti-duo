-- One row per learner: their whole Progress blob, plus the revision that decides who wins a
-- conflict. Run in the Supabase SQL editor.
--
-- Read and written by src/lib/sync.ts (shared by the web app and the phone app). The client keeps
-- local storage as the source of truth and treats this table as a backup that a fresh device can
-- pull from; `rev` is a millisecond client timestamp, and reconciliation is last-write-wins on it.
--
-- Row-level security is what actually protects the data — the anon key ships inside every client
-- build by design, so these policies are the only thing standing between one learner and another's
-- progress.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- The Progress object as stored on the device: settings, per-unit levels, word streaks, grammar.
  data       jsonb       not null,
  -- Client clock in ms. Higher wins; the client only ever adopts the remote when it is strictly
  -- newer than what it has locally.
  rev        bigint      not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "own progress: read" on public.progress
  for select to authenticated using (auth.uid() = user_id);

create policy "own progress: insert" on public.progress
  for insert to authenticated with check (auth.uid() = user_id);

create policy "own progress: update" on public.progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: clearing your progress is an edit (an empty blob), not a row deletion, so the
-- clients never need one.
