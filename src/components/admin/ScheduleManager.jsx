import React, { useState } from 'react';
import { CalendarDays, CalendarRange, CheckCircle2, Circle, Info } from 'lucide-react';
import { useExam } from '../../context/ExamContext';
import { useToast } from '../../context/ToastContext';
import { PageHead } from '../common/Card';
import { EmptyState } from '../common/Loader';
import { Button } from '../common/Button';
import { Alert } from '../common/Input';

export const ScheduleManager = () => {
    const { modelTests, schedule, assignDaily, assignWeekly, dailyExam, weeklyExam } = useExam();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const run = async (fn, msg) => {
        setBusy(true);
        try { await fn(); toast.success(msg); }
        catch (e) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    if (!modelTests.length) {
        return (
            <div className="anim-up">
                <PageHead title="Exam Schedule" sub="Choose which model test runs as the daily and the weekly exam." />
                <EmptyState icon={CalendarDays} title="No model tests yet"
                    text="Create a model test in Exam Studio first, then schedule it here." />
            </div>
        );
    }

    return (
        <div className="anim-up">
            <PageHead title="Exam Schedule" sub="Choose which model test runs as the daily and the weekly exam." />

            <div className="mb-3">
                <Alert type="info" icon={Info}>
                    The daily slot resets every day and the weekly slot resets each week.
                    Assigning a test here publishes it to students straight away.
                </Alert>
            </div>

            <div className="grid grid-2">
                <Slot icon={CalendarDays} color="var(--accent)" title="Daily Exam"
                    sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    current={dailyExam} currentId={dailyExam ? schedule.daily_test_id : null}
                    tests={modelTests} busy={busy}
                    onAssign={(id, title) => run(() => assignDaily(id), id ? `"${title}" is today's daily exam.` : 'Daily exam cleared.')} />

                <Slot icon={CalendarRange} color="#8b5cf6" title="Weekly Exam"
                    sub="Runs for the whole of this week"
                    current={weeklyExam} currentId={weeklyExam ? schedule.weekly_test_id : null}
                    tests={modelTests} busy={busy}
                    onAssign={(id, title) => run(() => assignWeekly(id), id ? `"${title}" is this week's exam.` : 'Weekly exam cleared.')} />
            </div>
        </div>
    );
};

const Slot = ({ icon: Icon, color, title, sub, current, currentId, tests, busy, onAssign }) => (
    <div className="card card-pad">
        <div className="flex center gap-2 mb-2">
            <div className="stat-icon" style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color, width: 40, height: 40 }}>
                <Icon size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
                <div className="f-15 fw-7">{title}</div>
                <div className="f-12 text-sub">{sub}</div>
            </div>
        </div>

        {current ? (
            <div className="card card-pad mb-2" style={{ background: 'var(--success-l)', borderColor: 'var(--success)', padding: 14 }}>
                <div className="flex center gap-2">
                    <CheckCircle2 size={17} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <div className="f-14 fw-7">{current.title}</div>
                        <div className="f-12 text-sub">
                            {current.questionIds?.length || 0} questions · {current.time_limit} min · pass {current.pass_marks}%
                        </div>
                    </div>
                </div>
                <Button variant="secondary" size="sm" block className="mt-2" disabled={busy}
                    onClick={() => onAssign(null)}>Clear this slot</Button>
            </div>
        ) : (
            <div className="f-13 text-sub mb-2" style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10 }}>
                Nothing assigned yet. Pick a test below.
            </div>
        )}

        <label className="label">Available Model Tests</label>
        <div className="flex col gap-1" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {tests.map(t => {
                const on = currentId === t.id;
                const n = t.questionIds?.length || 0;
                return (
                    <button key={t.id} className={`opt-btn ${on ? 'on' : ''}`}
                        style={{ padding: 12, borderColor: on ? color : undefined, background: on ? `color-mix(in srgb, ${color} 9%, transparent)` : undefined }}
                        disabled={!n || busy} onClick={() => onAssign(t.id, t.title)}>
                        {on ? <CheckCircle2 size={16} style={{ color, flexShrink: 0 }} />
                            : <Circle size={16} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="f-13 fw-6 truncate">{t.title}</div>
                            <div className="f-11 text-mute">{n} question{n !== 1 ? 's' : ''} · {t.time_limit} min</div>
                        </div>
                    </button>
                );
            })}
        </div>
    </div>
);
export default ScheduleManager;
