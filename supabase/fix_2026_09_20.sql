-- ═══════════════════════════════════════════════════════════════════════════
--  BD JobTestify — fixes (2026-09-20)
--
--  Run this in Supabase Dashboard → SQL Editor → New Query → Run.
--
--  Changes:
--  1. Exam delete no longer wipes student results — exam_results.model_test_id
--     now sets to NULL on delete instead of cascading.
--  2. written_assessments.assessed_by now also accepts 'admin-manual' value.
--  3. listWrittenAssessments RPC (for admin review panel) — returns all
--     assessed answers for a result, including question text and image data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- FIX 1 — exam_results: preserve student data when admin deletes an exam
-- ─────────────────────────────────────────────────────────────────────────
-- Drop the existing FK constraint and re-add with ON DELETE SET NULL
-- so deleting a model_test keeps the result rows (with model_test_id = NULL).
ALTER TABLE public.exam_results
    DROP CONSTRAINT IF EXISTS exam_results_model_test_id_fkey;

ALTER TABLE public.exam_results
    ADD CONSTRAINT exam_results_model_test_id_fkey
    FOREIGN KEY (model_test_id)
    REFERENCES public.model_tests(id)
    ON DELETE SET NULL;

-- Also protect model_test_questions join table — cascade is fine here
-- (the join rows are meaningless without the test), already correct.

-- ─────────────────────────────────────────────────────────────────────────
-- FIX 2 — allow 'admin-manual' as an assessed_by value
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.written_assessments
    DROP CONSTRAINT IF EXISTS written_assessments_assessed_by_check;

ALTER TABLE public.written_assessments
    ADD CONSTRAINT written_assessments_assessed_by_check
    CHECK (assessed_by IN ('ai', 'admin', 'admin-manual'));

-- ─────────────────────────────────────────────────────────────────────────
-- FIX 3 — list_written_assessments RPC for admin review panel
-- Returns all assessed written answers for a result, with question text.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_written_assessments(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res record; v_items jsonb;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_res FROM public.exam_results WHERE id = p_result_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Result not found'; END IF;
    IF v_res.student_id <> auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
    )), '[]'::jsonb) INTO v_items
    FROM public.written_assessments wa
    JOIN public.questions qq ON qq.id = wa.question_id
    WHERE wa.result_id = p_result_id;

    RETURN v_items;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Grant execute permissions
-- ─────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.list_written_assessments(uuid) TO authenticated;
