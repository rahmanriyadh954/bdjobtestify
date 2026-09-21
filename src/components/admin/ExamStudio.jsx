import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    Library, FileStack, Plus, Sparkles, Edit3, Trash2, CheckSquare, Square,
    Send, EyeOff, Clock, Award, X, Loader2, Upload, FileText, Image as ImageIcon,
    AlertCircle, PenLine, ListChecks, Wand2, FileSearch, Printer, Eye,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Input, Select, Textarea, Alert } from '../common/Input';
import { Modal } from '../common/Modal';
import { EmptyState, Loader } from '../common/Loader';
import { PageHead, SearchBox } from '../common/Card';
import { GovtExamPaper } from '../common/GovtExamPaper';
import {
    SUBJECT_CATEGORIES, DIFFICULTY_LEVELS, TOPIC_SUGGESTIONS,
    QUESTION_TYPES, AI_QUESTION_TYPES, AI_LANGUAGES, ALL_SUBJECTS_OPTION,
} from '../../utils/constants';
import {
    generateQuestions, generateQuestionsFromFiles, isAIConfigured,
    ACCEPTED_FILE_TYPES, MAX_FILE_MB,
} from '../../services/aiService';

const blank = () => ({
    question_type: 'mcq', question_text: '', options: ['', '', '', ''],
    correct_answer: '', model_answer: '', keywords: [], explanation: '',
    subject: SUBJECT_CATEGORIES[0], topic: '', difficulty: 'medium', marks: 1,
});

export const ExamStudio = () => {
    const [tab, setTab] = useState('bank');
    return (
        <div className="anim-up">
            <PageHead title="Exam Studio"
                sub="Build your question bank and assemble model tests — everything in one place." />
            <div className="tabs" role="tablist">
                <button role="tab" aria-selected={tab === 'bank'} className={`tab ${tab === 'bank' ? 'active' : ''}`} onClick={() => setTab('bank')}>
                    <Library size={15} /> Question Bank
                </button>
                <button role="tab" aria-selected={tab === 'tests'} className={`tab ${tab === 'tests' ? 'active' : ''}`} onClick={() => setTab('tests')}>
                    <FileStack size={15} /> Model Tests
                </button>
            </div>
            {tab === 'bank' ? <QuestionBank /> : <ModelTests />}
        </div>
    );
};

/* ════════════════════ QUESTION BANK ════════════════════ */
const QuestionBank = () => {
    const { questions, addQuestion, addMultipleQuestions, updateQuestion, removeQuestion, removeQuestions, loading } = useExam();
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [fSubject, setFSubject] = useState('all');
    const [fDiff, setFDiff] = useState('all');
    const [fType, setFType] = useState('all');
    const [selected, setSelected] = useState([]);
    const [editing, setEditing] = useState(null);
    const [aiOpen, setAiOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const filtered = useMemo(() => questions.filter(q => {
        const s = search.trim().toLowerCase();
        const okS = !s || q.question_text?.toLowerCase().includes(s) || q.topic?.toLowerCase().includes(s);
        return okS
            && (fSubject === 'all' || q.subject === fSubject)
            && (fDiff === 'all' || q.difficulty === fDiff)
            && (fType === 'all' || q.question_type === fType);
    }), [questions, search, fSubject, fDiff, fType]);

    const counts = useMemo(() => {
        const m = {};
        questions.forEach(q => { m[q.subject] = (m[q.subject] || 0) + 1; });
        return m;
    }, [questions]);

    const allSelected = filtered.length > 0 && filtered.every(q => selected.includes(q.id));

    const bulkDelete = async () => {
        if (!window.confirm(`Delete ${selected.length} question(s)? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await removeQuestions(selected);
            toast.success(`${selected.length} question(s) deleted.`);
            setSelected([]);
        } catch (e) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    const save = async (data) => {
        setBusy(true);
        try {
            if (data.id) { await updateQuestion(data.id, data); toast.success('Question updated.'); }
            else { await addQuestion(data); toast.success('Question added to the bank.'); }
            setEditing(null);
        } catch (e) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    const saveBatch = async (arr) => {
        setBusy(true);
        try {
            await addMultipleQuestions(arr);
            toast.success(`${arr.length} question(s) added to the bank.`);
            setAiOpen(false);
        } catch (e) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    if (loading && !questions.length) return <Loader text="Loading your question bank…" full />;

    return (
        <>
            <div className="flex between center wrap gap-2 mb-2 toolbar-row">
                <div className="flex center gap-2 wrap grow">
                    <SearchBox value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…" />
                    <select className="select" style={{ width: 'auto', minWidth: 160 }} value={fSubject} onChange={e => setFSubject(e.target.value)} aria-label="Filter by subject">
                        <option value="all">All Subjects ({questions.length})</option>
                        {SUBJECT_CATEGORIES.map(c => <option key={c} value={c}>{c} ({counts[c] || 0})</option>)}
                    </select>
                    <select className="select" style={{ width: 'auto', minWidth: 118 }} value={fType} onChange={e => setFType(e.target.value)} aria-label="Filter by type">
                        <option value="all">All Types</option>
                        {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select className="select" style={{ width: 'auto', minWidth: 118 }} value={fDiff} onChange={e => setFDiff(e.target.value)} aria-label="Filter by difficulty">
                        <option value="all">All Levels</option>
                        {DIFFICULTY_LEVELS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                </div>
                <div className="flex gap-2 wrap toolbar-actions">
                    {selected.length > 0 && (
                        <Button variant="danger" icon={Trash2} onClick={bulkDelete} loading={busy}>
                            Delete ({selected.length})
                        </Button>
                    )}
                    <Button variant="secondary" icon={Sparkles} onClick={() => setAiOpen(true)}>AI Generate</Button>
                    <Button icon={Plus} onClick={() => setEditing(blank())}>Add Question</Button>
                </div>
            </div>

            {filtered.length > 0 && (
                <div className="flex center gap-2 mb-2">
                    <button className="flex center gap-1 f-12 text-sub fw-6"
                        onClick={() => setSelected(allSelected ? [] : filtered.map(q => q.id))}>
                        {allSelected ? <CheckSquare size={16} style={{ color: 'var(--brand)' }} /> : <Square size={16} />}
                        Select all ({filtered.length})
                    </button>
                </div>
            )}

            {filtered.length === 0 ? (
                <EmptyState icon={Library} title="No questions found"
                    text={questions.length === 0
                        ? 'Start by adding a question yourself, generating a set with AI, or uploading a PDF or photo to turn into questions.'
                        : 'Nothing matches these filters. Try widening them.'}
                    action={questions.length === 0 && (
                        <div className="flex gap-2 wrap jcenter">
                            <Button icon={Plus} onClick={() => setEditing(blank())}>Add Question</Button>
                            <Button variant="secondary" icon={Sparkles} onClick={() => setAiOpen(true)}>AI Generate</Button>
                        </div>
                    )} />
            ) : (
                <div className="flex col gap-2">
                    {filtered.map((q, i) => (
                        <QuestionRow key={q.id} q={q} index={i}
                            selected={selected.includes(q.id)}
                            onToggle={() => setSelected(s => s.includes(q.id) ? s.filter(x => x !== q.id) : [...s, q.id])}
                            onEdit={() => setEditing(q)}
                            onDelete={async () => {
                                if (!window.confirm('Delete this question?')) return;
                                try { await removeQuestion(q.id); toast.success('Question deleted.'); }
                                catch (e) { toast.error(e.message); }
                            }} />
                    ))}
                </div>
            )}

            {editing && <QuestionEditor data={editing} busy={busy} onSave={save} onClose={() => setEditing(null)} />}
            {aiOpen && <AIPanel busy={busy} onClose={() => setAiOpen(false)} onSave={saveBatch} />}
        </>
    );
};

const QuestionRow = ({ q, index, selected, onToggle, onEdit, onDelete }) => {
    const written = q.question_type === 'written';
    return (
        <div className="card card-pad card-hover" style={{ borderColor: selected ? 'var(--brand)' : undefined }}>
            <div className="flex gap-2" style={{ alignItems: 'flex-start' }}>
                <button onClick={onToggle} style={{ marginTop: 3, color: selected ? 'var(--brand)' : 'var(--text-mute)' }}
                    aria-label={selected ? 'Deselect' : 'Select'}>
                    {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                <div className="grow">
                    <div className="flex center gap-1 wrap mb-1">
                        <span className={`badge ${written ? 'badge-warning' : 'badge-primary'}`}>
                            {written ? <PenLine size={10} /> : <ListChecks size={10} />}
                            {written ? 'Written' : 'MCQ'}
                        </span>
                        <span className="badge badge-gray">{q.subject}</span>
                        {q.topic && <span className="badge badge-gray">{q.topic}</span>}
                        <span className={`badge ${q.difficulty === 'hard' ? 'badge-danger' : q.difficulty === 'easy' ? 'badge-success' : 'badge-warning'}`}>
                            {q.difficulty}
                        </span>
                        <span className="badge badge-gray">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                        {q.source !== 'manual' && (
                            <span className="badge badge-gray">
                                {q.source === 'ai-file' ? <Upload size={9} /> : <Sparkles size={9} />}
                                {q.source === 'ai-file' ? 'From file' : 'AI'}
                            </span>
                        )}
                    </div>

                    <div className="f-15 fw-6 lh-15 mb-2">{index + 1}. {q.question_text}</div>

                    {written ? (
                        <>
                            {q.model_answer && (
                                <div className="f-13 text-sub lh-15" style={{ padding: '10px 13px', background: 'var(--surface-2)', borderRadius: 9 }}>
                                    <b style={{ color: 'var(--text)' }}>Model answer:</b> {q.model_answer}
                                </div>
                            )}
                            {q.keywords?.length > 0 && (
                                <div className="flex gap-1 wrap mt-1">
                                    {q.keywords.map((k, j) => <span key={j} className="badge badge-gray">{k}</span>)}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="grid grid-2" style={{ gap: 8 }}>
                            {q.options?.map((opt, i) => {
                                const right = opt === q.correct_answer;
                                return (
                                    <div key={i} className="f-13" style={{
                                        padding: '8px 12px', borderRadius: 8,
                                        background: right ? 'var(--success-l)' : 'var(--surface-2)',
                                        color: right ? 'var(--success)' : 'var(--text-sub)',
                                        fontWeight: right ? 700 : 500,
                                        border: `1px solid ${right ? 'var(--success)' : 'transparent'}`,
                                    }}>
                                        {String.fromCharCode(65 + i)}. {opt}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {q.explanation && (
                        <div className="f-12 text-sub lh-15 mt-2" style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                            <b style={{ color: 'var(--brand)' }}>Explanation:</b> {q.explanation}
                        </div>
                    )}
                </div>

                <div className="flex gap-1" style={{ flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} aria-label="Edit"><Edit3 size={16} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} aria-label="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════ QUESTION EDITOR ════════════════════ */
const QuestionEditor = ({ data, busy, onSave, onClose }) => {
    const [f, setF] = useState({ ...blank(), ...data, options: [...(data.options?.length ? data.options : ['', '', '', ''])] });
    const [err, setErr] = useState('');
    const written = f.question_type === 'written';

    const setOpt = (i, v) => {
        const opts = [...f.options];
        const old = opts[i];
        opts[i] = v;
        setF({ ...f, options: opts, correct_answer: f.correct_answer === old ? v : f.correct_answer });
    };

    const submit = () => {
        if (!f.question_text.trim()) return setErr('Please write the question.');
        if (written) {
            if (!f.model_answer?.trim()) return setErr('A model answer is required so the AI can grade fairly.');
        } else {
            if (f.options.some(o => !o.trim())) return setErr('All four options must be filled in.');
            if (new Set(f.options.map(o => o.trim())).size !== 4) return setErr('The four options must all be different.');
            if (!f.correct_answer) return setErr('Please mark which option is the correct answer.');
        }
        onSave({ ...f, marks: Number(f.marks) || 1 });
    };

    const topics = TOPIC_SUGGESTIONS[f.subject] || [];

    return (
        <Modal open size="lg" onClose={onClose}
            title={data.id ? 'Edit Question' : 'Add New Question'}
            subtitle="Type freely — quotes, symbols and Bangla text are all kept exactly as you write them."
            footer={<>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={submit} loading={busy}>{data.id ? 'Save Changes' : 'Add to Bank'}</Button>
            </>}>
            {err && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{err}</Alert></div>}

            <Select label="Question Type" value={f.question_type}
                onChange={e => setF({ ...f, question_type: e.target.value, marks: e.target.value === 'written' ? 5 : 1 })}
                options={QUESTION_TYPES}
                hint={written
                    ? 'Students type an answer. The AI grades it against your model answer, checking facts online.'
                    : 'Students pick one of four options. Graded instantly on the server.'} />

            <Textarea label="Question" rows={3} placeholder="Type the full question here…"
                value={f.question_text} onChange={e => setF({ ...f, question_text: e.target.value })} />

            {written ? (
                <>
                    <Textarea label="Model Answer" rows={4}
                        placeholder="Write the ideal answer. The AI compares the student's answer against this."
                        value={f.model_answer} onChange={e => setF({ ...f, model_answer: e.target.value })} />
                    <Input label="Key Points" optional
                        placeholder="Separate with commas: causes, dates, impact"
                        value={(f.keywords || []).join(', ')}
                        onChange={e => setF({ ...f, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        hint="Points the answer should mention. Helps the AI award partial marks fairly." />
                </>
            ) : (
                <>
                    <label className="label">Options <span className="label-optional">click a circle to mark the correct answer</span></label>
                    <div className="flex col gap-2 mb-2">
                        {f.options.map((opt, i) => {
                            const right = opt.trim() && opt === f.correct_answer;
                            return (
                                <div key={i} className="flex center gap-2">
                                    <button type="button" onClick={() => opt.trim() && setF({ ...f, correct_answer: opt })}
                                        title="Mark as the correct answer" aria-label={`Mark option ${String.fromCharCode(65 + i)} correct`}
                                        style={{
                                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                                            border: `2px solid ${right ? 'var(--success)' : 'var(--border-2)'}`,
                                            background: right ? 'var(--success)' : 'transparent',
                                            color: '#fff', display: 'grid', placeItems: 'center',
                                            fontSize: 12, fontWeight: 800,
                                        }}>{right ? '✓' : ''}</button>
                                    <span className="f-12 fw-7 text-mute" style={{ width: 13 }}>{String.fromCharCode(65 + i)}</span>
                                    <input className="input" placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                        value={opt} onChange={e => setOpt(i, e.target.value)}
                                        style={{ borderColor: right ? 'var(--success)' : undefined }} />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <div className="grid grid-2">
                <Select label="Subject" value={f.subject}
                    onChange={e => setF({ ...f, subject: e.target.value, topic: '' })}
                    options={SUBJECT_CATEGORIES} />
                <div className="field">
                    <label className="label">Topic <span className="label-optional">optional</span></label>
                    <input className="input" list="qe-topics" placeholder="e.g. Grammar"
                        value={f.topic || ''} onChange={e => setF({ ...f, topic: e.target.value })} />
                    <datalist id="qe-topics">{topics.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                <Select label="Difficulty" value={f.difficulty}
                    onChange={e => setF({ ...f, difficulty: e.target.value })} options={DIFFICULTY_LEVELS} />
                <Input label="Marks" type="number" min="1" max="100" step="0.5" value={f.marks}
                    onChange={e => setF({ ...f, marks: e.target.value })} />
            </div>

            <Textarea label="Explanation" optional rows={2}
                placeholder="Why is this the correct answer? Students see this when reviewing."
                value={f.explanation} onChange={e => setF({ ...f, explanation: e.target.value })} />
        </Modal>
    );
};

/* ════════════════════ AI PANEL (topic + file) ════════════════════ */
const AIPanel = ({ busy, onClose, onSave }) => {
    const [cfg, setCfg] = useState({
        subject: SUBJECT_CATEGORIES[0], topic: '', count: 10,
        difficulty: 'medium', questionType: 'mcq', language: 'auto',
        customInstructions: '',
    });
    const [files, setFiles] = useState([]);
    const [drag, setDrag] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [preview, setPreview] = useState(null);
    const inputRef = useRef(null);

    const topics = TOPIC_SUGGESTIONS[cfg.subject] || [];

    const addFiles = useCallback((list) => {
        setErr('');
        const incoming = Array.from(list || []);
        const good = [];
        for (const f of incoming) {
            if (!ACCEPTED_FILE_TYPES.includes(f.type)) { setErr(`"${f.name}" is not a PDF or image.`); continue; }
            if (f.size > MAX_FILE_MB * 1024 * 1024) { setErr(`"${f.name}" is bigger than ${MAX_FILE_MB} MB.`); continue; }
            good.push(f);
        }
        setFiles(prev => [...prev, ...good].slice(0, 5));
    }, []);

    const generate = async () => {
        setErr(''); setLoading(true);
        try {
            const out = files.length > 0
                ? await generateQuestionsFromFiles(files, cfg)
                : await generateQuestions(cfg);
            setPreview(out);
        } catch (e) { setErr(e.message); }
        finally { setLoading(false); }
    };

    if (!isAIConfigured) {
        return (
            <Modal open onClose={onClose} title="AI is not configured"
                footer={<Button onClick={onClose}>Close</Button>}>
                <Alert type="warning" icon={AlertCircle}>
                    Add your Gemini API key as <b>REACT_APP_GEMINI_API_KEY</b> in the <b>.env</b> file, then restart the app.
                </Alert>
                <div className="hint mt-2">You can get a free key at aistudio.google.com/apikey</div>
            </Modal>
        );
    }

    // ── Preview step ──
    if (preview) {
        return (
            <Modal open size="lg" onClose={onClose}
                title={`${preview.length} question${preview.length !== 1 ? 's' : ''} ready`}
                subtitle={`${cfg.subject}${cfg.topic ? ` — ${cfg.topic}` : ''} · ${cfg.difficulty} · review before saving`}
                footer={<>
                    <Button variant="secondary" onClick={() => setPreview(null)}>Back</Button>
                    <Button icon={Plus} onClick={() => onSave(preview)} loading={busy} disabled={!preview.length}>
                        Add {preview.length} to Bank
                    </Button>
                </>}>
                <div className="flex col gap-2">
                    {preview.map((q, i) => (
                        <div key={i} className="card card-pad card-soft">
                            <div className="flex between gap-2 mb-1" style={{ alignItems: 'flex-start' }}>
                                <span className="f-14 fw-6 lh-15">{i + 1}. {q.question_text}</span>
                                <button onClick={() => setPreview(preview.filter((_, x) => x !== i))}
                                    style={{ color: 'var(--danger)', flexShrink: 0 }} aria-label="Remove"><X size={16} /></button>
                            </div>
                            {q.question_type === 'written' ? (
                                <div className="f-12 text-sub lh-15">
                                    <b>Model answer:</b> {q.model_answer}
                                </div>
                            ) : (
                                <div className="grid grid-2" style={{ gap: 6 }}>
                                    {q.options.map((o, j) => (
                                        <div key={j} className="f-12" style={{
                                            padding: '6px 10px', borderRadius: 7,
                                            background: o === q.correct_answer ? 'var(--success-l)' : 'var(--surface)',
                                            color: o === q.correct_answer ? 'var(--success)' : 'var(--text-sub)',
                                            fontWeight: o === q.correct_answer ? 700 : 500,
                                        }}>{String.fromCharCode(65 + j)}. {o}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="hint mt-2">Anything you keep can still be edited afterwards from the bank.</div>
            </Modal>
        );
    }

    // ── Setup step ──
    return (
        <Modal open size="md" onClose={onClose}
            title="Generate Questions with AI"
            subtitle={files.length > 0
                ? 'The AI will use your uploaded material and follow the subject, topic, question type, count, difficulty and language settings below.'
                : 'Set the subject, topic, question type, count, difficulty and language. You can also upload a PDF or photo as the source.'}
            footer={<>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button icon={loading ? Loader2 : Wand2} onClick={generate} loading={loading}>
                    {loading ? 'Generating…' : 'Generate'}
                </Button>
            </>}>
            {err && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{err}</Alert></div>}

            <Textarea label="Custom Instructions for AI" optional rows={2}
                placeholder="e.g. Focus on Bangladesh Studies and Science topics. Keep the wording simple."
                value={cfg.customInstructions}
                onChange={e => setCfg({ ...cfg, customInstructions: e.target.value })}
                hint="Anything you write here is followed on top of the settings below." />

            <div className="field">
                <label className="label">Study Material <span className="label-optional">optional — upload a PDF or photo to generate from it</span></label>
                <div className={`dropzone ${drag ? 'drag' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
                    <Upload size={26} style={{ color: 'var(--brand)', marginBottom: 10 }} />
                    <div className="f-14 fw-6">Click to choose, or drag files here</div>
                    <div className="hint" style={{ marginTop: 5 }}>
                        PDF, PNG, JPG or WEBP · up to {MAX_FILE_MB} MB each · 5 files max
                    </div>
                    <input ref={inputRef} type="file" multiple hidden
                        accept={ACCEPTED_FILE_TYPES.join(',')}
                        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
                </div>

                {files.length > 0 && (
                    <div className="flex col gap-1 mt-2">
                        {files.map((f, i) => (
                            <div key={i} className="file-chip">
                                {f.type === 'application/pdf'
                                    ? <FileText size={17} style={{ color: 'var(--danger)' }} />
                                    : <ImageIcon size={17} style={{ color: 'var(--accent)' }} />}
                                <span className="grow truncate">{f.name}</span>
                                <span className="f-11 text-mute">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                                <button onClick={() => setFiles(files.filter((_, x) => x !== i))}
                                    style={{ color: 'var(--danger)' }} aria-label="Remove file"><X size={15} /></button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="hint">Scanned pages, book photos and handwritten notes all work. If files are attached, AI will generate from those files while following the settings below.</div>
            </div>

            <Select label="Subject" value={cfg.subject}
                onChange={e => setCfg({ ...cfg, subject: e.target.value, topic: '' })}
                hint={cfg.subject === ALL_SUBJECTS_OPTION
                    ? 'The AI will pick a natural mix of subjects for each question.'
                    : 'Every generated question is filed under this subject automatically.'}>
                <option value={ALL_SUBJECTS_OPTION}>{ALL_SUBJECTS_OPTION}</option>
                {SUBJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>

            <div className="field">
                <label className="label">Topic <span className="label-optional">optional</span></label>
                <input className="input" list="ai-topics"
                    placeholder={files.length > 0 ? 'Leave blank to follow the uploaded material' : 'e.g. Tense, Liberation War'}
                    value={cfg.topic} onChange={e => setCfg({ ...cfg, topic: e.target.value })} />
                <datalist id="ai-topics">{topics.map(t => <option key={t} value={t} />)}</datalist>
                {topics.length > 0 && (
                    <div className="flex gap-1 wrap mt-1">
                        {topics.slice(0, 6).map(t => (
                            <button key={t} type="button" className="badge badge-gray"
                                style={{ cursor: 'pointer' }} onClick={() => setCfg({ ...cfg, topic: t })}>{t}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-2">
                <Select label="Question Type" value={cfg.questionType}
                    onChange={e => setCfg({ ...cfg, questionType: e.target.value })} options={AI_QUESTION_TYPES} />
                <Input label="How many?" type="number" min="1" max="20" value={cfg.count}
                    onChange={e => setCfg({ ...cfg, count: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })}
                    hint="Up to 20 at a time" />
                <Select label="Difficulty" value={cfg.difficulty}
                    onChange={e => setCfg({ ...cfg, difficulty: e.target.value })} options={DIFFICULTY_LEVELS} />
                <Select label="Language" value={cfg.language}
                    onChange={e => setCfg({ ...cfg, language: e.target.value })} options={AI_LANGUAGES} />
            </div>

            {loading && (
                <Alert type="info" icon={Loader2}>
                    {files.length > 0 ? 'Reading your file and writing questions…' : 'Writing your questions…'} This can take up to a minute.
                </Alert>
            )}
        </Modal>
    );
};

/* ════════════════════ MODEL TESTS ════════════════════ */
const ModelTests = () => {
    const { modelTests, questions, createModelTest, updateModelTest, removeModelTest, publishTest, unpublishTest } = useExam();
    const toast = useToast();
    const [builder, setBuilder] = useState(null);
    const [previewTest, setPreviewTest] = useState(null);
    const [busy, setBusy] = useState(false);

    const wrap = async (fn, msg) => {
        setBusy(true);
        try { await fn(); if (msg) toast.success(msg); }
        catch (e) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    return (
        <>
            <div className="flex between center wrap gap-2 mb-2">
                <div className="f-13 text-sub">
                    {modelTests.length} model test{modelTests.length !== 1 ? 's' : ''} · {questions.length} question{questions.length !== 1 ? 's' : ''} in the bank
                </div>
                <Button icon={Plus} onClick={() => setBuilder({})} disabled={!questions.length}>
                    Create Model Test
                </Button>
            </div>

            {!questions.length ? (
                <EmptyState icon={Library} title="Your question bank is empty"
                    text="Add or generate some questions in the Question Bank tab first, then come back here to build a test." />
            ) : !modelTests.length ? (
                <EmptyState icon={FileStack} title="No model tests yet"
                    text="Pick questions from your bank, give the set a name, and publish it for students."
                    action={<Button icon={Plus} onClick={() => setBuilder({})}>Create Model Test</Button>} />
            ) : (
                <div className="grid grid-2">
                    {modelTests.map(t => (
                        <TestCard key={t.id} test={t} busy={busy}
                            onPreview={() => setPreviewTest(t)}
                            onEdit={() => setBuilder(t)}
                            onPublish={() => wrap(() => publishTest(t.id), `"${t.title}" is now live for students.`)}
                            onUnpublish={() => wrap(() => unpublishTest(t.id), `"${t.title}" removed from student view.`)}
                            onDelete={() => {
                                if (!window.confirm(`Delete "${t.title}"? The questions stay in your bank.`)) return;
                                wrap(() => removeModelTest(t.id), 'Model test deleted.');
                            }} />
                    ))}
                </div>
            )}

            {builder && <TestBuilder test={builder} busy={busy} onClose={() => setBuilder(null)}
                onSave={(data) => wrap(async () => {
                    if (builder.id) await updateModelTest(builder.id, data);
                    else await createModelTest(data);
                    setBuilder(null);
                }, builder.id ? 'Model test updated.' : 'Model test created.')} />}

            {previewTest && <PaperPreview test={previewTest} onClose={() => setPreviewTest(null)} />}
        </>
    );
};

/* ════════════════════ PAPER PREVIEW ════════════════════ */
const PaperPreview = ({ test, onClose }) => {
    const { questions } = useExam();
    const [showAnswers, setShowAnswers] = useState(false);

    const paperQuestions = useMemo(
        () => (test.questionIds || [])
            .map(id => questions.find(q => q.id === id))
            .filter(Boolean),
        [test.questionIds, questions]);

    const allMcq = paperQuestions.length > 0 && paperQuestions.every(q => (q.question_type || 'mcq') === 'mcq');

    const print = () => {
        const node = document.getElementById('gp-print-area');
        if (!node) return;
        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) return;
        w.document.write(
            '<html><head><title>' + test.title + '</title>' +
            '<meta charset="utf-8">' +
            '<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">' +
            '</head><body style="margin:0;padding:24px;background:#fff">' +
            node.innerHTML + '</body></html>');
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 600);
    };

    return (
        <Modal open size="lg" onClose={onClose}
            title="Question Paper Preview"
            subtitle={`${paperQuestions.length} question${paperQuestions.length !== 1 ? 's' : ''} · ${allMcq ? 'two-column layout (all MCQ)' : 'single-column layout (written or mixed)'}`}
            footer={<>
                <Button variant="secondary" icon={showAnswers ? EyeOff : Eye}
                    onClick={() => setShowAnswers(a => !a)}>
                    {showAnswers ? 'Hide answers' : 'Show answers'}
                </Button>
                <Button variant="secondary" onClick={onClose}>Close</Button>
                <Button icon={Printer} onClick={print}>Print / Save PDF</Button>
            </>}>
            <div id="gp-print-area">
                <GovtExamPaper
                    title={test.title}
                    subtitle={test.description}
                    timeLimit={test.time_limit}
                    instructions={test.instructions}
                    questions={paperQuestions}
                    showAnswers={showAnswers}
                />
            </div>
        </Modal>
    );
};

const TestCard = ({ test, busy, onPreview, onEdit, onPublish, onUnpublish, onDelete }) => {
    const live = test.status === 'published';
    const n = test.questionIds?.length || 0;
    return (
        <div className="card card-pad card-hover">
            <div className="flex between center gap-2 mb-2">
                <span className={`badge ${live ? 'badge-success' : 'badge-gray'}`}>{live ? '● Live' : '○ Draft'}</span>
                <div className="flex gap-1">
                    <Button variant="secondary" size="sm" icon={FileSearch} onClick={onPreview} disabled={!n}>
                        Preview
                    </Button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} aria-label="Edit"><Edit3 size={15} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} aria-label="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
                </div>
            </div>

            <div className="f-15 fw-7 mb-1" style={{ letterSpacing: '-.02em' }}>{test.title}</div>
            {test.description && <div className="f-13 text-sub lh-15 mb-2">{test.description}</div>}

            <div className="flex gap-3 wrap f-12 text-sub mb-2">
                <span className="flex center gap-1"><Library size={14} /> {n} question{n !== 1 ? 's' : ''}</span>
                <span className="flex center gap-1"><Clock size={14} /> {test.time_limit} min</span>
                <span className="flex center gap-1"><Award size={14} /> Pass {test.pass_marks}%</span>
            </div>

            {test.negative_marking && (
                <div className="mb-2"><span className="badge badge-warning">Negative marking −{test.negative_value}</span></div>
            )}

            <Button block variant={live ? 'secondary' : 'primary'} icon={live ? EyeOff : Send}
                onClick={live ? onUnpublish : onPublish} disabled={busy || !n}>
                {live ? 'Unpublish' : 'Publish to Students'}
            </Button>
        </div>
    );
};

/* ════════════════════ TEST BUILDER ════════════════════ */
const TestBuilder = ({ test, busy, onClose, onSave }) => {
    const { questions } = useExam();
    const [step, setStep] = useState(1);
    const [f, setF] = useState({
        title: test.title || '', description: test.description || '',
        time_limit: test.time_limit ?? 30, pass_marks: test.pass_marks ?? 40,
        negative_marking: test.negative_marking ?? false, negative_value: test.negative_value ?? 0.25,
        instructions: test.instructions || '', questionIds: test.questionIds || [],
    });
    const [pickSubject, setPickSubject] = useState('all');
    const [pickSearch, setPickSearch] = useState('');
    const [err, setErr] = useState('');

    const available = useMemo(() => questions.filter(q => {
        const s = pickSearch.trim().toLowerCase();
        return (pickSubject === 'all' || q.subject === pickSubject)
            && (!s || q.question_text?.toLowerCase().includes(s));
    }), [questions, pickSubject, pickSearch]);

    const totalMarks = useMemo(() =>
        f.questionIds.reduce((sum, id) => sum + (Number(questions.find(q => q.id === id)?.marks) || 0), 0),
        [f.questionIds, questions]);

    const submit = () => {
        if (!f.title.trim()) { setStep(1); return setErr('Please give this model test a name.'); }
        if (!f.questionIds.length) { setStep(2); return setErr('Select at least one question.'); }
        onSave(f);
    };

    return (
        <Modal open size="lg" onClose={onClose}
            title={test.id ? 'Edit Model Test' : 'Create Model Test'}
            subtitle={`Step ${step} of 2 — ${step === 1 ? 'settings' : 'choose questions'}`}
            footer={<>
                {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>}
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                {step === 1
                    ? <Button onClick={() => { setErr(''); setStep(2); }}>Next: Choose Questions</Button>
                    : <Button onClick={submit} loading={busy}>
                        {test.id ? 'Save Changes' : 'Create Test'} ({f.questionIds.length})
                      </Button>}
            </>}>
            {err && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{err}</Alert></div>}

            {step === 1 ? (
                <>
                    <Input label="Model Test Name" placeholder="e.g. BCS Preliminary Model Test 01"
                        value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
                    <Textarea label="Description" optional rows={2} placeholder="A short line students will see"
                        value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
                    <div className="grid grid-2">
                        <Input label="Time Limit (minutes)" type="number" min="1" max="360" value={f.time_limit}
                            onChange={e => setF({ ...f, time_limit: parseInt(e.target.value) || 30 })} />
                        <Input label="Pass Marks (%)" type="number" min="1" max="100" value={f.pass_marks}
                            onChange={e => setF({ ...f, pass_marks: parseInt(e.target.value) || 40 })} />
                    </div>

                    <div className="field">
                        <label className="checkbox-row">
                            <input type="checkbox" checked={f.negative_marking}
                                onChange={e => setF({ ...f, negative_marking: e.target.checked })} />
                            <div>
                                <div className="f-14 fw-6">Enable negative marking</div>
                                <div className="hint" style={{ marginTop: 2 }}>Marks are deducted for each wrong MCQ answer. Unanswered questions are never penalised.</div>
                            </div>
                        </label>
                        {f.negative_marking && (
                            <div className="mt-2">
                                <Input label="Deduct per wrong answer" type="number" step="0.25" min="0" max="2"
                                    value={f.negative_value}
                                    onChange={e => setF({ ...f, negative_value: parseFloat(e.target.value) || 0.25 })} />
                            </div>
                        )}
                    </div>

                    <Textarea label="Instructions for students" optional rows={2}
                        placeholder="e.g. Read each question carefully. You cannot change answers after submitting."
                        value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} />
                </>
            ) : (
                <>
                    <div className="flex gap-2 wrap mb-2">
                        <SearchBox value={pickSearch} onChange={e => setPickSearch(e.target.value)} placeholder="Search…" width={260} />
                        <select className="select" style={{ width: 'auto', minWidth: 150 }}
                            value={pickSubject} onChange={e => setPickSubject(e.target.value)} aria-label="Filter by subject">
                            <option value="all">All Subjects</option>
                            {SUBJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex between center wrap gap-2 f-12 mb-2">
                        <span className="text-sub">
                            <b style={{ color: 'var(--brand)' }}>{f.questionIds.length}</b> selected · <b>{totalMarks}</b> total marks
                        </span>
                        <div className="flex gap-2">
                            <button className="fw-6" style={{ color: 'var(--brand)' }}
                                onClick={() => setF({ ...f, questionIds: [...new Set([...f.questionIds, ...available.map(q => q.id)])] })}>
                                Select all shown
                            </button>
                            {f.questionIds.length > 0 && (
                                <button className="fw-6 text-sub" onClick={() => setF({ ...f, questionIds: [] })}>Clear</button>
                            )}
                        </div>
                    </div>

                    <div className="flex col gap-1" style={{ maxHeight: 420, overflowY: 'auto' }}>
                        {!available.length ? (
                            <div className="empty f-13">No questions match this filter.</div>
                        ) : available.map(q => {
                            const on = f.questionIds.includes(q.id);
                            return (
                                <button key={q.id} className={`opt-btn ${on ? 'on' : ''}`}
                                    style={{ alignItems: 'flex-start', padding: 12 }}
                                    onClick={() => setF({
                                        ...f, questionIds: on ? f.questionIds.filter(x => x !== q.id) : [...f.questionIds, q.id],
                                    })}>
                                    {on ? <CheckSquare size={17} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }} />
                                        : <Square size={17} style={{ color: 'var(--text-mute)', flexShrink: 0, marginTop: 2 }} />}
                                    <div style={{ minWidth: 0 }}>
                                        <div className="f-13 fw-6 lh-15">{q.question_text}</div>
                                        <div className="flex gap-1 wrap mt-1">
                                            <span className="badge badge-gray">{q.question_type === 'written' ? 'Written' : 'MCQ'}</span>
                                            <span className="badge badge-gray">{q.subject}</span>
                                            <span className="badge badge-gray">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </Modal>
    );
};

export default ExamStudio;
