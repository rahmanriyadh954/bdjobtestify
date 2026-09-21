import React, { useMemo } from 'react';
import {
    Users, Library, FileStack, ClipboardCheck, TrendingUp, Award, Send,
    Calendar, Plus, Hourglass, PenLine,
} from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { StatCard, PageHead } from '../common/Card';
import { Button } from '../common/Button';
import { BarChart, DonutChart, LineChart, ChartCard, HBars } from '../common/Charts';
import { EmptyState, Loader } from '../common/Loader';

export const Dashboard = ({ onNavigateTab }) => {
    const { questions, modelTests, publishedTests, results, profiles, loading } = useExam();

    const students = profiles.filter(u => u.role === 'student');

    const stats = useMemo(() => {
        const passed = results.filter(r => r.passed).length;
        const avg = results.length
            ? (results.reduce((s, r) => s + (Number(r.percentage) || 0), 0) / results.length).toFixed(1) : 0;
        return { passed, failed: results.length - passed, avg, pending: results.filter(r => r.needs_grading).length };
    }, [results]);

    const bySubject = useMemo(() => {
        const m = {};
        questions.forEach(q => { m[q.subject] = (m[q.subject] || 0) + 1; });
        return Object.entries(m).map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value).slice(0, 7);
    }, [questions]);

    const trend = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            days.push({
                label: d.toLocaleDateString('en', { weekday: 'short' }),
                value: results.filter(r => r.submitted_at?.startsWith(key)).length,
            });
        }
        return days;
    }, [results]);

    const top = useMemo(() => {
        const m = {};
        results.forEach(r => {
            if (!m[r.student_id]) m[r.student_id] = { sum: 0, n: 0, name: r.profiles?.full_name };
            m[r.student_id].sum += Number(r.percentage) || 0;
            m[r.student_id].n++;
        });
        return Object.entries(m)
            .map(([id, v]) => ({ label: v.name || profiles.find(p => p.id === id)?.full_name || 'Student', value: Math.round(v.sum / v.n), suffix: '%' }))
            .sort((a, b) => b.value - a.value).slice(0, 5);
    }, [results, profiles]);

    const writtenCount = questions.filter(q => q.question_type === 'written').length;

    if (loading && !questions.length && !results.length) return <Loader text="Loading your dashboard…" full />;

    return (
        <div className="anim-up">
            <PageHead title="Dashboard" sub="An overview of BD JobTestify." />

            <div className="grid grid-4 mb-3">
                <StatCard icon={Users} label="Total Students" value={students.length} color="var(--brand)" />
                <StatCard icon={Library} label="Questions in Bank" value={questions.length} color="var(--accent)"
                    sub={writtenCount > 0 ? `${writtenCount} written` : undefined} />
                <StatCard icon={FileStack} label="Model Tests" value={modelTests.length} color="#8b5cf6"
                    sub={`${publishedTests.length} live`} />
                <StatCard icon={ClipboardCheck} label="Submissions" value={results.length} color="var(--success)" />
            </div>

            <div className="grid grid-4 mb-3">
                <StatCard icon={TrendingUp} label="Average Score" value={`${stats.avg}%`} color="var(--warning)" />
                <StatCard icon={Award} label="Passed" value={stats.passed} color="var(--success)" />
                <StatCard icon={Award} label="Failed" value={stats.failed} color="var(--danger)" />
                <StatCard icon={stats.pending ? Hourglass : Send}
                    label={stats.pending ? 'Awaiting Marking' : 'Live Exams'}
                    value={stats.pending || publishedTests.length}
                    color={stats.pending ? 'var(--warning)' : '#ec4899'} />
            </div>

            {stats.pending > 0 && (
                <div className="card card-pad mb-3 flex between center wrap gap-2"
                    style={{ background: 'var(--warning-l)', borderColor: 'var(--warning)' }}>
                    <div className="flex center gap-2">
                        <PenLine size={19} style={{ color: 'var(--warning)' }} />
                        <div className="f-13 fw-6">
                            {stats.pending} paper{stats.pending !== 1 ? 's have' : ' has'} written answers waiting to be marked.
                        </div>
                    </div>
                    <Button size="sm" onClick={() => onNavigateTab?.('results')}>Mark Now</Button>
                </div>
            )}

            {!results.length && !questions.length ? (
                <EmptyState icon={Library} title="Let's get started"
                    text="Your portal is empty. Build a question bank first, then create a model test and publish it."
                    action={<Button icon={Plus} onClick={() => onNavigateTab?.('studio')}>Open Exam Studio</Button>} />
            ) : (
                <div className="grid grid-2 mb-3">
                    <ChartCard title="Submissions — Last 7 Days" sub="Daily exam attempts">
                        <LineChart data={trend} maxY={Math.max(...trend.map(t => t.value), 5)} color="var(--brand)" />
                    </ChartCard>
                    <ChartCard title="Pass vs Fail" sub="Across all submissions">
                        <DonutChart data={[
                            { label: 'Passed', value: stats.passed, color: 'var(--success)' },
                            { label: 'Failed', value: stats.failed, color: 'var(--danger)' },
                        ]} centerValue={results.length} centerLabel="Attempts" />
                    </ChartCard>
                    <ChartCard title="Questions by Subject" sub="Your question bank breakdown">
                        <BarChart data={bySubject} color="var(--accent)" />
                    </ChartCard>
                    <ChartCard title="Top Performers" sub="Average score across all exams">
                        {top.length ? <HBars data={top} /> : <div className="empty f-13">No submissions yet.</div>}
                    </ChartCard>
                </div>
            )}

            <div className="card card-pad">
                <div className="section-title mb-2">Quick Actions</div>
                <div className="flex gap-2 wrap">
                    <Button variant="secondary" icon={Library} onClick={() => onNavigateTab?.('studio')}>Exam Studio</Button>
                    <Button variant="secondary" icon={Calendar} onClick={() => onNavigateTab?.('schedule')}>Schedule Exams</Button>
                    <Button variant="secondary" icon={ClipboardCheck} onClick={() => onNavigateTab?.('results')}>View Results</Button>
                    <Button variant="secondary" icon={Users} onClick={() => onNavigateTab?.('users')}>Manage Users</Button>
                </div>
            </div>
        </div>
    );
};
export default Dashboard;
