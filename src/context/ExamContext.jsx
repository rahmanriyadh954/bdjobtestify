import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as db from '../services/db';
import { useAuth } from './AuthContext';
import { assessWrittenAnswer } from '../services/aiService';

const ExamContext = createContext(null);

const todayStr = () => new Date().toISOString().split('T')[0];
const weekStr  = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; };

export const ExamProvider = ({ children }) => {
    const { profile, isAdmin } = useAuth();

    const [questions,   setQuestions]   = useState([]);
    const [modelTests,  setModelTests]  = useState([]);
    const [schedule,    setSchedule]    = useState({});
    const [results,     setResults]     = useState([]);
    const [profiles,    setProfiles]    = useState([]);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState('');

    const refresh = useCallback(async () => {
        if (!profile) { setQuestions([]); setModelTests([]); setResults([]); setProfiles([]); setSchedule({}); return; }
        setLoading(true); setError('');
        try {
            const [tests, sched] = await Promise.all([db.listModelTests(), db.getSchedule()]);
            setModelTests(tests); setSchedule(sched);
            if (isAdmin) {
                const [qs, rs, ps] = await Promise.all([db.listQuestions(), db.listAllResults(), db.listProfiles()]);
                setQuestions(qs); setResults(rs); setProfiles(ps);
            } else {
                setResults(await db.listMyResults(profile.id));
                setQuestions([]); setProfiles([]);
            }
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [profile, isAdmin]);

    useEffect(() => { refresh(); }, [refresh]);

    // ═══ QUESTION BANK ═══
    const addQuestion          = useCallback(async (q)    => { const r = await db.createQuestion(q);         setQuestions(p => [r, ...p]); return r; }, []);
    const addMultipleQuestions = useCallback(async (arr)  => { const r = await db.createQuestions(arr);      setQuestions(p => [...r, ...p]); return r; }, []);
    const updateQuestion       = useCallback(async (id,u) => { const r = await db.updateQuestion(id,u);      setQuestions(p => p.map(q => q.id===id ? r : q)); return r; }, []);
    const removeQuestion       = useCallback(async (id)   => { await db.deleteQuestion(id);                  setQuestions(p => p.filter(q => q.id!==id)); }, []);
    const removeQuestions      = useCallback(async (ids)  => { await db.deleteQuestions(ids);                setQuestions(p => p.filter(q => !ids.includes(q.id))); }, []);

    // ═══ MODEL TESTS ═══
    const createModelTest  = useCallback(async (t)    => { const r = await db.createModelTest(t);         setModelTests(p => [r,...p]); return r; }, []);
    const updateModelTest  = useCallback(async (id,t) => { const r = await db.updateModelTest(id,t);      setModelTests(p => p.map(x => x.id===id ? {...x,...r} : x)); return r; }, []);
    const removeModelTest  = useCallback(async (id)   => { await db.deleteModelTest(id);                  setModelTests(p => p.filter(t => t.id!==id)); }, []);
    const publishTest      = useCallback(async (id)   => { await db.setTestStatus(id,'published');        setModelTests(p => p.map(t => t.id===id ? {...t,status:'published',published_at:new Date().toISOString()} : t)); }, []);
    const unpublishTest    = useCallback(async (id)   => { await db.setTestStatus(id,'draft');            setModelTests(p => p.map(t => t.id===id ? {...t,status:'draft'} : t)); }, []);

    // ═══ SCHEDULE ═══
    const assignDaily  = useCallback(async (id) => { await db.setDailyExam(id);  await refresh(); }, [refresh]);
    const assignWeekly = useCallback(async (id) => { await db.setWeeklyExam(id); await refresh(); }, [refresh]);

    const dailyExam  = useMemo(() => {
        if (!schedule.daily_test_id || schedule.daily_date !== todayStr()) return null;
        return modelTests.find(t => t.id === schedule.daily_test_id && t.status === 'published') || null;
    }, [schedule, modelTests]);

    const weeklyExam = useMemo(() => {
        if (!schedule.weekly_test_id || schedule.weekly_week !== weekStr()) return null;
        return modelTests.find(t => t.id === schedule.weekly_test_id && t.status === 'published') || null;
    }, [schedule, modelTests]);

    const publishedTests = useMemo(() => modelTests.filter(t => t.status === 'published'), [modelTests]);

    // ═══ EXAM TAKING ═══
    const loadExamPaper = useCallback((testId) => db.getExamPaper(testId), []);

    const submitExam = useCallback(async (testId, answers, timeTaken, onGradingChange) => {
        // ── Step 1: strip image data from answers before sending to DB ────────
        // Base64 images can be several MB — too large for jsonb text field.
        // We keep the full in-memory answers (with images) for AI grading below.
        const answersForDB = {};
        const imageMap = {};   // questionId → {mimeType, data, name}

        Object.entries(answers).forEach(([qid, val]) => {
            if (val && typeof val === 'object' && ('text' in val || 'image' in val)) {
                answersForDB[qid] = val.text || '';          // only text goes to DB
                if (val.image) imageMap[qid] = val.image;   // image kept in memory
            } else {
                answersForDB[qid] = val;
            }
        });

        // ── Step 2: submit (MCQ scored server-side) ───────────────────────────
        const res = await db.submitExam(testId, answersForDB, timeTaken);

        // ── Step 3: AI grades every written answer immediately ────────────────
        if (res.needs_grading) {
            try {
                const pending = await db.getPendingWritten(res.id);
                if (pending.length) onGradingChange?.(true);

                for (const item of pending) {
                    // student_answer from DB is plain text (image stripped above)
                    const typedAnswer = item.student_answer || '';
                    // retrieve image from in-memory map (by question_id)
                    const studentImage = imageMap[item.question_id] || null;

                    let out = null;
                    let lastError = null;
                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            out = await assessWrittenAnswer({
                                question:     item.question_text,
                                modelAnswer:  item.model_answer,
                                keywords:     item.keywords || [],
                                studentAnswer: typedAnswer,
                                studentImage,
                                maxMarks:     Number(item.marks) || 5,
                                useResearch:  true,
                            });
                            break;
                        } catch (err) {
                            lastError = err;
                            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                        }
                    }
                    if (!out) throw lastError || new Error('AI মূল্যায়ন ব্যর্থ হয়েছে।');

                    const rec = await db.recordWrittenAssessment({
                        resultId:      res.id,
                        questionId:    item.question_id,
                        studentAnswer: typedAnswer || (studentImage ? '[Handwritten image]' : ''),
                        awarded:       out.awarded,
                        max:           Number(item.marks) || 5,
                        feedback:      out.feedback,
                        strengths:     out.strengths,
                        improvements:  out.improvements,
                        sources:       out.sources,
                    });
                    res.score         = rec.score;
                    res.percentage    = rec.percentage;
                    res.needs_grading = rec.remaining > 0;
                }
            } catch (e) {
                console.error('[exam] AI grading failed', e);
                throw new Error(`পরীক্ষা জমা হয়েছে, কিন্তু AI মূল্যায়ন সম্পন্ন হয়নি: ${e.message}`);
            } finally {
                onGradingChange?.(false);
            }
        }

        if (profile) setResults(await db.listMyResults(profile.id));
        return res;
    }, [profile]);

    const hasSubmitted = useCallback(
        (testId) => results.some(r => r.model_test_id === testId && r.student_id === profile?.id),
        [results, profile]);

    const resultFor = useCallback(
        (testId) => results.find(r => r.model_test_id === testId && r.student_id === profile?.id) || null,
        [results, profile]);

    // ═══ STATS ═══
    const statsFor = useCallback((studentId) => {
        const mine = results.filter(r => r.student_id === studentId);
        if (!mine.length) return { total: 0, passed: 0, failed: 0, avgScore: 0, highestScore: 0, pending: 0 };
        const pcts = mine.map(r => Number(r.percentage) || 0);
        return {
            total:        mine.length,
            passed:       mine.filter(r => r.passed).length,
            failed:       mine.filter(r => !r.passed).length,
            avgScore:     parseFloat((pcts.reduce((a,b)=>a+b,0)/pcts.length).toFixed(1)),
            highestScore: Math.max(...pcts),
            pending:      mine.filter(r => r.needs_grading).length,
        };
    }, [results]);

    const myResults = useMemo(() => results.filter(r => r.student_id === profile?.id), [results, profile]);

    const value = {
        loading, error, refresh,
        questions, addQuestion, addMultipleQuestions, updateQuestion, removeQuestion, removeQuestions,
        modelTests, publishedTests, createModelTest, updateModelTest, removeModelTest, publishTest, unpublishTest,
        schedule, assignDaily, assignWeekly, dailyExam, weeklyExam,
        loadExamPaper, submitExam, hasSubmitted, resultFor,
        results, myResults, statsFor, profiles,
        getResultReview:          db.getResultReview,
        getPendingWritten:        db.getPendingWritten,
        listWrittenAssessments:   db.listWrittenAssessments,
        recordWrittenAssessment:  db.recordWrittenAssessment,
    };

    return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
};

export const useExamContext = () => {
    const ctx = useContext(ExamContext);
    if (!ctx) throw new Error('useExamContext must be used within ExamProvider');
    return ctx;
};
export const useExam = useExamContext;
