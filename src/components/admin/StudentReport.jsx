import React, { useState, useMemo } from 'react';
import {
    ArrowLeft, User, TrendingUp, Award, Target, Clock,
    CheckCircle2, XCircle, BarChart3, Phone, Hash, Hourglass,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { PageHead, StatCard, SearchBox } from '../common/Card';
import { EmptyState } from '../common/Loader';
import { Button } from '../common/Button';
import { LineChart, DonutChart, HBars, ChartCard, RadialProgress, BarChart } from '../common/Charts';

export const StudentReport = ({ initialId, onBack }) => {
    const { profiles } = useExam();
    const [selected, setSelected] = useState(initialId || null);
    const [search, setSearch] = useState('');

    const students = useMemo(() => profiles.filter(u =>
        u.role === 'student' && (!search
            || u.full_name?.toLowerCase().includes(search.toLowerCase())
            || u.student_id?.toLowerCase().includes(search.toLowerCase()))
    ), [profiles, search]);

    if (selected) return <SingleReport studentId={selected} onBack={() => { setSelected(null); onBack?.(); }} />;

    return (
        <div className="anim-up">
            <PageHead title="Student Reports" sub="Pick a student to see their full performance breakdown." />

            <div className="mb-3" style={{ maxWidth: 360 }}>
                <SearchBox value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or student ID…" />
            </div>

            {!students.length ? (
                <EmptyState icon={User} title="No students found" text="Try a different search term." />
            ) : (
                <div className="grid grid-3">
                    {students.map(s => <Tile key={s.id} student={s} onClick={() => setSelected(s.id)} />)}
                </div>
            )}
        </div>
    );
};

const Tile = ({ student, onClick }) => {
    const { statsFor } = useExam();
    const st = statsFor(student.id);
    const col = st.avgScore >= 70 ? 'var(--success)' : st.avgScore >= 40 ? 'var(--warning)' : 'var(--danger)';
    return (
        <button onClick={onClick} className="card card-pad card-hover" style={{ textAlign: 'left', width: '100%' }}>
            <div className="flex center gap-2 mb-2">
                <div className="avatar" style={{ width: 42, height: 42, fontSize: 16 }}>
                    {student.full_name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                    <div className="f-14 fw-7 truncate">{student.full_name}</div>
                    <div className="f-11 text-mute">{student.student_id}</div>
                </div>
            </div>
            <div className="flex between center">
                <div>
                    <div className="f-12 text-sub fw-6">{st.total} exam{st.total !== 1 ? 's' : ''} taken</div>
                    <div className="f-11 text-mute">{st.passed} passed · {st.failed} failed</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="f-11 text-mute">Average</div>
                    <div className="f-15 fw-8" style={{ color: col }}>{st.avgScore}%</div>
                </div>
            </div>
        </button>
    );
};

const SingleReport = ({ studentId, onBack }) => {
    const { profiles, results, statsFor } = useExam();

    const student = profiles.find(u => u.id === studentId);
    const mine = useMemo(() =>
        results.filter(r => r.student_id === studentId)
            .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)),
        [results, studentId]);
    const stats = statsFor(studentId);

    const progress = useMemo(() =>
        [...mine].reverse().map((r, i) => ({ label: `#${i + 1}`, value: Number(r.percentage) || 0 })), [mine]);

    const distribution = useMemo(() => {
        const b = [
            { label: '0–20', value: 0, color: '#dc2626' },
            { label: '21–40', value: 0, color: '#ea580c' },
            { label: '41–60', value: 0, color: '#d97706' },
            { label: '61–80', value: 0, color: '#65a30d' },
            { label: '81–100', value: 0, color: '#059669' },
        ];
        mine.forEach(r => {
            const p = Number(r.percentage) || 0;
            b[p <= 20 ? 0 : p <= 40 ? 1 : p <= 60 ? 2 : p <= 80 ? 3 : 4].value++;
        });
        return b;
    }, [mine]);

    const byExam = useMemo(() =>
        mine.slice(0, 8).map(r => ({ label: r.exam_title?.slice(0, 22) || 'Exam', value: Math.round(r.percentage), suffix: '%' })),
        [mine]);

    const avgTime = mine.length
        ? Math.round(mine.reduce((s, r) => s + (r.time_taken || 0), 0) / mine.length / 60) : 0;

    if (!student) return <EmptyState icon={User} title="Student not found" action={<Button onClick={onBack}>Go Back</Button>} />;

    return (
        <div className="anim-up">
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="mb-2">
                Back to all students
            </Button>

            <div className="card card-pad mb-3">
                <div className="flex center gap-3 wrap">
                    <div className="avatar" style={{ width: 62, height: 62, fontSize: 24, borderRadius: 18 }}>
                        {student.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="grow" style={{ minWidth: 190 }}>
                        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.035em' }}>{student.full_name}</div>
                        <div className="flex gap-3 wrap f-12 text-sub mt-1">
                            <span className="flex center gap-1"><Hash size={13} /> {student.student_id}</span>
                            <span className="flex center gap-1"><User size={13} /> @{student.username}</span>
                            {student.phone && <span className="flex center gap-1"><Phone size={13} /> {student.phone}</span>}
                        </div>
                    </div>
                    <RadialProgress value={Math.round(stats.avgScore)} size={98} label="Average" />
                </div>
            </div>

            {!mine.length ? (
                <EmptyState icon={BarChart3} title="No exams taken yet"
                    text={`${student.full_name} has not attempted any exam so far.`} />
            ) : (
                <>
                    <div className="grid grid-4 mb-3">
                        <StatCard icon={Target} label="Exams Taken" value={stats.total} color="var(--brand)" />
                        <StatCard icon={CheckCircle2} label="Passed" value={stats.passed} color="var(--success)" />
                        <StatCard icon={XCircle} label="Failed" value={stats.failed} color="var(--danger)" />
                        <StatCard icon={Award} label="Best Score" value={`${stats.highestScore}%`} color="var(--warning)" />
                    </div>

                    <div className="grid grid-2 mb-3">
                        <ChartCard title="Score Progress" sub="Performance across attempts, oldest first">
                            <LineChart data={progress} color="var(--brand)" maxY={100} label="%" />
                        </ChartCard>
                        <ChartCard title="Pass / Fail Split">
                            <DonutChart data={[
                                { label: 'Passed', value: stats.passed, color: 'var(--success)' },
                                { label: 'Failed', value: stats.failed, color: 'var(--danger)' },
                            ]} centerValue={stats.total} centerLabel="Attempts" />
                        </ChartCard>
                        <ChartCard title="Score by Exam" sub="Most recent exams">
                            <HBars data={byExam} />
                        </ChartCard>
                        <ChartCard title="Score Distribution" sub="How often each score range was hit">
                            <BarChart data={distribution} />
                        </ChartCard>
                    </div>

                    <div className="card card-pad mb-3 flex gap-4 wrap">
                        <Fact icon={Clock} color="var(--accent)" label="Average time per exam" value={`${avgTime} min`} />
                        <Fact icon={TrendingUp} color="var(--success)" label="Pass rate"
                            value={`${stats.total ? Math.round((stats.passed / stats.total) * 100) : 0}%`} />
                        {stats.pending > 0 && (
                            <Fact icon={Hourglass} color="var(--warning)" label="Awaiting marking" value={stats.pending} />
                        )}
                    </div>

                    <div className="section-title mb-2">Exam History</div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Exam</th><th>Score</th><th>Result</th><th>Time</th><th>Date</th></tr></thead>
                            <tbody>
                                {mine.map(r => (
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
                                                    {r.passed ? 'Pass' : 'Fail'}</span>}
                                        </td>
                                        <td className="f-12 text-sub">{Math.round((r.time_taken || 0) / 60)} min</td>
                                        <td className="f-12 text-sub">
                                            {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
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

const Fact = ({ icon: Icon, color, label, value }) => (
    <div className="flex center gap-2">
        <Icon size={18} style={{ color }} />
        <div>
            <div className="f-11 text-sub fw-6">{label}</div>
            <div className="f-14 fw-7">{value}</div>
        </div>
    </div>
);
export default StudentReport;
