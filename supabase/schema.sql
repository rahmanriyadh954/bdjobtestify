-- ═══════════════════════════════════════════════════════════════════════════
--  BD JobTestify — Supabase Schema
--  Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. PROFILES  (one row per user, linked to Supabase Auth)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  student_id    text unique not null,              -- unique ID e.g. BJT-2026-00001
  full_name     text not null,
  username      text unique not null,
  phone         text,                              -- OPTIONAL (nullable)
  role          text not null default 'student' check (role in ('student','admin')),
  must_change_password boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_role     on public.profiles(role);
create index if not exists idx_profiles_username on public.profiles(username);

-- Auto-generate a unique student ID:  BJT-<year>-<5 digits>
create sequence if not exists public.student_id_seq start 1;

create or replace function public.next_student_id()
returns text language sql as $$
  select 'BJT-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.student_id_seq')::text, 5, '0');
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. QUESTIONS  (the question bank)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  question_type  text not null default 'mcq' check (question_type in ('mcq','written')),
  question_text  text not null,
  options        jsonb default '[]'::jsonb,        -- MCQ only: ["A","B","C","D"]
  correct_answer text,                             -- MCQ only  (NEVER sent to students)
  model_answer   text,                             -- written only: reference answer
  keywords       jsonb default '[]'::jsonb,        -- written only: expected key points
  explanation    text,
  subject        text not null,
  topic          text,
  difficulty     text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  marks          numeric not null default 1,
  source         text not null default 'manual' check (source in ('manual','ai','ai-file')),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_questions_subject on public.questions(subject);
create index if not exists idx_questions_type    on public.questions(question_type);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. MODEL TESTS
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.model_tests (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  subject          text default 'Mixed',
  time_limit       integer not null default 30,      -- minutes
  pass_marks       integer not null default 40,      -- percentage
  negative_marking boolean not null default false,
  negative_value   numeric not null default 0.25,
  instructions     text,
  status           text not null default 'draft' check (status in ('draft','published')),
  exam_type        text not null default 'regular' check (exam_type in ('regular','daily','weekly')),
  published_at     timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_tests_status on public.model_tests(status);

-- Join table: which questions are in which test, and in what order
create table if not exists public.model_test_questions (
  id            uuid primary key default gen_random_uuid(),
  model_test_id uuid not null references public.model_tests(id) on delete cascade,
  question_id   uuid not null references public.questions(id) on delete cascade,
  position      integer not null default 0,
  unique (model_test_id, question_id)
);

create index if not exists idx_mtq_test on public.model_test_questions(model_test_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. EXAM SCHEDULE  (single row holding the daily / weekly assignment)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.exam_schedule (
  id             integer primary key default 1 check (id = 1),
  daily_test_id  uuid references public.model_tests(id) on delete set null,
  daily_date     date,
  weekly_test_id uuid references public.model_tests(id) on delete set null,
  weekly_week    date,
  updated_at     timestamptz not null default now()
);

insert into public.exam_schedule (id) values (1) on conflict (id) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. EXAM RESULTS
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.exam_results (
  id             uuid primary key default gen_random_uuid(),
  model_test_id  uuid references public.model_tests(id) on delete set null,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  exam_title     text not null,
  answers        jsonb not null default '{}'::jsonb,   -- { question_id: "answer" }
  mcq_score      numeric not null default 0,
  written_score  numeric not null default 0,
  score          numeric not null default 0,
  total_marks    numeric not null default 0,
  percentage     numeric not null default 0,
  passed         boolean not null default false,
  time_taken     integer not null default 0,           -- seconds
  needs_grading  boolean not null default false,       -- true until written answers are assessed
  submitted_at   timestamptz not null default now(),
  unique (model_test_id, student_id)                   -- one attempt per student per test
);

create index if not exists idx_results_student on public.exam_results(student_id);
create index if not exists idx_results_test    on public.exam_results(model_test_id);

-- Per-written-answer AI assessment record
create table if not exists public.written_assessments (
  id            uuid primary key default gen_random_uuid(),
  result_id     uuid not null references public.exam_results(id) on delete cascade,
  question_id   uuid not null references public.questions(id) on delete cascade,
  student_answer text,
  awarded_marks numeric not null default 0,
  max_marks     numeric not null default 1,
  feedback      text,
  strengths     jsonb default '[]'::jsonb,
  improvements  jsonb default '[]'::jsonb,
  sources       jsonb default '[]'::jsonb,              -- URLs the AI checked
  assessed_by   text not null default 'ai' check (assessed_by in ('ai','admin','admin-manual')),
  assessed_at   timestamptz not null default now(),
  unique (result_id, question_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
--  HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create the profile row automatically when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, student_id, full_name, username, phone, role)
  values (
    new.id,
    public.next_student_id(),
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    'student'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard: a student's own UPDATE policy (p_self_update, defined further down)
-- only restricts WHICH ROW they can touch — Postgres RLS cannot restrict
-- WHICH COLUMNS on that row. Without this trigger, any logged-in student
-- could run `update profiles set role='admin' where id=auth.uid()` straight
-- from the browser console and grant themselves admin access.
--
-- must_change_password is a special case: the app legitimately needs a
-- student to clear this flag on their OWN row right after they re-verify
-- their current password and set a new one (see AuthContext.changePassword).
-- So that one flag may only move true -> false by a non-admin, never
-- false -> true (a student has no legitimate reason to lock themselves out).
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role      := old.role;
    new.is_active  := old.is_active;
    new.student_id := old.student_id;

    if not (old.must_change_password = true and new.must_change_password = false) then
      new.must_change_password := old.must_change_password;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns_trg on public.profiles;
create trigger protect_profile_columns_trg
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ═══════════════════════════════════════════════════════════════════════════
--  SECURE RPCs
--  These run with elevated rights so students never touch correct answers.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Get an exam paper WITHOUT the correct answers ──────────────────────────
create or replace function public.get_exam_paper(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_test record; v_questions jsonb;
begin
  -- Require a signed-in caller. Without this, anyone with a test's UUID
  -- could fetch the full question text and MCQ options with no account at
  -- all — never the answers, but still real exam content that should only
  -- be visible to someone actually sitting the test.
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_test from public.model_tests
   where id = p_test_id and status = 'published';
  if not found then raise exception 'Exam not available'; end if;

  select coalesce(jsonb_agg(sub.q order by sub.position), '[]'::jsonb) into v_questions
  from (
    select mtq.position,
           jsonb_build_object(
             'id', qq.id,
             'question_type', qq.question_type,
             'question_text', qq.question_text,
             'options', qq.options,          -- NOTE: correct_answer deliberately excluded
             'subject', qq.subject,
             'topic', qq.topic,
             'difficulty', qq.difficulty,
             'marks', qq.marks
           ) as q
    from public.model_test_questions mtq
    join public.questions qq on qq.id = mtq.question_id
    where mtq.model_test_id = p_test_id
  ) sub;

  return jsonb_build_object(
    'id', v_test.id, 'title', v_test.title, 'description', v_test.description,
    'time_limit', v_test.time_limit, 'pass_marks', v_test.pass_marks,
    'negative_marking', v_test.negative_marking, 'negative_value', v_test.negative_value,
    'instructions', v_test.instructions, 'exam_type', v_test.exam_type,
    'questions', v_questions
  );
end;
$$;

-- ── Submit an exam: scoring happens HERE, on the server ────────────────────
create or replace function public.submit_exam(
  p_test_id uuid, p_answers jsonb, p_time_taken integer default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_test record; v_q record;
  v_correct numeric := 0; v_wrong numeric := 0; v_total numeric := 0;
  v_mcq numeric := 0; v_pct numeric := 0; v_passed boolean;
  v_needs_grading boolean := false;
  v_result_id uuid; v_given text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_test from public.model_tests
   where id = p_test_id and status = 'published';
  if not found then raise exception 'Exam not available'; end if;

  if exists (select 1 from public.exam_results
              where model_test_id = p_test_id and student_id = auth.uid()) then
    raise exception 'You have already submitted this exam';
  end if;

  for v_q in
    select qq.* from public.model_test_questions mtq
    join public.questions qq on qq.id = mtq.question_id
    where mtq.model_test_id = p_test_id
  loop
    v_total := v_total + v_q.marks;
    v_given := p_answers ->> v_q.id::text;

    if v_q.question_type = 'written' then
      v_needs_grading := true;                       -- AI grades these afterwards
    elsif v_given is null or v_given = '' then
      null;                                          -- unanswered: no credit, no penalty
    elsif v_given = v_q.correct_answer then
      v_correct := v_correct + v_q.marks;
    else
      v_wrong := v_wrong + 1;
    end if;
  end loop;

  v_mcq := v_correct;
  if v_test.negative_marking then
    v_mcq := v_mcq - (v_wrong * v_test.negative_value);
  end if;
  if v_mcq < 0 then v_mcq := 0; end if;

  v_pct := case when v_total > 0 then round((v_mcq / v_total) * 100, 2) else 0 end;
  v_passed := v_pct >= v_test.pass_marks;

  insert into public.exam_results (
    model_test_id, student_id, exam_title, answers,
    mcq_score, written_score, score, total_marks, percentage,
    passed, time_taken, needs_grading
  ) values (
    p_test_id, auth.uid(), v_test.title, p_answers,
    v_mcq, 0, v_mcq, v_total, v_pct,
    v_passed, greatest(p_time_taken, 0), v_needs_grading
  ) returning id into v_result_id;

  return jsonb_build_object(
    'id', v_result_id, 'score', v_mcq, 'total_marks', v_total,
    'percentage', v_pct, 'passed', v_passed, 'needs_grading', v_needs_grading
  );
end;
$$;

-- ── Record an AI assessment of one written answer, then recalculate ────────
create or replace function public.record_written_assessment(
  p_result_id uuid, p_question_id uuid, p_student_answer text,
  p_awarded numeric, p_max numeric, p_feedback text,
  p_strengths jsonb default '[]'::jsonb,
  p_improvements jsonb default '[]'::jsonb,
  p_sources jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res record; v_written numeric; v_score numeric; v_pct numeric; v_left integer;
begin
  -- Allowed for an admin, or for the student who owns this exact result —
  -- this is what lets written answers get graded immediately on submission
  -- instead of waiting for an admin to click "Mark". p_result_id already
  -- scopes everything to one specific attempt, so a student can never
  -- touch anyone else's paper this way.
  -- auth.uid() is NULL for an unauthenticated caller. SQL's three-valued
  -- logic means "student_id <> NULL" evaluates to NULL (not TRUE), which
  -- would silently skip the exception below and let an anonymous caller
  -- through. This explicit NULL check closes that gap before anything else
  -- runs, so the function always fails closed for a logged-out caller.
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_res from public.exam_results where id = p_result_id;
  if not found then raise exception 'Result not found'; end if;
  if v_res.student_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  insert into public.written_assessments (
    result_id, question_id, student_answer, awarded_marks, max_marks,
    feedback, strengths, improvements, sources
  ) values (
    p_result_id, p_question_id, p_student_answer, greatest(p_awarded, 0), p_max,
    p_feedback, p_strengths, p_improvements, p_sources
  )
  on conflict (result_id, question_id) do update set
    awarded_marks = excluded.awarded_marks, feedback = excluded.feedback,
    strengths = excluded.strengths, improvements = excluded.improvements,
    sources = excluded.sources, assessed_at = now();

  select * into v_res from public.exam_results where id = p_result_id;

  select coalesce(sum(awarded_marks), 0) into v_written
    from public.written_assessments where result_id = p_result_id;

  -- how many written questions still have no assessment?
  select count(*) into v_left
    from public.model_test_questions mtq
    join public.questions qq on qq.id = mtq.question_id
    where mtq.model_test_id = v_res.model_test_id
      and qq.question_type = 'written'
      and not exists (select 1 from public.written_assessments wa
                       where wa.result_id = p_result_id and wa.question_id = qq.id);

  v_score := v_res.mcq_score + v_written;
  v_pct := case when v_res.total_marks > 0
                then round((v_score / v_res.total_marks) * 100, 2) else 0 end;

  update public.exam_results set
    written_score = v_written, score = v_score, percentage = v_pct,
    passed = v_pct >= (select pass_marks from public.model_tests where id = v_res.model_test_id),
    needs_grading = (v_left > 0)
  where id = p_result_id;

  return jsonb_build_object('score', v_score, 'percentage', v_pct, 'remaining', v_left);
end;
$$;

-- ── Review a finished paper. Correct answers are released ONLY to the
--    student who already submitted it, or to an admin.
create or replace function public.get_result_review(p_result_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res record; v_questions jsonb;
begin
  -- auth.uid() is NULL for an unauthenticated caller. SQL's three-valued
  -- logic means "student_id <> NULL" evaluates to NULL (not TRUE), which
  -- would silently skip the exception below and let an anonymous caller
  -- through to full correct answers and explanations. This explicit NULL
  -- check closes that gap before anything else runs.
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_res from public.exam_results where id = p_result_id;
  if not found then raise exception 'Result not found'; end if;

  if v_res.student_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select coalesce(jsonb_agg(sub.q order by sub.position), '[]'::jsonb) into v_questions
  from (
    select mtq.position,
           jsonb_build_object(
             'id', qq.id, 'question_type', qq.question_type,
             'question_text', qq.question_text, 'options', qq.options,
             'correct_answer', qq.correct_answer, 'model_answer', qq.model_answer,
             'explanation', qq.explanation, 'subject', qq.subject, 'marks', qq.marks
           ) as q
    from public.model_test_questions mtq
    join public.questions qq on qq.id = mtq.question_id
    where mtq.model_test_id = v_res.model_test_id
  ) sub;

  return jsonb_build_object(
    'result', to_jsonb(v_res),
    'questions', v_questions,
    'assessments', coalesce((
      select jsonb_agg(to_jsonb(wa)) from public.written_assessments wa
      where wa.result_id = p_result_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── Papers still waiting on written grading ────────────────────────────────
-- Used by an admin re-marking from the Results tab, AND by a student's own
-- browser right after they submit, so written answers get graded immediately
-- instead of sitting in a queue for an admin to open.
create or replace function public.get_pending_written(p_result_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res record; v_items jsonb;
begin
  -- auth.uid() is NULL for an unauthenticated caller. SQL's three-valued
  -- logic means "student_id <> NULL" evaluates to NULL (not TRUE), which
  -- would silently skip the exception below and let an anonymous caller
  -- through. This explicit NULL check closes that gap before anything else
  -- runs, so the function always fails closed for a logged-out caller.
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_res from public.exam_results where id = p_result_id;
  if not found then raise exception 'Result not found'; end if;
  if v_res.student_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', qq.id, 'question_text', qq.question_text,
           'model_answer', qq.model_answer, 'keywords', qq.keywords, 'marks', qq.marks,
           'student_answer', v_res.answers ->> qq.id::text
         )), '[]'::jsonb) into v_items
  from public.model_test_questions mtq
  join public.questions qq on qq.id = mtq.question_id
  where mtq.model_test_id = v_res.model_test_id
    and qq.question_type = 'written'
    and not exists (select 1 from public.written_assessments wa
                     where wa.result_id = p_result_id and wa.question_id = qq.id);

  return v_items;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.profiles             enable row level security;
alter table public.questions            enable row level security;
alter table public.model_tests          enable row level security;
alter table public.model_test_questions enable row level security;
alter table public.exam_schedule        enable row level security;
alter table public.exam_results         enable row level security;
alter table public.written_assessments  enable row level security;

-- PROFILES
drop policy if exists p_self on public.profiles;
create policy p_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists p_self_update on public.profiles;
create policy p_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists p_admin_all on public.profiles;
create policy p_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- QUESTIONS — admin only. Students NEVER read this table directly;
-- they get papers through get_exam_paper(), which strips correct_answer.
drop policy if exists q_admin on public.questions;
create policy q_admin on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

-- MODEL TESTS — students may see published test metadata (not the questions)
drop policy if exists t_read on public.model_tests;
create policy t_read on public.model_tests
  for select using (status = 'published' or public.is_admin());

drop policy if exists t_admin on public.model_tests;
create policy t_admin on public.model_tests
  for all using (public.is_admin()) with check (public.is_admin());

-- JOIN TABLE — students may read the question COUNT/IDs for a published
-- test (this is what lets "Start Exam" show the right question count and
-- become clickable). This never exposes question text or answers — those
-- stay behind get_exam_paper(), which is the only way the paper itself
-- reaches a student.
drop policy if exists mtq_admin on public.model_test_questions;
create policy mtq_admin on public.model_test_questions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists mtq_read_published on public.model_test_questions;
create policy mtq_read_published on public.model_test_questions
  for select using (
    exists (
      select 1 from public.model_tests mt
      where mt.id = model_test_id and mt.status = 'published'
    )
  );

-- SCHEDULE — everyone signed in can read, admin can write
drop policy if exists s_read on public.exam_schedule;
create policy s_read on public.exam_schedule
  for select using (auth.uid() is not null);

drop policy if exists s_admin on public.exam_schedule;
create policy s_admin on public.exam_schedule
  for all using (public.is_admin()) with check (public.is_admin());

-- RESULTS — a student sees only their own; admin sees all.
-- No INSERT policy on purpose: results can ONLY be created by submit_exam().
drop policy if exists r_own on public.exam_results;
create policy r_own on public.exam_results
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists r_admin on public.exam_results;
create policy r_admin on public.exam_results
  for all using (public.is_admin()) with check (public.is_admin());

-- WRITTEN ASSESSMENTS
drop policy if exists w_own on public.written_assessments;
create policy w_own on public.written_assessments
  for select using (
    public.is_admin() or exists (
      select 1 from public.exam_results er
      where er.id = result_id and er.student_id = auth.uid()
    )
  );

drop policy if exists w_admin on public.written_assessments;
create policy w_admin on public.written_assessments
  for all using (public.is_admin()) with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
--  MAKE YOURSELF ADMIN
--  1. Register normally in the app with the username you want.
--  2. Come back here, put that username below, and run just this line.
-- ═══════════════════════════════════════════════════════════════════════════
-- update public.profiles set role = 'admin' where username = 'YOUR_USERNAME_HERE';

-- ═══════════════════════════════════════════════════════════════════════════
--  LIST WRITTEN ASSESSMENTS RPC (for admin review panel)
--  Returns all assessed written answers for a result, with question text.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.list_written_assessments(p_result_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res record; v_items jsonb;
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select * into v_res from public.exam_results where id = p_result_id;
    if not found then raise exception 'Result not found'; end if;
    if v_res.student_id <> auth.uid() and not public.is_admin() then
        raise exception 'Not allowed';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'question_id',   wa.question_id,
        'question_text', qq.question_text,
        'model_answer',  qq.model_answer,
        'keywords',      qq.keywords,
        'max_marks',     wa.max_marks,
        'awarded_marks', wa.awarded_marks,
        'student_answer', wa.student_answer,
        'feedback',      wa.feedback,
        'strengths',     wa.strengths,
        'improvements',  wa.improvements,
        'sources',       wa.sources,
        'assessed_by',   wa.assessed_by,
        'assessed_at',   wa.assessed_at
    )), '[]'::jsonb) into v_items
    from public.written_assessments wa
    join public.questions qq on qq.id = wa.question_id
    where wa.result_id = p_result_id;

    return v_items;
end;
$$;

grant execute on function public.list_written_assessments(uuid) to authenticated;
