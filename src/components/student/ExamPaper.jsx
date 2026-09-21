import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Clock, Send, AlertTriangle, CheckCircle2,
    Circle, ShieldAlert, PenLine, Info, Sparkles, Camera, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { EmptyState, Loader } from '../common/Loader';
import { Alert } from '../common/Input';
import { seededShuffle, seedFrom } from '../../utils/security';
import { ResultView } from './ResultView';
import { GovtExamPaper } from '../common/GovtExamPaper';

// ── Session keys to prevent re-entry after reload / window close ──────────
const sessionKey = (testId) => `exam_active_${testId}`;
const sessionStarted = (testId) => sessionStorage.getItem(sessionKey(testId)) === 'started';
const markSessionStarted = (testId) => sessionStorage.setItem(sessionKey(testId), 'started');
const markSessionDone = (testId) => sessionStorage.removeItem(sessionKey(testId));

export const ExamPaper = ({ testId, onExit }) => {
    const { profile } = useAuth();
    const { loadExamPaper, submitExam, hasSubmitted } = useExam();
    const toast = useToast();

    const [paper, setPaper]    = useState(null);
    const [loadErr, setLoadErr] = useState('');
    const [started, setStarted] = useState(false);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [result, setResult]  = useState(null);
    const [terminated, setTerminated] = useState(false);
    const [termReason, setTermReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [grading, setGrading]  = useState(false);
    const [answerModal, setAnswerModal] = useState(false);
    const [activeQ, setActiveQ]  = useState(null);   // question being answered in modal
    const [draftAnswer, setDraftAnswer] = useState('');
    const [draftImage, setDraftImage]   = useState(null);
    const [imageErr, setImageErr]   = useState('');
    const [imageValidating, setImageValidating] = useState(false);

    const startRef    = useRef(null);
    const deadlineRef = useRef(null);
    const doneRef     = useRef(false);
    const submitRef   = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef  = useRef(null);

// Prevent image/file picker from being treated as cheating
const filePickerOpenRef = useRef(false);

    // ── Load paper ─────────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const p = await loadExamPaper(testId);
                if (!alive) return;
                setPaper(p);
                setTimeLeft((p.time_limit || 30) * 60);
            } catch (e) { if (alive) setLoadErr(e.message); }
        })();
        return () => { alive = false; };
    }, [testId, loadExamPaper]);

    // ── Shuffle: stable per student ────────────────────────────────────────
    const questions = useMemo(() => {
        if (!paper?.questions) return [];
        const seed = seedFrom(`${testId}${profile?.id || ''}`);
        return seededShuffle(paper.questions, seed).map(q => ({
            ...q,
            options: q.question_type === 'written'
                ? []
                : seededShuffle(q.options || [], seed + (q.question_text?.length || 0)),
        }));
    }, [paper, testId, profile]);

    const total = questions.length;
    const answered = Object.values(answers).filter(v => {
        if (v === undefined || v === null) return false;
        if (typeof v === 'object') return Boolean(v.text?.trim() || v.image?.data);
        return String(v).trim() !== '';
    }).length;

    // ── Submit ─────────────────────────────────────────────────────────────
    const doSubmit = useCallback(async (auto = false, reason = '') => {
    if (doneRef.current) return;

    doneRef.current = true;
    setSubmitting(true);

    try {
        const elapsed = startRef.current
            ? Math.round((Date.now() - startRef.current) / 1000)
            : 0;

        const res = await submitExam(
            testId,
            answers,
            elapsed,
            setGrading
        );

        // IMPORTANT:
        // Only clear session AFTER successful submission
        markSessionDone(testId);

        setResult(res);

        if (auto) {
            toast.warning(
                reason || 'পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হয়েছে।'
            );
        } else {
            toast.success('পরীক্ষা সফলভাবে জমা হয়েছে।');
        }

    } catch (e) {
        // Submission failed → allow another attempt
        doneRef.current = false;
        toast.error(e.message);

    } finally {
        setSubmitting(false);
        setGrading(false);
    }

}, [answers, testId, submitExam, toast]);

    useEffect(() => { submitRef.current = doSubmit; }, [doSubmit]);

    // ── Timer ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!started || result || !deadlineRef.current) return;
        const tick = () => {
            const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
            setTimeLeft(left);
            if (left <= 0) {
                clearInterval(t);
                submitRef.current?.(true, 'সময় শেষ — পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হয়েছে।');
            }
        };
        const t = setInterval(tick, 1000);
        tick();
        return () => clearInterval(t);
    }, [started, result]);

    // ── Anti-cheat ─────────────────────────────────────────────────────────
    // ── Anti-cheat ─────────────────────────────────────────────────────────
useEffect(() => {
    if (!started || result) return;

    const terminate = (reason) => {
        if (doneRef.current) return;

        // Immediately lock the exam
        setTerminated(true);
        setTermReason(reason);

        // Auto-submit all current answers
        submitRef.current?.(true, reason);
    };


    // ─────────────────────────────────────────────
    // TAB SWITCH / MINIMISE / APP SWITCH
    // ─────────────────────────────────────────────
    const onHide = () => {
        if (!document.hidden) return;

        terminate(
            'পরীক্ষা বাতিল: পরীক্ষার উইন্ডো/ট্যাব থেকে বের হওয়া শনাক্ত হয়েছে।'
        );
    };


    // ─────────────────────────────────────────────
    // WINDOW LOSES FOCUS
    // ─────────────────────────────────────────────
    const onBlur = () => {

        // File/image picker is allowed
        if (filePickerOpenRef.current) {
            return;
        }

        // Tab switching is already handled by visibilitychange
        if (document.hidden) {
            return;
        }

        terminate(
            'পরীক্ষা বাতিল: পরীক্ষার উইন্ডো থেকে ফোকাস সরানো শনাক্ত হয়েছে।'
        );
    };


    // Reset file picker flag when browser gets focus again
    const onFocus = () => {
        filePickerOpenRef.current = false;
    };


    // ─────────────────────────────────────────────
    // RELOAD / CLOSE
    // ─────────────────────────────────────────────
    const onLeave = (e) => {
        if (doneRef.current) return;

        /*
         Browser does not guarantee that an async request can
         finish during beforeunload.

         Therefore DO NOT remove the session marker here.

         If the student reloads/closes the page, sessionStarted(testId)
         remains true and the existing re-entry protection below
         will block the exam.
        */

        e.preventDefault();

        e.returnValue =
            'পরীক্ষা চলছে। পেইজ ছাড়লে পরীক্ষা বাতিল হয়ে যাবে।';

        return e.returnValue;
    };


    // ─────────────────────────────────────────────
    // BLOCK DEVTOOLS / RESTRICTED SHORTCUTS
    // ─────────────────────────────────────────────
    const blockKeys = (e) => {
        const k = e.key?.toLowerCase();

        const typing =
            ['INPUT', 'TEXTAREA'].includes(
                e.target?.tagName
            );

        if (
            e.key === 'F12' ||

            (
                e.ctrlKey &&
                e.shiftKey &&
                ['i', 'j', 'c'].includes(k)
            ) ||

            (
                e.ctrlKey &&
                ['u', 's', 'p'].includes(k)
            ) ||

            (
                e.ctrlKey &&
                ['c', 'x'].includes(k) &&
                !typing
            )
        ) {
            e.preventDefault();
        }
    };


    // ─────────────────────────────────────────────
    // BLOCK RIGHT CLICK / COPY / CUT
    // ─────────────────────────────────────────────
    const blockCtx = (e) => {
        if (
            !['INPUT', 'TEXTAREA'].includes(
                e.target?.tagName
            )
        ) {
            e.preventDefault();
        }
    };


    document.addEventListener(
        'contextmenu',
        blockCtx
    );

    document.addEventListener(
        'copy',
        blockCtx
    );

    document.addEventListener(
        'cut',
        blockCtx
    );

    document.addEventListener(
        'keydown',
        blockKeys
    );

    document.addEventListener(
        'visibilitychange',
        onHide
    );

    window.addEventListener(
        'blur',
        onBlur
    );

    window.addEventListener(
        'focus',
        onFocus
    );

    window.addEventListener(
        'beforeunload',
        onLeave
    );


    return () => {

        document.removeEventListener(
            'contextmenu',
            blockCtx
        );

        document.removeEventListener(
            'copy',
            blockCtx
        );

        document.removeEventListener(
            'cut',
            blockCtx
        );

        document.removeEventListener(
            'keydown',
            blockKeys
        );

        document.removeEventListener(
            'visibilitychange',
            onHide
        );

        window.removeEventListener(
            'blur',
            onBlur
        );

        window.removeEventListener(
            'focus',
            onFocus
        );

        window.removeEventListener(
            'beforeunload',
            onLeave
        );
    };

}, [started, result]);

    // Auto-focus textarea when modal opens
    useEffect(() => {
        if (answerModal && textareaRef.current) {
            const t = setTimeout(() => textareaRef.current?.focus(), 80);
            return () => clearTimeout(t);
        }
    }, [answerModal]);

    // ── States ─────────────────────────────────────────────────────────────
    if (loadErr) return <EmptyState icon={AlertTriangle} title="পরীক্ষাটি লোড করা যায়নি" text={loadErr}
        action={<Button onClick={onExit}>ফিরে যান</Button>} />;
    if (!paper) return <Loader text="পরীক্ষা লোড হচ্ছে…" full />;

    if (grading && !result) {
        return (
            <div className="anim-up" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: '0 auto 18px',
                    display: 'grid', placeItems: 'center', background: 'var(--brand-l)', color: 'var(--brand)',
                }}>
                    <Sparkles size={30} className="spin" style={{ animationDuration: '1.6s' }} />
                </div>
                <h2 style={{ fontSize: 19, fontWeight: 800 }}>লিখিত উত্তর মূল্যায়ন হচ্ছে…</h2>
                <p className="f-13 text-sub mt-1" style={{ lineHeight: 1.6 }}>
                    AI প্রতিটি উত্তর পড়ছে। এক মিনিটের মধ্যে শেষ হবে — পেইজ বন্ধ করবেন না।
                </p>
            </div>
        );
    }

    if (result) return <ResultView result={result} testId={testId} onClose={onExit} />;

    if (hasSubmitted(testId)) return <EmptyState icon={CheckCircle2} title="ইতিমধ্যে জমা দেওয়া হয়েছে"
        text="আপনি এই পরীক্ষাটি সম্পন্ন করেছেন। My History থেকে রিভিউ করুন।"
        action={<Button onClick={onExit}>ফিরে যান</Button>} />;

    if (!total) return <EmptyState icon={AlertTriangle} title="এই পরীক্ষায় কোনো প্রশ্ন নেই"
        action={<Button onClick={onExit}>ফিরে যান</Button>} />;

    // ── Terminated screen ──────────────────────────────────────────────────
    if (terminated) {
        return (
            <div className="anim-up" style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
                <div style={{
                    width: 72, height: 72, borderRadius: 22, margin: '0 auto 20px',
                    display: 'grid', placeItems: 'center', background: '#fee2e2', color: '#dc2626',
                }}>
                    <ShieldAlert size={36} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', marginBottom: 10 }}>
                    পরীক্ষা বাতিল করা হয়েছে
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', marginBottom: 8 }}>
                    {termReason || 'পরীক্ষার নিয়ম লঙ্ঘন শনাক্ত হয়েছে।'}
                </p>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
                    এই লঙ্ঘন সিস্টেমে রেকর্ড করা হয়েছে এবং আপনার উত্তরসমূহ স্বয়ংক্রিয়ভাবে জমা দেওয়া হয়েছে।
                </p>
                <Button onClick={onExit}>ড্যাশবোর্ডে ফিরে যান</Button>
            </div>
        );
    }

    // ── Blocked: tried to reload or re-enter ───────────────────────────────
    // If session marker exists but they haven't submitted yet → they reloaded mid-exam
    if (sessionStarted(testId) && !started && !result) {
        return (
            <div className="anim-up" style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
                <div style={{
                    width: 72, height: 72, borderRadius: 22, margin: '0 auto 20px',
                    display: 'grid', placeItems: 'center', background: '#fee2e2', color: '#dc2626',
                }}>
                    <ShieldAlert size={36} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', marginBottom: 10 }}>
                    পরীক্ষা পুনরায় শুরু করা যাবে না
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', marginBottom: 24 }}>
                    পরীক্ষা চলাকালীন পেইজ রিলোড বা উইন্ডো বন্ধ করা হয়েছে। নিরাপত্তার কারণে পরীক্ষাটি বাতিল বলে গণ্য হয়েছে।
                </p>
                <Button onClick={() => { markSessionDone(testId); onExit(); }}>ড্যাশবোর্ডে ফিরে যান</Button>
            </div>
        );
    }

    // ── Start screen ───────────────────────────────────────────────────────
    if (!started) {
        const written = questions.filter(q => q.question_type === 'written').length;
        return (
            <div className="anim-up" style={{ maxWidth: 620, margin: '0 auto' }}>
                <div className="card card-pad">
                    {/* Bold warning at very top */}
                    <div style={{
                        background: '#fee2e2', border: '2px solid #dc2626', borderRadius: 10,
                        padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                        <ShieldAlert size={22} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <div style={{ fontWeight: 900, fontSize: 15, color: '#991b1b', marginBottom: 6 }}>
                                ⚠️ পরীক্ষা শুরুর আগে মনোযোগ দিয়ে পড়ুন
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#7f1d1d', lineHeight: 1.75, fontWeight: 600 }}>
                                <li><b>পরীক্ষা চলাকালীন একবারও এই উইন্ডো/ট্যাব থেকে বের হওয়া যাবে না।</b> বের হলেই পরীক্ষা তাৎক্ষণিকভাবে বাতিল হবে।</li>
                                <li><b>একাধিক উইন্ডো বা ট্যাব খোলা যাবে না।</b> শনাক্ত হলে পরীক্ষা বাতিল।</li>
                                <li><b>পেইজ রিলোড বা উইন্ডো বন্ধ করা যাবে না।</b> করলে পরীক্ষায় আর বসা যাবে না।</li>
                                <li>একবার শুরু করলে টাইমার আর থামবে না।</li>
                            </ul>
                        </div>
                    </div>

                    <h1 className="page-title mb-1">{paper.title}</h1>
                    {paper.description && <p className="page-sub mb-3">{paper.description}</p>}

                    <div className="grid grid-2 mb-3" style={{ gap: 12 }}>
                        <Fact label="প্রশ্ন সংখ্যা" value={total} />
                        <Fact label="সময়সীমা" value={`${paper.time_limit} মিনিট`} />
                        <Fact label="পাস মার্ক" value={`${paper.pass_marks}%`} />
                        <Fact label="নেগেটিভ মার্কিং"
                            value={paper.negative_marking ? `−${paper.negative_value} প্রতি ভুলে` : 'নেই'} />
                    </div>

                    {written > 0 && (
                        <div className="mb-2"><Alert type="info" icon={PenLine}>
                            {written}টি লিখিত প্রশ্ন আছে। জমা দেওয়ার পরপরই AI স্বয়ংক্রিয়ভাবে মূল্যায়ন করবে।
                        </Alert></div>
                    )}

                    {paper.instructions && (
                        <div className="mb-2"><Alert type="warning" icon={Info}>{paper.instructions}</Alert></div>
                    )}

                    <div className="flex gap-2 mt-3">
                        <Button variant="secondary" onClick={onExit}>এখন না</Button>
                        <Button block size="lg" onClick={() => {
                            markSessionStarted(testId);
                            startRef.current = Date.now();
                            deadlineRef.current = Date.now() + (paper.time_limit || 30) * 60 * 1000;
                            setStarted(true);
                        }}>
                            পরীক্ষা শুরু করুন
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Exam in progress ───────────────────────────────────────────────────
    const mm = String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0');
    const ss = String((timeLeft || 0) % 60).padStart(2, '0');
    const urgent = timeLeft < 60, low = timeLeft < 300;

    const openWrittenModal = (q) => {
        const saved = answers[q.id];
        setActiveQ(q);
        setDraftAnswer(typeof saved === 'object' ? (saved?.text || '') : (saved || ''));
        setDraftImage(typeof saved === 'object' ? (saved?.image || null) : null);
        setImageErr('');
        setAnswerModal(true);
    };

    const saveWrittenAnswer = () => {
        if (!activeQ) return;
        const text = draftAnswer.trim();
        const value = draftImage ? { text, image: draftImage } : (text || null);
        setAnswers(a => ({ ...a, [activeQ.id]: value }));
        setAnswerModal(false);
    };

    const handleImageFile = async (file) => {
        setImageErr('');
        if (!file) return;

        // No PDF allowed
        if (file.type === 'application/pdf') {
            setImageErr('PDF ফাইল যোগ করা যাবে না। শুধু ছবি (JPG, PNG, WEBP) যোগ করুন।');
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
            setImageErr('শুধু JPG, PNG বা WEBP ছবি যোগ করা যাবে।');
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const raw = String(reader.result || '');
            const comma = raw.indexOf(',');
            if (comma < 0) { setImageErr('ছবিটি পড়া যায়নি।'); return; }
            const b64 = raw.slice(comma + 1);

            // AI validates that image contains handwritten answer on paper/notebook
            setImageValidating(true);
            try {
                const validationRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [
                            { inline_data: { mime_type: file.type, data: b64 } },
                            { text: `Look at this image carefully. Answer ONLY with a JSON object: {"valid": true/false, "reason": "one short sentence"}

valid = true ONLY if the image clearly shows handwritten text on paper, a notebook, a copybook, or a printed/typed document (Word document printout, typed answer sheet). The writing can be in any language.

valid = false if:
- The image does not show any writing/text at all
- The image shows a computer screen, phone screen, or digital content
- The image is a photograph of nature, people, objects, food, etc. (not a written document)
- The image is blank or has only printed images without written text
- The image is a screenshot or digital graphic

Be strict. Only written documents qualify.` }
                        ]}],
                        generationConfig: { temperature: 0, maxOutputTokens: 100 },
                    }),
                });
                const vData = await validationRes.json();
                const vText = (vData?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
                let vResult = { valid: false, reason: 'Unknown' };
                try {
                    const cleaned = vText.replace(/```json|```/g, '').trim();
                    vResult = JSON.parse(cleaned);
                } catch (_) {
                    // if parse fails, check text
                    vResult = { valid: vText.toLowerCase().includes('"valid":true') || vText.toLowerCase().includes('"valid": true'), reason: vText };
                }

                if (!vResult.valid) {
                    setImageErr(`এই ছবি গ্রহণযোগ্য নয়: ${vResult.reason || 'শুধু খাতায় হাতে লেখা বা টাইপ করা উত্তরের ছবি দিন।'}`);
                    setImageValidating(false);
                    return;
                }

                setDraftImage({ mimeType: file.type, data: b64, name: file.name });
            } catch (err) {
                // If validation API fails, allow the image (fail open)
                console.warn('Image validation failed, allowing:', err);
                setDraftImage({ mimeType: file.type, data: b64, name: file.name });
            }
            setImageValidating(false);
        };
        reader.onerror = () => { setImageErr('ছবিটি পড়া যায়নি।'); };
        reader.readAsDataURL(file);
    };

    const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    const subjects = [...new Set(questions.map(q => q.subject).filter(Boolean))].join(', ') || '—';

    return (
        <div className="student-paper-overlay">
            <style>{`
                body { overflow: hidden; }
                .student-paper-overlay {
                    position: fixed; inset: 0; z-index: 900;
                    background: rgba(15,23,42,.58);
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    padding: 18px; overflow-y: auto;
                }
                .student-paper-shell { max-width: 1120px; margin: 0 auto 28px; }
                .student-paper-toolbar {
                    position: sticky; top: 0; z-index: 12;
                    display: flex; justify-content: space-between; align-items: center; gap: 12px;
                    flex-wrap: wrap; padding: 11px 14px; margin-bottom: 12px;
                    border: 1px solid rgba(255,255,255,.18); border-radius: 14px;
                    background: rgba(15,23,42,.94); color: #fff;
                    box-shadow: 0 10px 30px rgba(0,0,0,.2);
                }
                .student-paper-toolbar .sp-muted { color: #cbd5e1; font-size: 12px; }
                .sp-timer {
                    display:flex; align-items:center; gap:6px; padding:8px 13px;
                    border-radius:9px; font-weight:800; font-size:15px; font-variant-numeric:tabular-nums;
                }
                .img-upload-area {
                    border: 2px dashed var(--border-2); border-radius: 10px;
                    padding: 18px; text-align: center; cursor: pointer;
                    transition: .15s ease; background: var(--surface);
                    margin-top: 14px;
                }
                .img-upload-area:hover { border-color: var(--brand); background: var(--brand-l); }
                .img-upload-area.has-image { border-style: solid; border-color: var(--success); background: var(--success-l); cursor: default; }
                .img-upload-area.validating { border-color: var(--warning); background: #fffbeb; cursor: default; }
                .img-preview { display:flex; align-items:center; gap:12px; text-align:left; }
                @media(max-width:720px){
                    .student-paper-overlay{padding:8px}
                    .student-paper-toolbar{border-radius:10px}
                }
            `}</style>

            <div className="student-paper-shell">
                <div className="student-paper-toolbar">
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{paper.title}</div>
                        <div className="sp-muted">{answered} / {total} উত্তর দেওয়া হয়েছে</div>
                    </div>
                    <div className="flex center gap-2 wrap">
                        <div className="sp-timer" style={{
                            background: urgent ? 'var(--danger)' : low ? '#fef3c7' : 'rgba(255,255,255,.12)',
                            color: urgent ? '#fff' : low ? '#92400e' : '#fff',
                        }}><Clock size={16}/> {mm}:{ss}</div>
                        <Button size="sm" icon={Send} onClick={() => setConfirmOpen(true)}>জমা দিন</Button>
                    </div>
                </div>

                <div className="no-select">
                    <GovtExamPaper
                        title={paper.title}
                        subtitle={paper.description}
                        timeLimit={paper.time_limit || 30}
                        totalMarks={totalMarks}
                        subjects={subjects}
                        instructions={paper.instructions || (paper.negative_marking ? `ভুল উত্তরের জন্য −${paper.negative_value} নম্বর কাটা হবে।` : undefined)}
                        questions={questions}
                        interactive
                        answers={answers}
                        onSelectAnswer={(q, opt) => setAnswers(a => ({ ...a, [q.id]: opt }))}
                        onWrittenAnswer={openWrittenModal}
                    />
                </div>
            </div>

            {/* ── Written answer modal ── */}
            <Modal open={answerModal} onClose={() => setAnswerModal(false)}
                title={`লিখিত উত্তর — প্রশ্ন ${activeQ ? (questions.findIndex(x => x.id === activeQ.id) + 1) : ''}`}
                subtitle="বাংলা বা ইংরেজিতে টাইপ করুন, অথবা খাতায় লিখে ছবি তুলুন।"
                footer={<>
                    <Button variant="secondary" onClick={() => setAnswerModal(false)}>বাতিল</Button>
                    <Button onClick={saveWrittenAnswer} disabled={imageValidating}>
                        {imageValidating ? 'ছবি যাচাই হচ্ছে…' : 'উত্তর সংরক্ষণ করুন'}
                    </Button>
                </>}>

                {activeQ && (
                    <div className="f-13 fw-6 lh-15 mb-2" style={{ color: 'var(--text-sub)' }}>
                        {activeQ.question_text}
                    </div>
                )}

                {/* Textarea — uses ref to avoid focus issues */}
                <textarea
                    ref={textareaRef}
                    className="textarea"
                    rows={8}
                    placeholder="এখানে উত্তর লিখুন…"
                    value={draftAnswer}
                    onChange={e => setDraftAnswer(e.target.value)}
                    style={{ fontSize: 15, lineHeight: 1.75, resize: 'vertical' }}
                />

                <div className="flex between center mt-1 f-11 text-mute">
                    <span>এই উত্তর শুধু এই প্রশ্নের জন্য সংরক্ষিত হবে।</span>
                    <span>{draftAnswer.trim().split(/\s+/).filter(Boolean).length} words</span>
                </div>

                {/* Image upload — redesigned, no size limit */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = ''; }}
                />

                {imageValidating ? (
                    <div className="img-upload-area validating">
                        <Sparkles size={24} style={{ color: 'var(--warning)', margin: '0 auto 8px', display: 'block' }} />
                        <div className="f-13 fw-7">ছবি যাচাই হচ্ছে…</div>
                        <div className="f-11 text-sub mt-1">AI নিশ্চিত করছে এটি খাতার ছবি কিনা</div>
                    </div>
                ) : !draftImage ? (
                    <div
                        className="img-upload-area"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); handleImageFile(e.dataTransfer.files?.[0]); }}>
                        <Camera size={28} style={{ color: 'var(--text-sub)', display: 'block', margin: '0 auto 8px' }} />
                        <div className="f-13 fw-7" style={{ color: 'var(--text)' }}>খাতায় লিখে ছবি যোগ করুন</div>
                        <div className="f-11 text-sub mt-1">ক্লিক করুন বা ছবি টেনে আনুন · JPG, PNG, WEBP</div>
                        <div className="f-11 text-mute mt-1">লেখা উত্তর, ছবি বা দুটোই AI মূল্যায়ন করবে · PDF গ্রহণযোগ্য নয়</div>
                    </div>
                ) : (
                    <div className="img-upload-area has-image">
                        <div className="img-preview">
                            <img
                                src={`data:${draftImage.mimeType};base64,${draftImage.data}`}
                                alt="Answer preview"
                                style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="f-12 fw-7" style={{ color: 'var(--success)' }}>✓ ছবি যোগ হয়েছে</div>
                                <div className="f-11 text-sub mt-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {draftImage.name || 'Answer image'}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button type="button" className="btn btn-ghost btn-sm"
                                        onClick={() => fileInputRef.current?.click()}>
                                        ছবি বদলান
                                    </button>
                                    <button type="button" className="btn btn-ghost btn-sm"
                                        style={{ color: 'var(--danger)' }}
                                        onClick={() => setDraftImage(null)}>
                                        <X size={12} style={{ marginRight: 3 }} /> সরিয়ে দিন
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {imageErr && <div className="f-12 mt-2" style={{ color: 'var(--danger)', fontWeight: 600 }}>{imageErr}</div>}
            </Modal>

            {/* ── Submit confirm modal ── */}
            <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}
                title="পরীক্ষা জমা দেবেন?"
                subtitle="জমা দেওয়ার পর উত্তর পরিবর্তন করা যাবে না।"
                footer={<>
                    <Button variant="secondary" onClick={() => setConfirmOpen(false)}>আরও কিছুক্ষণ</Button>
                    <Button onClick={() => { setConfirmOpen(false); doSubmit(false); }} loading={submitting}>
                        হ্যাঁ, জমা দিন
                    </Button>
                </>}>
                <div className="grid grid-2 mb-2" style={{ gap: 12 }}>
                    <Box icon={CheckCircle2} color="var(--success)" label="উত্তর দেওয়া হয়েছে" value={answered} />
                    <Box icon={Circle} color="var(--text-mute)" label="উত্তর বাকি" value={total - answered} />
                </div>
                {answered < total && <Alert type="warning" icon={AlertTriangle}>
                    {total - answered}টি প্রশ্নের উত্তর এখনও দেওয়া হয়নি।
                </Alert>}
            </Modal>
        </div>
    );
};

const Fact = ({ label, value }) => (
    <div className="card card-pad card-soft" style={{ padding: 14 }}>
        <div className="f-11 text-sub fw-6">{label}</div>
        <div className="f-15 fw-7 mt-1">{value}</div>
    </div>
);

const Box = ({ icon: Icon, color, label, value }) => (
    <div className="card card-pad text-center" style={{ padding: 15 }}>
        <Icon size={19} style={{ color, margin: '0 auto 7px', display: 'block' }} />
        <div className="fw-8" style={{ fontSize: 20 }}>{value}</div>
        <div className="f-11 text-sub fw-6">{label}</div>
    </div>
);

export default ExamPaper;
