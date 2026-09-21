-- ═══════════════════════════════════════════════════════════════════════════
--  BD JobTestify — security & functionality fixes
--
--  Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run.
--  Safe to run even on a brand-new install — schema.sql already includes
--  every fix below, so running this afterwards just does nothing extra.
--
--  What this fixes, in order of severity:
--
--  1. CRITICAL — privilege escalation. Any signed-in student could open the
--     browser console and run
--         supabase.from('profiles').update({role:'admin'}).eq('id', myId)
--     and grant themselves admin access, because the existing row-level
--     security policy only restricted WHICH ROW a user could update, not
--     WHICH COLUMNS. Fixed with a trigger.
--
--  2. CRITICAL — anonymous access to exam answers. Four database functions
--     checked "is this the right student" using a pattern that Postgres's
--     three-valued NULL logic silently bypasses for a logged-OUT caller
--     (auth.uid() is NULL for anyone not signed in). In practice this meant
--     anyone who obtained a result's ID — from a shared link, a browser
--     history entry, a server log — could call these functions with NO
--     account at all and receive full exam answers, or even write fake
--     grades into a student's result. Fixed by adding an explicit
--     "auth.uid() is null" check to each one, which cannot be bypassed by
--     NULL-comparison tricks.
--
--  3. Students could not start any exam — "Start Exam" was disabled for
--     everyone because the database blocked students from even seeing how
--     many questions a test had.
--
--  4. Written answers sat waiting for an admin — now they're marked by AI
--     the moment a student submits, so the score is ready right away
--     instead of needing an admin to open the Results tab first.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- FIX 1 — privilege escalation via direct table update
-- ─────────────────────────────────────────────────────────────────────────
-- must_change_password is a deliberate exception: the app needs a student
-- to legitimately clear this flag on their OWN row right after they
-- re-verify their current password and set a new one. So that one flag
-- may only move true -> false by a non-admin, never false -> true.
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


-- ─────────────────────────────────────────────────────────────────────────
-- FIX 2 — anonymous access to exam answers (4 functions)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_exam_paper(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_test record; v_questions jsonb;
begin
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

create or replace function public.get_result_review(p_result_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res record; v_questions jsonb;
begin
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

create or replace function public.get_pending_written(p_result_id uuid)
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

create or replace function public.record_written_assessment(
  p_result_id uuid, p_question_id uuid, p_student_answer text,
  p_awarded numeric, p_max numeric, p_feedback text,
  p_strengths jsonb default '[]'::jsonb,
  p_improvements jsonb default '[]'::jsonb,
  p_sources jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res record; v_written numeric; v_score numeric; v_pct numeric; v_left integer;
begin
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


-- ─────────────────────────────────────────────────────────────────────────
-- FIX 3 — students could not start exams
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists mtq_read_published on public.model_test_questions;
create policy mtq_read_published on public.model_test_questions
  for select using (
    exists (
      select 1 from public.model_tests mt
      where mt.id = model_test_id and mt.status = 'published'
    )
  );

-- (Fix 4 — instant AI grading of written answers — needs no separate SQL;
--  it's the two functions in Fix 2 above plus a client-side change, both
--  already included here and in the app bundle.)
