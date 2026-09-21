import React, { useMemo } from 'react';
import {
    Target, Award, TrendingUp, CheckCircle2, CalendarDays, CalendarRange,
    Play, BookOpen, Flame, Clock, BarChart3, Hourglass, Hash,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { PageHead, StatCard } from '../common/Card';
import { Button } from '../common/Button';
import { LineChart, DonutChart, ChartCard, RadialProgress } from '../common/Charts';
import { EmptyState, Loader } from '../common/Loader';

export const StudentDashboard = ({ onNavigate, onStartExam }) => {
    const { profile } = useAuth();
    const { myResults, statsFor, dailyExam, weeklyExam, hasSubmitted, loading } = useExam();

    const stats = statsFor(profile?.id);

    const progress = useMemo(() =>
        [...myResults].reverse().slice(-10).map((r, i) => ({ label: `#${i + 1}`, value: Number(r.percentage) || 0 })),
        [myResults]);

    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    if (loading && !myResults.length) return <Loader text="Loading your dashboard…" full />;

    return (
        <div className="anim-up">
            <PageHead title={`${greet}, ${profile?.full_name?.split(' ')[0] || 'there'}`}
                sub="Here is how your preparation is going."
                action={<span className="badge badge-gray"><Hash size={11} />{profile?.student_id}</span>} />

            <div className="grid grid-2 mb-3">
                <Scheduled icon={CalendarDays} color="var(--accent)" label="Today's Daily Exam"
                    exam={dailyExam} done={dailyExam && hasSubmitted(dailyExam.id)}
                    onStart={() => onStartExam?.(dailyExam.id)} />
                <Scheduled icon={CalendarRange} color="#8b5cf6" label="This Week's Exam"
                    exam={weeklyExam} done={weeklyExam && hasSubmitted(weeklyExam.id)}
                    onStart={() => onStartExam?.(weeklyExam.id)} />
            </div>

            <div className="grid grid-4 mb-3">
                <StatCard icon={Target} label="Exams Taken" value={stats.total} color="var(--brand)" />
                <StatCard icon={CheckCircle2} label="Passed" value={stats.passed} color="var(--success)" />
                <StatCard icon={TrendingUp} label="Average Score" value={`${stats.avgScore}%`} color="var(--warning)" />
                <StatCard icon={Award} label="Best Score" value={`${stats.highestScore}%`} color="#ec4899" />
            </div>

            {stats.pending > 0 && (
                <div className="card card-pad mb-3 flex center gap-2" style={{ background: 'var(--warning-l)', borderColor: 'var(--warning)' }}>
                    <Hourglass size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    <div className="f-13 fw-6">
                        {stats.pending} paper{stats.pending !== 1 ? 's are' : ' is'} still being marked. Scores will update once written answers are assessed.
                    </div>
                </div>
            )}

            {!myResults.length ? (
                <EmptyState icon={BookOpen} title="You haven't taken an exam yet"
                    text="Browse the model tests and start your first one. Your progress charts will appear here afterwards."
                    action={<Button icon={Play} onClick={() => onNavigate?.('exams')}>Browse Model Tests</Button>} />
            ) : (
                <>
                    <div className="grid grid-2 mb-3">
                        <ChartCard title="Your Progress" sub="Scores from your last 10 attempts">
                            <LineChart data={progress} color="var(--brand)" maxY={100} label="%" />
                        </ChartCard>

                        <ChartCard title="Overall Performance">
                            <div className="flex center gap-3 wrap jcenter">
                                <RadialProgress value={Math.round(stats.avgScore)} size={136} label="Average" />
                                <div className="flex col gap-2" style={{ minWidth: 165 }}>
                                    <Mini icon={CheckCircle2} color="var(--success)" label="Passed" value={stats.passed} />
                                    <Mini icon={Target} color="var(--danger)" label="Failed" value={stats.failed} />
                                    <Mini icon={Flame} color="var(--warning)" label="Pass rate"
                                        value={`${stats.total ? Math.round((stats.passed / stats.total) * 100) : 0}%`} />
                                </div>
                            </div>
                        </ChartCard>
                    </div>

                    <div className="grid grid-2 mb-3">
                        <ChartCard title="Results Split">
                            <DonutChart data={[
                                { label: 'Passed', value: stats.passed, color: 'var(--success)' },
                                { label: 'Failed', value: stats.failed, color: 'var(--danger)' },
                            ]} centerValue={stats.total} centerLabel="Attempts" />
                        </ChartCard>

                        <ChartCard title="Recent Results" sub="Your last few attempts"
                            action={<Button variant="ghost" size="sm" icon={BarChart3} onClick={() => onNavigate?.('history')}>View all</Button>}>
                            <div className="flex col gap-2">
                                {myResults.slice(0, 4).map(r => {
                                    const p = Math.round(Number(r.percentage) || 0);
                                    const col = p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warning)' : 'var(--danger)';
                                    return (
                                        <div key={r.id}>
                                            <div className="flex between center gap-2 mb-1">
                                                <span className="f-13 fw-6 truncate">{r.exam_title}</span>
                                                <span className="f-14 fw-8" style={{ color: col }}>{p}%</span>
                                            </div>
                                            <div className="progress"><div className="progress-bar" style={{ width: `${p}%`, background: col }} /></div>
                                            <div className="f-11 text-mute mt-1 flex center gap-1">
                                                <Clock size={11} />
                                                {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ChartCard>
                    </div>
                </>
            )}
        </div>
    );
};

const Mini = ({ icon: Icon, color, label, value }) => (
    <div className="flex center gap-2">
        <Icon size={16} style={{ color }} />
        <span className="f-12 text-sub fw-6">{label}</span>
        <span className="f-14 fw-8" style={{ marginLeft: 'auto', paddingLeft: 14 }}>{value}</span>
    </div>
);

const Scheduled = ({ icon: Icon, color, label, exam, done, onStart }) => (
    <div className="card card-pad" style={{ borderColor: exam ? color : undefined }}>
        <div className="flex center gap-2 mb-2">
            <div className="stat-icon" style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color, width: 38, height: 38 }}>
                <Icon size={19} />
            </div>
            <div className="f-11 fw-7 text-sub" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
        </div>

        {!exam ? (
            <div className="f-13 text-mute" style={{ padding: '16px 0' }}>
                No exam scheduled right now. Please check back later.
            </div>
        ) : (
            <>
                <div className="f-15 fw-7 mb-1">{exam.title}</div>
                <div className="flex gap-3 wrap f-12 text-sub mb-2">
                    <span>{exam.questionIds?.length || 0} questions</span>
                    <span>{exam.time_limit} minutes</span>
                    <span>Pass {exam.pass_marks}%</span>
                </div>
                {done
                    ? <span className="badge badge-success" style={{ padding: '8px 14px' }}>
                        <CheckCircle2 size={13} /> Already submitted
                      </span>
                    : <Button block icon={Play} onClick={onStart}>Start Exam</Button>}
            </>
        )}
    </div>
);
export default StudentDashboard;
