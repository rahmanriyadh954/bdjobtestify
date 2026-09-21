import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Library, Calendar, ClipboardList, Users, BarChart3,
    BookOpen, History, GraduationCap, Menu, X, Sun, Moon, LogOut,
    ShieldCheck, KeyRound, AlertCircle, Database,
} from 'lucide-react';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { ChangePassword } from './components/auth/ChangePassword';

import { Dashboard } from './components/admin/Dashboard';
import { ExamStudio } from './components/admin/ExamStudio';
import { ScheduleManager } from './components/admin/ScheduleManager';
import { ResultsTab } from './components/admin/ResultsTab';
import { StudentReport } from './components/admin/StudentReport';
import { UserManager } from './components/admin/UserManager';

import { StudentDashboard } from './components/student/StudentDashboard';
import { ExamList } from './components/student/ExamList';
import { ExamPaper } from './components/student/ExamPaper';
import { StudentHistory } from './components/student/StudentHistory';

import { Loader } from './components/common/Loader';
import { Alert } from './components/common/Input';
import { SITE_NAME, SITE_TAGLINE } from './utils/constants';

import './styles/global.css';

const ADMIN_NAV = [
    { key: 'overview', label: 'Dashboard',       icon: LayoutDashboard },
    { key: 'studio',   label: 'Exam Studio',     icon: Library },
    { key: 'schedule', label: 'Exam Schedule',   icon: Calendar },
    { key: 'results',  label: 'Results',         icon: ClipboardList },
    { key: 'reports',  label: 'Student Reports', icon: BarChart3 },
    { key: 'users',    label: 'User Accounts',   icon: Users },
];

const STUDENT_NAV = [
    { key: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard },
    { key: 'exams',     label: 'Model Tests', icon: BookOpen },
    { key: 'history',   label: 'My History',  icon: History },
];

/* ═══ AUTH SCREEN ═══ */
const AuthScreen = () => {
    const { toggleTheme, isDark } = useTheme();
    const [isRegister, setIsRegister] = useState(false);

    return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px 18px', position: 'relative' }}>
            <button onClick={toggleTheme} className="btn btn-secondary btn-icon"
                style={{ position: 'absolute', top: 20, right: 20 }}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div style={{ width: '100%', maxWidth: 430 }} className="anim-up">
                <header className="text-center mb-3">
                    <div className="brand-badge" style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: 17 }}>
                        <GraduationCap size={29} />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.04em' }}>{SITE_NAME}</h1>
                    <p className="f-13 text-sub mt-1">{SITE_TAGLINE}</p>
                </header>

                <div className="card" style={{ padding: 28 }}>
                    <h2 className="f-15 fw-7 mb-3">{isRegister ? 'Create your account' : 'Sign in to continue'}</h2>
                    {isRegister
                        ? <Register onSwitchToLogin={() => setIsRegister(false)} />
                        : <Login onSwitchToRegister={() => setIsRegister(true)} />}
                </div>

                <div className="flex center jcenter gap-1 mt-2 f-11 text-mute">
                    <ShieldCheck size={13} /> Answers and scoring are handled on our servers
                </div>
            </div>
        </main>
    );
};

/* ═══ MAIN LAYOUT ═══ */
const MainLayout = () => {
    const { profile, logout, isAdmin, mustChangePassword } = useAuth();
    const { toggleTheme, isDark } = useTheme();

    const [tab, setTab] = useState(isAdmin ? 'overview' : 'dashboard');
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeTestId, setActiveTestId] = useState(null);
    const [reportId, setReportId] = useState(null);
    const [pwOpen, setPwOpen] = useState(false);

    const nav = isAdmin ? ADMIN_NAV : STUDENT_NAV;

    useEffect(() => { setMenuOpen(false); }, [tab]);
    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    const go = (k) => { setActiveTestId(null); setReportId(null); setTab(k); };
    const startExam = (id) => { setActiveTestId(id); setTab('taking'); };
    const exitExam = () => { setActiveTestId(null); setTab(isAdmin ? 'overview' : 'dashboard'); };
    const openReport = (id) => { setReportId(id); setTab('reports'); };

    const heading = tab === 'taking' ? 'Exam in Progress' : nav.find(n => n.key === tab)?.label || '';

    return (
        <div className="app-shell">
            <a href="#main" className="skip-link">Skip to main content</a>

            <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
                <div className="sidebar-head">
                    <div className="brand-badge"><GraduationCap size={21} /></div>
                    <div style={{ minWidth: 0 }}>
                        <div className="brand-title">{SITE_NAME}</div>
                        <div className="brand-sub">{isAdmin ? 'Admin Panel' : 'Candidate'}</div>
                    </div>
                    {menuOpen && (
                        <button className="btn btn-ghost btn-icon" onClick={() => setMenuOpen(false)}
                            style={{ marginLeft: 'auto' }} aria-label="Close menu"><X size={19} /></button>
                    )}
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-label">Menu</div>
                    {nav.map(n => (
                        <button key={n.key} className={`nav-item ${tab === n.key ? 'active' : ''}`}
                            onClick={() => go(n.key)} aria-current={tab === n.key ? 'page' : undefined}>
                            <n.icon size={18} /> {n.label}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-foot">
                    <div className="user-chip">
                        <div className="avatar">{profile?.full_name?.charAt(0).toUpperCase()}</div>
                        <div className="grow">
                            <div className="f-13 fw-7 truncate">{profile?.full_name}</div>
                            <div className="f-11 text-mute truncate">{profile?.student_id}</div>
                        </div>
                    </div>
                    <button className="nav-item" onClick={() => setPwOpen(true)} style={{ fontSize: 13 }}>
                        <KeyRound size={16} /> Change Password
                    </button>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={toggleTheme}>
                            {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? 'Light' : 'Dark'}
                        </button>
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, color: 'var(--danger)' }} onClick={logout}>
                            <LogOut size={15} /> Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            <div className={`overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />

            <div className="main-area">
                <header className="topbar">
                    <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
                        <Menu size={22} />
                    </button>
                    <div className="fw-7 f-15 grow truncate">{heading}</div>
                    <button className="btn btn-ghost btn-icon" onClick={toggleTheme}
                        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </header>

                <main className="content" id="main">
                    {isAdmin ? (
                        <>
                            {tab === 'overview' && <Dashboard onNavigateTab={go} />}
                            {tab === 'studio'   && <ExamStudio />}
                            {tab === 'schedule' && <ScheduleManager />}
                            {tab === 'results'  && <ResultsTab onViewStudent={openReport} />}
                            {tab === 'reports'  && <StudentReport initialId={reportId} onBack={() => setReportId(null)} />}
                            {tab === 'users'    && <UserManager onViewReport={openReport} />}
                        </>
                    ) : (
                        <>
                            {tab === 'dashboard' && <StudentDashboard onNavigate={go} onStartExam={startExam} />}
                            {tab === 'exams'     && <ExamList onStartExam={startExam} />}
                            {tab === 'history'   && <StudentHistory />}
                            {tab === 'taking'    && <ExamPaper testId={activeTestId} onExit={exitExam} />}
                        </>
                    )}
                </main>
            </div>

            <ChangePassword open={pwOpen || mustChangePassword}
                forced={mustChangePassword} onClose={() => setPwOpen(false)} />
        </div>
    );
};

/* ═══ GATE ═══ */
const Gate = () => {
    const { profile, loading, configError } = useAuth();

    if (configError) {
        return (
            <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
                <div className="card card-pad" style={{ maxWidth: 520 }}>
                    <div className="flex center gap-2 mb-2">
                        <Database size={22} style={{ color: 'var(--danger)' }} />
                        <h1 className="f-15 fw-7">Database not connected</h1>
                    </div>
                    <Alert type="error" icon={AlertCircle}>
                        {SITE_NAME} cannot reach Supabase.
                    </Alert>
                    <div className="f-13 lh-15 text-sub mt-2">
                        <p className="mb-1">Open the <b>.env</b> file in your project folder and fill in:</p>
                        <pre className="card card-pad card-soft f-12" style={{ overflowX: 'auto', marginTop: 8 }}>
{`REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_key_here`}
                        </pre>
                        <p className="mt-2">Then stop the server and run <b>npm start</b> again.</p>
                    </div>
                </div>
            </main>
        );
    }

    if (loading) return <Loader text={`Starting ${SITE_NAME}…`} full />;
    return profile ? <MainLayout /> : <AuthScreen />;
};

export default function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <ExamProvider>
                        <Gate />
                    </ExamProvider>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
