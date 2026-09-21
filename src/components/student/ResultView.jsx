import React, { useState, useEffect, useMemo } from 'react';
import {
    Trophy, XCircle, CheckCircle2, Clock, Target, ArrowLeft, Eye, EyeOff,
    MinusCircle, PenLine, Hourglass, ExternalLink, Image,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { Button } from '../common/Button';
import { Alert } from '../common/Input';
import { Loader } from '../common/Loader';
import { RadialProgress, HBars, ChartCard } from '../common/Charts';

// Safe helper: extract display text from a written answer value
// (may be plain string OR {text, image} object stored in answers)
const getAnswerText = (val) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return val.text || '';
    return String(val);
};
const getAnswerImage = (val) => {
    if (val && typeof val === 'object' && val.image) return val.image;
    return null;
};
const isBlank = (val) => {
    if (val === undefined || val === null || val === '') return true;
    if (typeof val === 'object') return !val.text?.trim() && !val.image;
    return String(val).trim() === '';
};

export const ResultView = ({ result, resultId, onClose }) => {
    const { getResultReview } = useExam();
    const [data, setData] = useState(null);
    const [showReview, setShowReview] = useState(false);
    const [loading, setLoading] = useState(false);

    const id = resultId || result?.id;

    useEffect(() => {
        if (!showReview || data || !id) return;
        let alive = true;
        setLoading(true);
        getResultReview(id)
            .then(d => alive && setData(d))
            .catch(() => alive && setData({ questions: [], assessments: [] }))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [showReview, data, id, getResultReview]);

    const r = data?.result || result;

    const questions = useMemo(
        () => data?.questions || [],
        [data?.questions]
    );

    const assessments = data?.assessments || [];

    const answers = useMemo(
        () => r?.answers || {},
        [r?.answers]
    );

    const passed = r?.passed;
    const pct = Math.round(Number(r?.percentage) || 0);

    const tally = useMemo(() => {
        if (!questions.length) return null;
        let right = 0, wrong = 0, blank = 0;
        questions.forEach(q => {
            if (q.question_type === 'written') return;
            const a = answers[q.id];
            if (isBlank(a)) blank++;
            else if (a === q.correct_answer) right++;
            else wrong++;
        });
        return { right, wrong, blank };
    }, [questions, answers]);

    const bySubject = useMemo(() => {
        if (!questions.length) return [];
        const m = {};
        questions.forEach(q => {
            if (q.question_type === 'written') return;
            const c = q.subject || 'Other';
            if (!m[c]) m[c] = { right: 0, total: 0 };
            m[c].total++;
            if (answers[q.id] === q.correct_answer) m[c].right++;
        });
        return Object.entries(m)
            .map(([label, v]) => ({ label, value: Math.round((v.right / v.total) * 100), suffix: '%' }))
            .sort((a, b) => b.value - a.value);
    }, [questions, answers]);

    return (
        <div className="anim-up">
            <div className="card card-pad mb-3 text-center" style={{ padding: '36px 22px' }}>
                <div style={{
                    width: 70, height: 70, borderRadius: 22, margin: '0 auto 16px',
                    display: 'grid', placeItems: 'center',
                    background: passed ? 'var(--success-l)' : 'var(--danger-l)',
                    color: passed ? 'var(--success)' : 'var(--danger)',
                }}>
                    {passed ? <Trophy size={32} /> : <XCircle size={32} />}
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.035em' }}>
                    {passed ? 'Congratulations, you passed!' : 'Keep practising'}
                </h1>
                {r?.exam_title && <div className="f-14 text-sub mt-1">{r.exam_title}</div>}

                {r?.needs_grading && (
                    <div className="mt-2" style={{ maxWidth: 520, margin: '18px auto 0' }}>
                        <Alert type="info" icon={Hourglass}>
                            Your written answers are still being marked. The score below covers the MCQ part and will rise once grading finishes.
                        </Alert>
                    </div>
                )}

                <div className="flex center gap-4 wrap jcenter mt-3">
                    <RadialProgress value={pct} size={148} label="Score" />
                    <div className="flex col gap-2" style={{ minWidth: 200 }}>
                        {tally && <>
                            <Row icon={CheckCircle2} color="var(--success)" label="Correct" value={tally.right} />
                            <Row icon={XCircle} color="var(--danger)" label="Wrong" value={tally.wrong} />
                            <Row icon={MinusCircle} color="var(--text-mute)" label="Not answered" value={tally.blank} />
                        </>}
                        <Row icon={Target} color="var(--brand)" label="Marks"
                            value={`${r?.score ?? 0} / ${r?.total_marks ?? 0}`} />
                        {r?.time_taken != null && (
                            <Row icon={Clock} color="var(--accent)" label="Time taken"
                                value={`${Math.round(r.time_taken / 60)} min`} />
                        )}
                    </div>
                </div>
            </div>

            {bySubject.length > 1 && (
                <div className="mb-3">
                    <ChartCard title="Subject-wise Accuracy" sub="Where you did well and where to focus next">
                        <HBars data={bySubject} />
                    </ChartCard>
                </div>
            )}

            <div className="flex gap-2 wrap mb-3">
                <Button variant="secondary" icon={ArrowLeft} onClick={onClose}>Back</Button>
                <Button variant={showReview ? 'secondary' : 'primary'} icon={showReview ? EyeOff : Eye}
                    onClick={() => setShowReview(s => !s)}>
                    {showReview ? 'Hide Answer Review' : 'Review Answers'}
                </Button>
            </div>

            {showReview && (loading ? <Loader text="Loading your answers…" /> : (
                <div className="flex col gap-2">
                    {questions.map((q, i) => (
                        <ReviewCard key={q.id} q={q} index={i}
                            given={answers[q.id]}
                            assessment={assessments.find(a => a.question_id === q.id)} />
                    ))}
                </div>
            ))}
        </div>
    );
};

const ReviewCard = ({ q, index, given, assessment }) => {
    const written = q.question_type === 'written';
    const blank = isBlank(given);
    const answerText = getAnswerText(given);
    const answerImage = getAnswerImage(given);
    const ok = !written && !blank && given === q.correct_answer;

    const edge = written
        ? (assessment ? 'var(--warning)' : 'var(--text-mute)')
        : blank ? 'var(--text-mute)' : ok ? 'var(--success)' : 'var(--danger)';

    return (
        <div className="card card-pad" style={{ borderLeft: `3px solid ${edge}` }}>
            <div className="flex center gap-1 wrap mb-1">
                <span className="badge badge-gray">{q.subject}</span>
                {written ? (
                    assessment
                        ? <span className="badge badge-primary"><PenLine size={10} /> {assessment.awarded_marks} / {assessment.max_marks} marks</span>
                        : <span className="badge badge-warning"><Hourglass size={10} /> Awaiting marking</span>
                ) : (
                    <span className={`badge ${blank ? 'badge-gray' : ok ? 'badge-success' : 'badge-danger'}`}>
                        {blank ? 'Not answered' : ok ? 'Correct' : 'Wrong'}
                    </span>
                )}
            </div>

            <div className="f-15 fw-6 lh-15 mb-2">{index + 1}. {q.question_text}</div>

            {written ? (
                <>
                    <div className="f-13 lh-15 mb-2" style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div className="f-11 fw-7 text-sub mb-1">YOUR ANSWER</div>
                        {blank
                            ? <span className="text-mute">You did not answer this question.</span>
                            : <>
                                {answerText && <div style={{ whiteSpace: 'pre-wrap', marginBottom: answerImage ? 10 : 0 }}>{answerText}</div>}
                                {answerImage && (
                                    <div>
                                        <div className="f-11 fw-7 text-sub mb-1 mt-1" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Image size={11} /> HANDWRITTEN IMAGE
                                        </div>
                                        <img
                                            src={`data:${answerImage.mimeType || 'image/jpeg'};base64,${answerImage.data}`}
                                            alt="Your handwritten answer"
                                            style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
                                        />
                                    </div>
                                )}
                            </>
                        }
                    </div>

                    {assessment && (
                        <div className="card card-pad card-soft mb-2">
                            <div className="f-11 fw-7 text-sub mb-1">EXAMINER FEEDBACK</div>
                            <div className="f-13 lh-15">{assessment.feedback}</div>

                            {assessment.strengths?.length > 0 && (
                                <div className="mt-2">
                                    <div className="f-11 fw-7" style={{ color: 'var(--success)' }}>WHAT YOU GOT RIGHT</div>
                                    <ul className="f-12 lh-15" style={{ paddingLeft: 18, marginTop: 4 }}>
                                        {assessment.strengths.map((s, j) => <li key={j}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                            {assessment.improvements?.length > 0 && (
                                <div className="mt-2">
                                    <div className="f-11 fw-7" style={{ color: 'var(--warning)' }}>WHAT TO IMPROVE</div>
                                    <ul className="f-12 lh-15" style={{ paddingLeft: 18, marginTop: 4 }}>
                                        {assessment.improvements.map((s, j) => <li key={j}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                            {assessment.sources?.length > 0 && (
                                <div className="mt-2" style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                                    <div className="f-11 fw-7 text-sub mb-1">CHECKED AGAINST</div>
                                    <div className="flex col gap-1">
                                        {assessment.sources.map((s, j) => (
                                            <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                                                className="f-12 flex center gap-1">
                                                <ExternalLink size={11} /> {s.title || s.url}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {q.model_answer && (
                        <div className="f-13 lh-15" style={{ padding: '12px 14px', background: 'var(--success-l)', borderRadius: 10, color: 'var(--text)' }}>
                            <div className="f-11 fw-7 mb-1" style={{ color: 'var(--success)' }}>MODEL ANSWER</div>
                            {q.model_answer}
                        </div>
                    )}
                </>
            ) : (
                <div className="grid grid-2" style={{ gap: 8 }}>
                    {(q.options || []).map((o, j) => {
                        const isAns = o === q.correct_answer;
                        const isGiven = o === given;
                        let bg = 'var(--surface-2)', col = 'var(--text-sub)', bd = 'transparent';
                        if (isAns) { bg = 'var(--success-l)'; col = 'var(--success)'; bd = 'var(--success)'; }
                        else if (isGiven) { bg = 'var(--danger-l)'; col = 'var(--danger)'; bd = 'var(--danger)'; }
                        return (
                            <div key={j} className="f-13" style={{
                                padding: '8px 12px', borderRadius: 8, background: bg, color: col,
                                border: `1px solid ${bd}`, fontWeight: (isAns || isGiven) ? 700 : 500,
                            }}>
                                {String.fromCharCode(65 + j)}. {o}
                                {isAns && ' ✓'}
                                {isGiven && !isAns && ' ← your answer'}
                            </div>
                        );
                    })}
                </div>
            )}

            {q.explanation && !written && (
                <div className="f-12 text-sub lh-15 mt-2" style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <b style={{ color: 'var(--brand)' }}>Explanation:</b> {q.explanation}
                </div>
            )}
        </div>
    );
};

const Row = ({ icon: Icon, color, label, value }) => (
    <div className="flex center gap-2">
        <Icon size={17} style={{ color, flexShrink: 0 }} />
        <span className="f-13 text-sub fw-6">{label}</span>
        <span className="f-14 fw-8" style={{ marginLeft: 'auto', paddingLeft: 16 }}>{value}</span>
    </div>
);
export default ResultView;
