import React, { useState, useMemo } from 'react';
import {
    BookOpen, Play, CheckCircle2, Clock, Library, Award,
    CalendarDays, CalendarRange, Layers, Hourglass,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { PageHead, SearchBox } from '../common/Card';
import { Button } from '../common/Button';
import { EmptyState, Loader } from '../common/Loader';

export const ExamList = ({ onStartExam }) => {
    const { publishedTests, hasSubmitted, resultFor, dailyExam, weeklyExam, loading } = useExam();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const list = useMemo(() => publishedTests.filter(e => {
        const s = search.trim().toLowerCase();
        if (s && !e.title?.toLowerCase().includes(s)) return false;
        const done = hasSubmitted(e.id);
        if (filter === 'daily')   return dailyExam?.id === e.id;
        if (filter === 'weekly')  return weeklyExam?.id === e.id;
        if (filter === 'pending') return !done;
        if (filter === 'done')    return done;
        return true;
    }), [publishedTests, search, filter, dailyExam, weeklyExam, hasSubmitted]);

    const FILTERS = [
        { key: 'all',     label: 'All Tests',  icon: Layers,       count: publishedTests.length },
        { key: 'daily',   label: 'Daily',      icon: CalendarDays, count: dailyExam ? 1 : 0 },
        { key: 'weekly',  label: 'Weekly',     icon: CalendarRange, count: weeklyExam ? 1 : 0 },
        { key: 'pending', label: 'Not Taken',  icon: Play,         count: publishedTests.filter(e => !hasSubmitted(e.id)).length },
        { key: 'done',    label: 'Completed',  icon: CheckCircle2, count: publishedTests.filter(e => hasSubmitted(e.id)).length },
    ];

    if (loading && !publishedTests.length) return <Loader text="Loading model tests…" full />;

    return (
        <div className="anim-up">
            <PageHead title="Model Tests" sub="Every exam available to you right now." />

            <div className="tabs" role="tablist">
                {FILTERS.map(f => (
                    <button key={f.key} role="tab" aria-selected={filter === f.key}
                        className={`tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                        <f.icon size={14} /> {f.label}
                        <span className="badge badge-gray" style={{ padding: '1px 7px' }}>{f.count}</span>
                    </button>
                ))}
            </div>

            <div className="mb-3" style={{ maxWidth: 340 }}>
                <SearchBox value={search} onChange={e => setSearch(e.target.value)} placeholder="Search model tests…" />
            </div>

            {!list.length ? (
                <EmptyState icon={BookOpen} title="Nothing here yet"
                    text={!publishedTests.length
                        ? 'No exams have been published yet. Please check back later.'
                        : 'No test matches this filter. Try another tab.'} />
            ) : (
                <div className="grid grid-2">
                    {list.map(e => {
                        const done = hasSubmitted(e.id);
                        const mine = resultFor(e.id);
                        const isDaily = dailyExam?.id === e.id;
                        const isWeekly = weeklyExam?.id === e.id;
                        const n = e.questionIds?.length || 0;
                        return (
                            <div key={e.id} className="card card-pad card-hover"
                                style={{ borderColor: isDaily ? 'var(--accent)' : isWeekly ? '#8b5cf6' : undefined }}>
                                <div className="flex center gap-1 wrap mb-2">
                                    {isDaily && <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)' }}><CalendarDays size={10} /> Daily</span>}
                                    {isWeekly && <span className="badge" style={{ background: 'color-mix(in srgb, #8b5cf6 13%, transparent)', color: '#8b5cf6' }}><CalendarRange size={10} /> Weekly</span>}
                                    {done && <span className="badge badge-success"><CheckCircle2 size={10} /> Completed</span>}
                                    {e.negative_marking && <span className="badge badge-warning">−{e.negative_value} negative</span>}
                                </div>

                                <div className="f-15 fw-7 mb-1" style={{ letterSpacing: '-.02em' }}>{e.title}</div>
                                {e.description && <div className="f-13 text-sub lh-15 mb-2">{e.description}</div>}

                                <div className="flex gap-3 wrap f-12 text-sub mb-2">
                                    <span className="flex center gap-1"><Library size={14} /> {n} question{n !== 1 ? 's' : ''}</span>
                                    <span className="flex center gap-1"><Clock size={14} /> {e.time_limit} min</span>
                                    <span className="flex center gap-1"><Award size={14} /> Pass {e.pass_marks}%</span>
                                </div>

                                {done && mine ? (
                                    <div className="card card-pad" style={{
                                        padding: 13,
                                        background: mine.passed ? 'var(--success-l)' : 'var(--danger-l)',
                                        borderColor: mine.passed ? 'var(--success)' : 'var(--danger)',
                                    }}>
                                        <div className="flex between center gap-2">
                                            <span className="f-12 fw-6 flex center gap-1">
                                                {mine.needs_grading && <Hourglass size={12} />}
                                                {mine.needs_grading ? 'Partial score' : 'Your score'}
                                            </span>
                                            <span className="f-15 fw-8" style={{ color: mine.passed ? 'var(--success)' : 'var(--danger)' }}>
                                                {mine.score}/{mine.total_marks} ({Math.round(mine.percentage)}%)
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <Button block icon={Play} onClick={() => onStartExam(e.id)} >
                                        Start Exam
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
export default ExamList;
