// ═══════════════════════════════════════════════════════════════════════════
//  Data layer — every Supabase call lives here.
//  Nothing else in the app talks to the database directly.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../utils/supabaseClient';
import { cleanText } from '../utils/security';

const fail = (error, fallbackMsg) => {
    if (!error) return;
    console.error('[db]', error);
    throw new Error(error.message || fallbackMsg || 'Something went wrong');
};

/* ═══════════════ QUESTIONS ═══════════════ */
export const listQuestions = async () => {
    const { data, error } = await supabase
        .from('questions').select('*').order('created_at', { ascending: false });
    fail(error, 'Could not load questions');
    return data || [];
};

const toQuestionRow = (q) => ({
    question_type:  q.question_type || 'mcq',
    question_text:  cleanText(q.question_text ?? q.question ?? ''),
    options:        (q.options || []).map(o => cleanText(o)),
    correct_answer: q.correct_answer ? cleanText(q.correct_answer) : null,
    model_answer:   q.model_answer ? cleanText(q.model_answer) : null,
    keywords:       q.keywords || [],
    explanation:    q.explanation ? cleanText(q.explanation) : null,
    subject:        q.subject || 'General',
    topic:          q.topic ? cleanText(q.topic) : null,
    difficulty:     q.difficulty || 'medium',
    marks:          Number(q.marks) || 1,
    source:         q.source || 'manual',
});

export const createQuestion = async (q) => {
    const { data, error } = await supabase
        .from('questions').insert(toQuestionRow(q)).select().single();
    fail(error, 'Could not save the question');
    return data;
};

export const createQuestions = async (arr) => {
    if (!arr?.length) return [];
    const { data, error } = await supabase
        .from('questions').insert(arr.map(toQuestionRow)).select();
    fail(error, 'Could not save the questions');
    return data || [];
};

export const updateQuestion = async (id, updates) => {
    const { data, error } = await supabase
        .from('questions')
        .update({ ...toQuestionRow(updates), updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    fail(error, 'Could not update the question');
    return data;
};

export const deleteQuestion = async (id) => {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    fail(error, 'Could not delete the question');
};

export const deleteQuestions = async (ids) => {
    const { error } = await supabase.from('questions').delete().in('id', ids);
    fail(error, 'Could not delete the questions');
};

/* ═══════════════ MODEL TESTS ═══════════════ */
export const listModelTests = async () => {
    const { data, error } = await supabase
        .from('model_tests')
        .select('*, model_test_questions(question_id, position)')
        .order('created_at', { ascending: false });
    fail(error, 'Could not load model tests');
    return (data || []).map(t => ({
        ...t,
        questionIds: (t.model_test_questions || [])
            .sort((a, b) => a.position - b.position)
            .map(x => x.question_id),
    }));
};

const toTestRow = (t) => ({
    title:            cleanText(t.title, 200),
    description:      t.description ? cleanText(t.description, 1000) : null,
    subject:          t.subject || 'Mixed',
    time_limit:       Number(t.time_limit) || 30,
    pass_marks:       Number(t.pass_marks) || 40,
    negative_marking: Boolean(t.negative_marking),
    negative_value:   Number(t.negative_value) || 0.25,
    instructions:     t.instructions ? cleanText(t.instructions, 2000) : null,
});

const syncTestQuestions = async (testId, questionIds = []) => {
    await supabase.from('model_test_questions').delete().eq('model_test_id', testId);
    if (!questionIds.length) return;
    const rows = questionIds.map((qid, i) => ({
        model_test_id: testId, question_id: qid, position: i,
    }));
    const { error } = await supabase.from('model_test_questions').insert(rows);
    fail(error, 'Could not attach questions to the test');
};

export const createModelTest = async (t) => {
    const { data, error } = await supabase
        .from('model_tests').insert(toTestRow(t)).select().single();
    fail(error, 'Could not create the model test');
    await syncTestQuestions(data.id, t.questionIds);
    return { ...data, questionIds: t.questionIds || [] };
};

export const updateModelTest = async (id, t) => {
    const { data, error } = await supabase
        .from('model_tests')
        .update({ ...toTestRow(t), updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
    fail(error, 'Could not update the model test');
    if (t.questionIds) await syncTestQuestions(id, t.questionIds);
    return { ...data, questionIds: t.questionIds || [] };
};

export const deleteModelTest = async (id) => {
    const { error } = await supabase.from('model_tests').delete().eq('id', id);
    fail(error, 'Could not delete the model test');
};

export const setTestStatus = async (id, status, examType = 'regular') => {
    const { error } = await supabase.from('model_tests').update({
        status,
        exam_type: examType,
        published_at: status === 'published' ? new Date().toISOString() : null,
    }).eq('id', id);
    fail(error, 'Could not change the publish status');
};

/* ═══════════════ SCHEDULE ═══════════════ */
export const getSchedule = async () => {
    const { data, error } = await supabase
        .from('exam_schedule').select('*').eq('id', 1).maybeSingle();
    if (error) console.error('[db] schedule', error);
    return data || {};
};

const weekStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
};

export const setDailyExam = async (testId) => {
    const { error } = await supabase.from('exam_schedule').update({
        daily_test_id: testId,
        daily_date: testId ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString(),
    }).eq('id', 1);
    fail(error, 'Could not set the daily exam');
    if (testId) await setTestStatus(testId, 'published', 'daily');
};

export const setWeeklyExam = async (testId) => {
    const { error } = await supabase.from('exam_schedule').update({
        weekly_test_id: testId,
        weekly_week: testId ? weekStart() : null,
        updated_at: new Date().toISOString(),
    }).eq('id', 1);
    fail(error, 'Could not set the weekly exam');
    if (testId) await setTestStatus(testId, 'published', 'weekly');
};

/* ═══════════════ EXAM TAKING (secure RPCs) ═══════════════ */

/** Returns the paper WITHOUT correct answers — they never leave the server. */
export const getExamPaper = async (testId) => {
    const { data, error } = await supabase.rpc('get_exam_paper', { p_test_id: testId });
    fail(error, 'Could not load the exam');
    return data;
};

/** Scoring happens on the server. The browser only sends the chosen answers. */
export const submitExam = async (testId, answers, timeTaken) => {
    const { data, error } = await supabase.rpc('submit_exam', {
        p_test_id: testId, p_answers: answers, p_time_taken: Math.max(0, timeTaken | 0),
    });
    fail(error, 'Could not submit the exam');
    return data;
};

/** Full review of a submitted paper (server releases answers only to the owner). */
export const getResultReview = async (resultId) => {
    const { data, error } = await supabase.rpc('get_result_review', { p_result_id: resultId });
    fail(error, 'Could not load the review');
    return data;
};

/** Written answers still awaiting AI grading, for one result. */
export const getPendingWritten = async (resultId) => {
    const { data, error } = await supabase.rpc('get_pending_written', { p_result_id: resultId });
    fail(error, 'Could not load pending answers');
    return data || [];
};

/** All written assessments for a result (for admin review). */
export const listWrittenAssessments = async (resultId) => {
    // Try the RPC first (returns rich data with question text)
    const { data, error } = await supabase.rpc('list_written_assessments', { p_result_id: resultId });
    if (!error && data) return data || [];

    // Fallback: direct table query (less data, but always works)
    console.warn('[db] list_written_assessments RPC not available, using table fallback');
    const { data: d2, error: e2 } = await supabase
        .from('written_assessments').select('*').eq('result_id', resultId);
    if (e2) console.error('[db] assessments', e2);
    return d2 || [];
};

/* ═══════════════ RESULTS ═══════════════ */
export const listMyResults = async (userId) => {
    const { data, error } = await supabase
        .from('exam_results').select('*')
        .eq('student_id', userId)
        .order('submitted_at', { ascending: false });
    fail(error, 'Could not load your results');
    return data || [];
};

export const listAllResults = async () => {
    const { data, error } = await supabase
        .from('exam_results')
        .select('*, profiles:student_id(full_name, student_id, username)')
        .order('submitted_at', { ascending: false });
    fail(error, 'Could not load results');
    return data || [];
};

export const recordWrittenAssessment = async (payload) => {
    const { data, error } = await supabase.rpc('record_written_assessment', {
        p_result_id:    payload.resultId,
        p_question_id:  payload.questionId,
        p_student_answer: payload.studentAnswer || '',
        p_awarded:      Number(payload.awarded) || 0,
        p_max:          Number(payload.max) || 1,
        p_feedback:     payload.feedback || '',
        p_strengths:    payload.strengths || [],
        p_improvements: payload.improvements || [],
        p_sources:      payload.sources || [],
    });
    fail(error, 'Could not save the assessment');
    return data;
};

/* ═══════════════ USERS ═══════════════ */
export const listProfiles = async () => {
    const { data, error } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false });
    fail(error, 'Could not load users');
    return data || [];
};

export const updateProfile = async (id, updates) => {
    const clean = {};
    if (updates.full_name !== undefined) clean.full_name = cleanText(updates.full_name, 60);
    if (updates.phone !== undefined)     clean.phone = updates.phone || null;
    if (updates.role !== undefined)      clean.role = updates.role;
    if (updates.is_active !== undefined) clean.is_active = updates.is_active;
    clean.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('profiles').update(clean).eq('id', id).select().single();
    fail(error, 'Could not update the user');
    return data;
};

/** Admin password reset — runs in a Supabase Edge Function, never in the browser. */
export const adminResetPassword = async (targetUserId, newPassword) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Your session expired. Please sign in again.');

    const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/admin-reset-password`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ target_user_id: targetUserId, new_password: newPassword }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(
            body.error ||
            'Password reset failed. Make sure the admin-reset-password Edge Function is deployed.'
        );
    }
    return body;
};

export const clearMustChangePassword = async (userId) => {
    await supabase.from('profiles')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('id', userId);
};
