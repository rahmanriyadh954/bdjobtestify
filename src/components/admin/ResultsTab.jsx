import React, { useState, useMemo } from 'react';
import {
    ClipboardCheck, Eye, Download, TrendingUp, Hourglass, Sparkles,
    CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw, Edit3,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { useToast } from '../../context/ToastContext';
import { PageHead, StatCard, SearchBox } from '../common/Card';
import { EmptyState, Loader } from '../common/Loader';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Alert } from '../common/Input';
import { ResultView } from '../student/ResultView';
import { assessWrittenAnswer, isAIConfigured } from '../../services/aiService';

export const ResultsTab = ({ onViewStudent }) => {
    const { results, publishedTests, modelTests, loading, refresh } = useExam();
    const [search, setSearch] = useState('');
    const [fTest, setFTest] = useState('all');
    const [fStatus, setFStatus] = useState('all');
    const [viewing, setViewing] = useState(null);
    const [grading, setGrading] = useState(null);

    const rows = useMemo(() => results.filter(r => {
        const s = search.trim().toLowerCase();
        const name = r.profiles?.full_name?.toLowerCase() || '';
        const sid = r.profiles?.student_id?.toLowerCase() || '';
        const okS = !s || name.includes(s) || sid.includes(s) || r.exam_title?.toLowerCase().includes(s);
        const okT = fTest === 'all' || r.model_test_id === fTest;
        const okSt = fStatus === 'all'
            || (fStatus === 'pending' && r.needs_grading)
            || (fStatus === 'passed' && r.passed && !r.needs_grading)
            || (fStatus === 'failed' && !r.passed && !r.needs_grading);
        return okS && okT && okSt;
    }), [results, search, fTest, fStatus]);

    const stats = useMemo(() => {
        if (!rows.length) return { avg: 0, pass: 0, high: 0, pending: 0 };
        const p = rows.map(r => Number(r.percentage) || 0);
        return {
            avg: (p.reduce((a, b) => a + b, 0) / p.length).toFixed(1),
            pass: rows.filter(r => r.passed).length,
            high: Math.round(Math.max(...p)),
            pending: rows.filter(r => r.needs_grading).length,
        };
    }, [rows]);

    const exportCSV = () => {
        const head = ['Student', 'Student ID', 'Exam', 'Score', 'Total', 'Percentage', 'Status', 'Submitted'];
        const body = rows.map(r => [
            r.profiles?.full_name || '', r.profiles?.student_id || '', r.exam_title,
            r.score, r.total_marks, `${Math.round(r.percentage)}%`,
            r.needs_grading ? 'Awaiting marking' : r.passed ? 'Pass' : 'Fail',
            new Date(r.submitted_at).toLocaleString(),
        ]);
        const csv = '\uFEFF' + [head, ...body]
            .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `bd-jobtestify-results-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (viewing) return <ResultView result={viewing} resultId={viewing.id} onClose={() => setViewing(null)} />;
    if (loading && !results.length) return <Loader text="Loading results…" full />;

    return (
        <div className="anim-up">
            <PageHead title="Results" sub="Every submission across every exam."
                action={<div className="flex gap-2 wrap toolbar-actions">
                    <Button variant="secondary" icon={RefreshCw} onClick={refresh}>Refresh</Button>
                    {rows.length > 0 && <Button variant="secondary" icon={Download} onClick={exportCSV}>Export CSV</Button>}
                </div>} />

            {!results.length ? (
                <EmptyState icon={ClipboardCheck} title="No submissions yet"
                    text="Once students start taking exams, their results will appear here." />
            ) : (
                <>
                    <div className="grid grid-4 mb-3">
                        <StatCard icon={ClipboardCheck} label="Submissions" value={rows.length} color="var(--brand)" />
                        <StatCard icon={TrendingUp} label="Average Score" value={`${stats.avg}%`} color="var(--accent)" />
                        <StatCard icon={CheckCircle2} label="Passed" value={stats.pass} color="var(--success)" />
                        <StatCard icon={stats.pending ? Hourglass : TrendingUp}
                            label={stats.pending ? 'Awaiting Marking' : 'Highest Score'}
                            value={stats.pending || `${stats.high}%`}
                            color={stats.pending ? 'var(--warning)' : '#ec4899'} />
                    </div>

                    <div className="flex gap-2 wrap mb-2">
                        <SearchBox value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or exam…" />
                        <select className="select" style={{ width: 'auto', minWidth: 170 }} value={fTest}
                            onChange={e => setFTest(e.target.value)} aria-label="Filter by exam">
                            <option value="all">All Exams</option>
                            {modelTests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                        <select className="select" style={{ width: 'auto', minWidth: 150 }} value={fStatus}
                            onChange={e => setFStatus(e.target.value)} aria-label="Filter by status">
                            <option value="all">All Statuses</option>
                            <option value="pending">Awaiting marking</option>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Student</th><th>Exam</th><th>Score</th><th>Status</th><th>Submitted</th><th></th></tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td>
                                            <div className="f-13 fw-6">{r.profiles?.full_name || 'Student'}</div>
                                            <div className="f-11 text-mute">{r.profiles?.student_id}</div>
                                        </td>
                                        <td className="f-13">{r.exam_title}</td>
                                        <td>
                                            <span className="fw-7">{r.score}</span>
                                            <span className="text-mute f-12"> / {r.total_marks}</span>
                                            <div className="f-11 text-sub">{Math.round(r.percentage)}%</div>
                                        </td>
                                        <td>
                                            {r.needs_grading
                                                ? <span className="badge badge-warning"><Hourglass size={10} /> Needs marking</span>
                                                : <span className={`badge ${r.passed ? 'badge-success' : 'badge-danger'}`}>
                                                    {r.passed ? 'Passed' : 'Failed'}
                                                  </span>}
                                        </td>
                                        <td className="f-12 text-sub">
                                            {new Date(r.submitted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                {/* Mark button — for admin to manually or AI-mark written answers */}
                                                <Button size="sm" icon={r.needs_grading ? Sparkles : Edit3}
                                                    variant={r.needs_grading ? 'primary' : 'secondary'}
                                                    onClick={() => setGrading(r)}>
                                                    {r.needs_grading ? 'Mark' : 'Review'}
                                                </Button>
                                                <button className="btn btn-ghost btn-icon btn-sm" aria-label="View paper"
                                                    onClick={() => setViewing(r)}><Eye size={15} /></button>
                                                {onViewStudent && (
                                                    <button className="btn btn-ghost btn-sm"
                                                        onClick={() => onViewStudent(r.student_id)}>Report</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {grading && <WrittenGrader result={grading} onClose={() => setGrading(null)} />}
        </div>
    );
};

/* ─── Written answer grading modal (AI + manual) ────────────────────────── */
const WrittenGrader = ({ result, onClose }) => {
    const { getPendingWritten, listWrittenAssessments, recordWrittenAssessment, refresh } = useExam();
    const toast = useToast();
    const [items, setItems] = useState(null);
    const [done, setDone] = useState([]);
    const [busyIdx, setBusyIdx] = useState(-1);
    const [manualIdx, setManualIdx] = useState(null);   // index of item being manually marked
    const [manualMark, setManualMark] = useState('');
    const [manualFeedback, setManualFeedback] = useState('');
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);

    // Load all written questions: pending + already assessed merged by question_id
    React.useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                // Fetch both in parallel
                const [pending, assessed] = await Promise.all([
                    getPendingWritten(result.id),
                    listWrittenAssessments(result.id),
                ]);

                // Build a map of assessed items by question_id
                const assessedMap = {};
                assessed.forEach(a => { assessedMap[a.question_id] = a; });

                // All items = pending (ungraded) + assessed (already graded), no duplicates
                // pending already excludes assessed ones (server-side), so just concat
                const allItems = [
                    ...pending,
                    ...assessed.map(a => ({
                        question_id: a.question_id,
                        question_text: a.question_text || '(question)',
                        model_answer: a.model_answer || '',
                        keywords: a.keywords || [],
                        marks: a.max_marks,
                        student_answer: a.student_answer,
                    })),
                ];

                if (alive) {
                    setItems(allItems);
                    // Pre-fill done[] for assessed items (they appear after pending in allItems)
                    const preDone = assessed.map((a, ai) => ({
                        idx: pending.length + ai,
                        awarded: a.awarded_marks,
                        max: a.max_marks,
                        feedback: a.feedback || '',
                        verdict: a.assessed_by === 'admin-manual' ? 'admin-marked' : (a.verdict || ''),
                        strengths: a.strengths || [],
                        improvements: a.improvements || [],
                        sources: a.sources || [],
                    }));
                    setDone(preDone);
                    setLoaded(true);
                }
            } catch (e) {
                if (alive) { setError(e.message); setLoaded(true); }
            }
        };
        load();
        return () => { alive = false; };
    }, [result.id, getPendingWritten, listWrittenAssessments]);

    const gradeOneAI = async (item, idx) => {
        setBusyIdx(idx); setError('');
        try {
            let typedAnswer = item.student_answer || '';
            let studentImage = null;
            try {
                const parsed = JSON.parse(typedAnswer);
                if (parsed && typeof parsed === 'object' && ('text' in parsed || 'image' in parsed)) {
                    typedAnswer = parsed.text || '';
                    studentImage = parsed.image || null;
                }
            } catch (_) { /* plain text */ }

            const out = await assessWrittenAnswer({
                question: item.question_text,
                modelAnswer: item.model_answer,
                keywords: item.keywords || [],
                studentAnswer: typedAnswer,
                studentImage,
                maxMarks: Number(item.marks) || 5,
                useResearch: true,
            });
            await recordWrittenAssessment({
                resultId: result.id, questionId: item.question_id,
                studentAnswer: typedAnswer || (studentImage ? '[Handwritten answer image]' : ''),
                awarded: out.awarded, max: Number(item.marks) || 5,
                feedback: out.feedback, strengths: out.strengths,
                improvements: out.improvements, sources: out.sources,
            });
            setDone(d => {
                const filtered = d.filter(x => x.idx !== idx);
                return [...filtered, { ...out, idx, max: item.marks }];
            });
        } catch (e) { setError(e.message); }
        finally { setBusyIdx(-1); }
    };

    const gradeAllAI = async () => {
        const pending = items?.filter((item, i) => !done.some(d => d.idx === i)) || [];
        for (let i = 0; i < items.length; i++) {
            if (done.some(d => d.idx === i)) continue;
            await gradeOneAI(items[i], i);
        }
        await refresh();
        toast.success('AI marking complete. Scores updated.');
    };

    const saveManual = async (item, idx) => {
        const awarded = parseFloat(manualMark);
        if (isNaN(awarded) || awarded < 0 || awarded > Number(item.marks)) {
            setError(`নম্বর অবশ্যই 0 থেকে ${item.marks}-এর মধ্যে হতে হবে।`);
            return;
        }
        setBusyIdx(idx); setError('');
        try {
            let typedAnswer = item.student_answer || '';
            try {
                const parsed = JSON.parse(typedAnswer);
                if (parsed && typeof parsed === 'object') typedAnswer = parsed.text || '';
            } catch (_) {}

            await recordWrittenAssessment({
                resultId: result.id, questionId: item.question_id,
                studentAnswer: typedAnswer,
                awarded, max: Number(item.marks) || 5,
                feedback: manualFeedback || 'Admin-marked.',
                strengths: [], improvements: [], sources: [],
            });
            setDone(d => {
                const filtered = d.filter(x => x.idx !== idx);
                return [...filtered, { awarded, max: item.marks, feedback: manualFeedback, idx, verdict: 'admin-marked', strengths: [], improvements: [], sources: [] }];
            });
            setManualIdx(null); setManualMark(''); setManualFeedback('');
            toast.success('নম্বর সংরক্ষিত হয়েছে।');
        } catch (e) { setError(e.message); }
        finally { setBusyIdx(-1); }
    };

    const close = async () => { await refresh(); onClose(); };

    const pendingCount = (items || []).filter((_, i) => !done.some(d => d.idx === i)).length;

    return (
        <Modal open size="lg" onClose={close}
            title="লিখিত উত্তর মূল্যায়ন"
            subtitle={`${result.profiles?.full_name || 'Student'} · ${result.exam_title}`}
            footer={<>
                <Button variant="secondary" onClick={close}>বন্ধ করুন</Button>
                {isAIConfigured && pendingCount > 0 && (
                    <Button icon={Sparkles} onClick={gradeAllAI} loading={busyIdx >= 0}>
                        AI দিয়ে সব মূল্যায়ন করুন ({pendingCount})
                    </Button>
                )}
            </>}>

            {error && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{error}</Alert></div>}

            {!loaded ? <Loader text="লোড হচ্ছে…" />
                : !items?.length ? (
                    <Alert type="success" icon={CheckCircle2}>
                        এই পরীক্ষায় কোনো লিখিত প্রশ্ন নেই।
                    </Alert>
                ) : (
                    <>
                        <div className="mb-2">
                            <Alert type="info" icon={Sparkles}>
                                AI স্বয়ংক্রিয়ভাবে মূল্যায়ন করতে পারে, অথবা আপনি নিজে নম্বর দিতে পারেন — উভয় অপশনই আছে।
                            </Alert>
                        </div>

                        <div className="flex col gap-2">
                            {items.map((item, i) => {
                                const res = done.find(d => d.idx === i);
                                const busy = busyIdx === i;
                                const isManual = manualIdx === i;

                                // Parse student answer for display
                                let displayText = item.student_answer || '';
                                let imageData = null;
                                try {
                                    const parsed = JSON.parse(displayText);
                                    if (parsed && typeof parsed === 'object') {
                                        displayText = parsed.text || '';
                                        imageData = parsed.image || null;
                                    }
                                } catch (_) {}

                                return (
                                    <div key={item.question_id} className="card card-pad card-soft">
                                        <div className="flex between center gap-2 mb-2">
                                            <span className="f-14 fw-6 lh-15">{i + 1}. {item.question_text}</span>
                                            <span className="badge badge-gray" style={{ flexShrink: 0 }}>{item.marks} marks</span>
                                        </div>

                                        {/* Student's answer */}
                                        <div className="f-13 lh-15 mb-2" style={{ padding: '11px 13px', background: 'var(--surface)', borderRadius: 9, border: '1px solid var(--border)' }}>
                                            <div className="f-11 fw-7 text-sub mb-1">STUDENT'S ANSWER</div>
                                            {displayText
                                                ? <span style={{ whiteSpace: 'pre-wrap' }}>{displayText}</span>
                                                : !imageData && <span className="text-mute">Not answered</span>}
                                            {imageData && (
                                                <div className="mt-2">
                                                    <div className="f-11 fw-7 text-sub mb-1">HANDWRITTEN IMAGE</div>
                                                    <img
                                                        src={`data:${imageData.mimeType};base64,${imageData.data}`}
                                                        alt="Student handwritten answer"
                                                        style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)' }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Result (if marked) */}
                                        {res && (
                                            <div className="card card-pad mb-2" style={{ background: 'var(--success-l)', borderColor: 'var(--success)', padding: 13 }}>
                                                <div className="flex between center gap-2 mb-1">
                                                    <span className="f-12 fw-7" style={{ color: 'var(--success)' }}>
                                                        {res.verdict?.toUpperCase()}
                                                    </span>
                                                    <span className="f-15 fw-8" style={{ color: 'var(--success)' }}>
                                                        {res.awarded} / {res.max}
                                                    </span>
                                                </div>
                                                <div className="f-12 lh-15" style={{ color: 'var(--text)' }}>{res.feedback}</div>
                                                {res.sources?.length > 0 && (
                                                    <div className="flex col gap-1 mt-2">
                                                        {res.sources.map((s, j) => (
                                                            <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="f-11 flex center gap-1">
                                                                <ExternalLink size={10} /> {s.title || s.url}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Manual mark form */}
                                        {isManual && (
                                            <div className="card card-pad mb-2" style={{ background: 'var(--surface-2)', padding: 14 }}>
                                                <div className="f-12 fw-7 mb-2">ম্যানুয়াল নম্বর দিন (সর্বোচ্চ {item.marks})</div>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="number" min="0" max={item.marks} step="0.5"
                                                        className="input" style={{ width: 90 }}
                                                        placeholder="নম্বর"
                                                        value={manualMark}
                                                        onChange={e => setManualMark(e.target.value)}
                                                    />
                                                    <input
                                                        type="text" className="input" style={{ flex: 1 }}
                                                        placeholder="মন্তব্য (ঐচ্ছিক)"
                                                        value={manualFeedback}
                                                        onChange={e => setManualFeedback(e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={() => saveManual(item, i)} loading={busy}>সংরক্ষণ করুন</Button>
                                                    <Button size="sm" variant="secondary" onClick={() => { setManualIdx(null); setManualMark(''); setManualFeedback(''); }}>বাতিল</Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex gap-2">
                                            {isAIConfigured && (
                                                <Button size="sm" icon={busy ? Loader2 : Sparkles} loading={busy}
                                                    onClick={() => gradeOneAI(item, i)}>
                                                    {busy ? 'মূল্যায়ন হচ্ছে…' : res ? 'AI দিয়ে পুনরায়' : 'AI দিয়ে মূল্যায়ন'}
                                                </Button>
                                            )}
                                            <Button size="sm" variant="secondary" icon={Edit3}
                                                onClick={() => {
                                                    setManualIdx(isManual ? null : i);
                                                    setManualMark(res ? String(res.awarded) : '');
                                                    setManualFeedback(res ? (res.feedback || '') : '');
                                                }}>
                                                {isManual ? 'বাতিল' : res ? 'সম্পাদনা' : 'ম্যানুয়াল নম্বর'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
        </Modal>
    );
};
export default ResultsTab;
