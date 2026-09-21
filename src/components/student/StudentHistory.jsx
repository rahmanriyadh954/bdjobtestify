import React, { useState, useMemo } from 'react';
import { History, Eye, TrendingUp, Award, Target, Hourglass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { PageHead, StatCard, SearchBox } from '../common/Card';
import { EmptyState, Loader } from '../common/Loader';
import { Button } from '../common/Button';
import { ResultView } from './ResultView';
import { LineChart, ChartCard } from '../common/Charts';

export const StudentHistory = () => {
    const { profile } = useAuth();
    const { myResults, statsFor, loading } = useExam();
    const [search, setSearch] = useState('');
    const [viewing, setViewing] = useState(null);

    const stats = statsFor(profile?.id);

    const rows = useMemo(() => myResults.filter(r =>
        !search || r.exam_title?.toLowerCase().includes(search.trim().toLowerCase())
    ), [myResults, search]);

    const trend = useMemo(() =>
        [...myResults].reverse().map((r, i) => ({ label: `#${i + 1}`, value: Number(r.percentage) || 0 })),
        [myResults]);

    if (viewing) return <ResultView result={viewing} resultId={viewing.id} onClose={() => setViewing(null)} />;
    if (loading && !myResults.length) return <Loader text="Loading your history…" full />;

    return (
        <div className="anim-up">
            <PageHead title="My History" sub="Every exam you have taken so far." />

            {!myResults.length ? (
                <EmptyState icon={History} title="No exam history yet"
                    text="Once you complete an exam, your full record and progress chart will appear here." />
            ) : (
                <>
                    <div className="grid grid-4 mb-3">
                        <StatCard icon={Target} label="Exams Taken" value={stats.total} color="var(--brand)" />
                        <StatCard icon={Award} label="Passed" value={stats.passed} color="var(--success)" />
                        <StatCard icon={TrendingUp} label="Average" value={`${stats.avgScore}%`} color="var(--warning)" />
                        <StatCard icon={Award} label="Best" value={`${stats.highestScore}%`} color="#ec4899" />
                    </div>

                    <div className="mb-3">
                        <ChartCard title="Score Trend" sub="Your performance over time">
                            <LineChart data={trend} color="var(--brand)" maxY={100} label="%" />
                        </ChartCard>
                    </div>

                    <div className="mb-2" style={{ maxWidth: 340 }}>
                        <SearchBox value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exams…" />
                    </div>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Exam</th><th>Score</th><th>Result</th><th>Date</th><th></th></tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td className="f-13 fw-6">{r.exam_title}</td>
                                        <td>
                                            <span className="fw-7">{r.score}</span>
                                            <span className="text-mute f-12"> / {r.total_marks}</span>
                                            <div className="f-11 text-sub">{Math.round(r.percentage)}%</div>
                                        </td>
                                        <td>
                                            {r.needs_grading
                                                ? <span className="badge badge-warning"><Hourglass size={10} /> Marking</span>
                                                : <span className={`badge ${r.passed ? 'badge-success' : 'badge-danger'}`}>
                                                    {r.passed ? 'Passed' : 'Failed'}
                                                  </span>}
                                        </td>
                                        <td className="f-12 text-sub">
                                            {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td><Button variant="ghost" size="sm" icon={Eye} onClick={() => setViewing(r)}>Review</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};
export default StudentHistory;
