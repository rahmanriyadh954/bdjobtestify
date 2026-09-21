import React, { useMemo } from 'react';

// Subject display order: বাংলা → English → Mathematics → GK & Science
const SUBJECT_ORDER = [
    'Bangla',
    'English',
    'Mathematics',
    'General Knowledge (Bangladesh)',
    'General Knowledge (International)',
    'General Science',
    'ICT / Computer',
    'Mental Ability',
    'Geography & Environment',
    'History',
    'Constitution & Civics',
    'Current Affairs',
];

const subjectRank = (name) => {
    const idx = SUBJECT_ORDER.indexOf(name);
    return idx >= 0 ? idx : 999;
};

// Real Bangladesh government emblem (public domain govt seal)
const BD_EMBLEM_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Emblem_of_Bangladesh.svg/240px-Emblem_of_Bangladesh.svg.png';

export const GovtExamPaper = ({
    title, subtitle, code, instructions, questions = [], timeLimit, totalMarks,
    subjects, showAnswers = false, emblemSrc,
    interactive = false, answers = {}, onSelectAnswer, onWrittenAnswer,
}) => {
    const marks = totalMarks ?? questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    const subjectLine = subjects || [...new Set(questions.map(q => q.subject).filter(Boolean))].join(', ') || '—';

    const groups = useMemo(() => {
        const map = new Map();
        questions.forEach((q, index) => {
            const key = q.subject?.trim() || 'সাধারণ';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push({ ...q, _paperIndex: index });
        });
        return [...map.entries()]
            .sort(([a], [b]) => subjectRank(a) - subjectRank(b))
            .map(([name, items]) => ({
                name, items, marks: items.reduce((s, q) => s + (Number(q.marks) || 0), 0),
            }));
    }, [questions]);

    const mcqCount = questions.filter(q => (q.question_type || 'mcq') === 'mcq').length;
    const writtenCount = questions.length - mcqCount;

    const globalIndex = useMemo(() => {
        const idx = {};
        let counter = 0;
        groups.forEach(g => g.items.forEach(q => { idx[q.id] = counter++; }));
        return idx;
    }, [groups]);

    // Safe answer check — value may be string OR {text, image} object
    const hasAnswer = (val) => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'object') return Boolean(val.text?.trim() || val.image?.data);
        return String(val).trim() !== '';
    };

    return (
        <div className="govt-paper">
            <style>{`
                .govt-paper{background:#fff;color:#111;padding:34px 42px 40px;border:1px solid #d1d5db;border-radius:3px;font-family:'Hind Siliguri','Noto Serif Bengali','Tiro Bangla','Times New Roman',serif;line-height:1.55;box-shadow:0 2px 10px rgba(15,23,42,.06)}
                .govt-paper *{box-sizing:border-box}
                .gp-head{text-align:center}
                .gp-emblem{width:70px;height:70px;margin:0 auto 8px;display:grid;place-items:center;overflow:hidden}
                .gp-emblem img{width:100%;height:100%;object-fit:contain}
                .gp-gov{font-size:16px;font-weight:700;margin:0;color:#1a1a1a}
                .gp-title{font-size:19px;font-weight:800;margin:2px 0 0}
                .gp-sub{font-size:14px;font-weight:700;margin:2px 0 0}
                .gp-code{font-size:12px;margin-top:2px}
                .gp-divider{border:none;border-top:2px solid #1a1a1a;margin:10px 0 6px}
                .gp-divider-thin{border:none;border-top:1px solid #555;margin:4px 0 10px}
                .gp-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px;font-size:13px;font-weight:700}
                .gp-meta .mid{text-align:center}.gp-meta .right{text-align:right}
                .gp-note{text-align:center;font-size:12px;margin:7px 0 13px}
                .gp-instructions{margin:0 0 17px}
                .gp-instructions-label{font-weight:800;font-size:13px}
                .gp-instructions-text{font-size:12.5px;color:#dc2626;line-height:1.6}
                .gp-section{margin:0 0 20px}
                .gp-section-head{position:relative;text-align:center;margin:7px 0 10px;min-height:25px}
                .gp-section-title{display:inline-block;font-size:16px;font-weight:800;text-decoration:underline;text-underline-offset:4px}
                .gp-section-mark{position:absolute;right:0;top:1px;font-size:13px;font-weight:800}
                .gp-q{break-inside:avoid;page-break-inside:avoid;margin:0 0 12px;font-size:14px}
                .gp-q-line{display:flex;align-items:flex-start;gap:8px}
                .gp-q-num{font-weight:800;flex:0 0 auto}
                .gp-q-text{font-weight:600;flex:1;min-width:0}
                .gp-q-mark{flex:0 0 auto;min-width:54px;text-align:right;font-weight:800;font-size:12.5px;white-space:nowrap}
                .gp-ans-btn{flex:0 0 auto;border:1px solid #111;background:#fff;color:#111;border-radius:4px;padding:2px 10px;font:700 12px inherit;cursor:pointer;margin-top:-1px}
                .gp-ans-btn:hover{background:#f3f4f6}
                .gp-ans-btn.done{background:#ecfdf5;border-color:#15803d;color:#166534}
                .gp-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;row-gap:3px;margin:4px 0 0 28px}
                .gp-opt{display:flex;align-items:flex-start;gap:5px;border:0;background:transparent;padding:1px 3px;text-align:left;font:inherit;color:#111;border-radius:3px}
                .gp-opt.interactive{cursor:pointer}
                .gp-opt.interactive:hover{background:#f3f4f6}
                .gp-opt.selected{font-weight:800;background:#eefbf1;outline:1px solid #86c995}
                .gp-opt-key{font-weight:700;white-space:nowrap}
                .gp-opt-correct{color:#15803d;font-weight:800}
                .gp-lines{margin:5px 0 0 28px}
                .gp-line{border-bottom:1px dotted #a3a3a3;height:20px}
                .gp-model{margin:6px 0 0 28px;padding:7px 10px;border-left:3px solid #15803d;background:#f0fdf4;font-size:12.5px}
                .gp-saved{font-size:11px;color:#166534;font-weight:700;margin-left:28px;margin-top:3px}
                .gp-empty{text-align:center;padding:42px 0;color:#64748b}
                .gp-foot{margin-top:20px;padding-top:8px;border-top:1px solid #aaa;text-align:center;font-size:11px;color:#555}
                @media print{.govt-paper{border:0;box-shadow:none;padding:0}.gp-ans-btn{display:none}.gp-q{break-inside:avoid}}
                @media(max-width:680px){.govt-paper{padding:22px 15px 28px}.gp-meta{grid-template-columns:1fr 1fr}.gp-meta .mid{display:none}.gp-opts{grid-template-columns:1fr;margin-left:22px}.gp-q-mark{min-width:40px}.gp-section-mark{position:static;display:block;text-align:right;margin-top:-20px}.gp-title{font-size:17px}}
            `}</style>

            {/* ── Header ── */}
            <div className="gp-head">
                <div className="gp-emblem">
                    <img
                        src={emblemSrc || BD_EMBLEM_URL}
                        alt="বাংলাদেশ সরকার"
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                </div>
                <p className="gp-gov">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</p>
                <h2 className="gp-title">{title || 'নিয়োগ পরীক্ষা'}</h2>
                {subtitle && <p className="gp-sub">{subtitle}</p>}
                {code && <div className="gp-code">পরীক্ষা কোড: {code}</div>}
            </div>

            <hr className="gp-divider" />

            <div className="gp-meta">
                <div>সময়: {timeLimit ? `${timeLimit} মিনিট` : '—'}</div>
                <div className="mid">বিষয়: {subjectLine}</div>
                <div className="right">পূর্ণমান: {marks}</div>
            </div>

            <hr className="gp-divider-thin" />

            <div className="gp-note">[ডান পাশে প্রদত্ত সংখ্যা সংশ্লিষ্ট প্রশ্নের মান নির্দেশক]</div>

            {/* Instructions — label normal, text red, no box */}
            {instructions && (
                <div className="gp-instructions">
                    <span className="gp-instructions-label">বিশেষ নির্দেশনা: </span>
                    <span className="gp-instructions-text">{instructions}</span>
                </div>
            )}

            {!questions.length ? (
                <div className="gp-empty">প্রশ্নপত্রে কোনো প্রশ্ন যোগ করা হয়নি।</div>
            ) : groups.map((group, gi) => (
                <section className="gp-section" key={`${group.name}-${gi}`}>
                    <div className="gp-section-head">
                        <span className="gp-section-title">{group.name}</span>
                        <span className="gp-section-mark">{group.marks}</span>
                    </div>
                    {group.items.map(q => {
                        const i = globalIndex[q.id] ?? q._paperIndex;
                        const written = (q.question_type || 'mcq') === 'written';
                        const value = answers?.[q.id];
                        const answered = hasAnswer(value);
                        return (
                            <div className="gp-q" key={q.id || i}>
                                <div className="gp-q-line">
                                    <span className="gp-q-num">{i + 1}।</span>
                                    <span className="gp-q-text">{q.question_text}</span>
                                    {written && interactive && (
                                        <button type="button"
                                            className={`gp-ans-btn ${answered ? 'done' : ''}`}
                                            onClick={() => onWrittenAnswer?.(q)}>
                                            {answered ? 'Ans ✓' : 'Ans'}
                                        </button>
                                    )}
                                    <span className="gp-q-mark">{Number(q.marks) || 1}</span>
                                </div>

                                {written ? (
                                    interactive
                                        ? (answered
                                            ? <div className="gp-saved">উত্তর সংরক্ষিত হয়েছে · Ans চাপলে সম্পাদনা করতে পারবেন</div>
                                            : null)
                                        : showAnswers && q.model_answer
                                            ? <div className="gp-model"><b>নমুনা উত্তর:</b> {q.model_answer}</div>
                                            : <div className="gp-lines">
                                                {Array.from({ length: Math.min(6, Math.max(2, Math.round((Number(q.marks) || 5) * .7))) })
                                                    .map((_, k) => <div className="gp-line" key={k} />)}
                                              </div>
                                ) : (
                                    <div className="gp-opts">
                                        {(q.options || []).map((opt, j) => {
                                            const selected = interactive && value === opt;
                                            const right = showAnswers && opt === q.correct_answer;
                                            const Tag = interactive ? 'button' : 'div';
                                            return (
                                                <Tag
                                                    type={interactive ? 'button' : undefined}
                                                    key={j}
                                                    onClick={interactive ? () => {
                                                        if (selected) onSelectAnswer?.(q, null);
                                                        else onSelectAnswer?.(q, opt);
                                                    } : undefined}
                                                    className={`gp-opt ${interactive ? 'interactive' : ''} ${selected ? 'selected' : ''} ${right ? 'gp-opt-correct' : ''}`}>
                                                    <span className="gp-opt-key">({['ক', 'খ', 'গ', 'ঘ'][j] || j + 1})</span>
                                                    <span>{opt}{right ? ' ✓' : ''}</span>
                                                </Tag>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </section>
            ))}

            <div className="gp-foot">
                মোট প্রশ্ন: {questions.length}
                {mcqCount ? ` · বহুনির্বাচনি: ${mcqCount}` : ''}
                {writtenCount ? ` · লিখিত: ${writtenCount}` : ''}
            </div>
        </div>
    );
};
export default GovtExamPaper;
