-- One row per answered practice question. Run in the Supabase SQL editor.
--
-- Why this exists: Progress keeps only running totals (a level per unit, {attempts, points} per task
-- type), which cannot answer "which distractor did they pick", "do they read this kanji but fail to
-- write it", or "what fraction is still correct after three weeks". Those need individual events.
--
-- Written fire-and-forget by mobile/src/lib/answers.ts; a failure here never disrupts practice.

create table if not exists public.answers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  lang          text not null,

  -- What was asked.
  unit_idx      integer not null,
  task_kind     text    not null,
  sentence_id   text,

  -- How it went.
  correct       boolean not null,
  score         real    not null,
  picked        text,
  latency_ms    integer,

  -- State *before* the answer, so retention can be conditioned on prior strength.
  lvl_before          real,
  word_streak_before  integer,
  prev_seen_at        timestamptz,

  -- True when the target was drawn uniformly instead of by level weight. These rows are the
  -- unbiased sample: everywhere else the scheduler chose the review gap using the very strength
  -- we are trying to measure, so long gaps only ever occur on units already believed to be strong.
  random_pick   boolean not null default false,

  -- The strokes for a draw answer live in `drawings`; this links the two.
  drawing_id    uuid references public.drawings (id) on delete set null,

  created_at    timestamptz not null default now()
);

-- Retention queries scan one learner's history for one unit in time order.
create index if not exists answers_user_unit_time_idx
  on public.answers (user_id, unit_idx, created_at desc);
-- Distractor analysis scans by task type across learners.
create index if not exists answers_task_kind_idx on public.answers (task_kind, created_at desc);
-- The unbiased slice is a small fraction of rows and is always queried on its own.
create index if not exists answers_random_pick_idx on public.answers (created_at desc)
  where random_pick;

alter table public.answers enable row level security;

create policy "own answers: insert" on public.answers
  for insert to authenticated with check (auth.uid() = user_id);

create policy "own answers: read" on public.answers
  for select to authenticated using (auth.uid() = user_id);

-- Deliberately no update or delete policy: this is an append-only log.


-- ---------------------------------------------------------------------------
-- Retention, from the unbiased slice only. `prev_seen_at` is denormalised onto
-- the row, so no window function is needed.
-- ---------------------------------------------------------------------------
-- select
--   width_bucket(extract(epoch from (created_at - prev_seen_at)) / 86400,
--                array[1, 3, 7, 14, 30, 90]) as gap_bucket,
--   task_kind,
--   count(*)                                   as reviews,
--   avg(correct::int)::numeric(4, 3)           as recall
-- from public.answers
-- where random_pick and prev_seen_at is not null
-- group by 1, 2
-- order by 1, 2;
