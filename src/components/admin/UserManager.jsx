import React, { useState, useMemo } from 'react';
import {
    Users, Edit3, Shield, UserCheck, BarChart3, KeyRound, Copy, Check,
    AlertCircle, Hash, UserX, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExam } from '../../context/ExamContext';
import { useToast } from '../../context/ToastContext';
import { PageHead, StatCard, SearchBox } from '../common/Card';
import { EmptyState, Loader } from '../common/Loader';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input, Select, Alert } from '../common/Input';
import { PasswordField } from '../common/PasswordField';
import { suggestPassword, checkPassword } from '../../utils/security';
import { adminResetPassword, updateProfile } from '../../services/db';

export const UserManager = ({ onViewReport }) => {
    const { profile: me } = useAuth();
    const { profiles, statsFor, refresh, loading } = useExam();
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [fRole, setFRole] = useState('all');
    const [editing, setEditing] = useState(null);
    const [resetting, setResetting] = useState(null);

    const rows = useMemo(() => profiles.filter(u => {
        const s = search.trim().toLowerCase();
        const ok = !s || u.full_name?.toLowerCase().includes(s)
            || u.username?.toLowerCase().includes(s)
            || u.student_id?.toLowerCase().includes(s);
        return ok && (fRole === 'all' || u.role === fRole);
    }), [profiles, search, fRole]);

    const admins = profiles.filter(u => u.role === 'admin').length;
    const students = profiles.filter(u => u.role === 'student').length;

    if (loading && !profiles.length) return <Loader text="Loading users…" full />;

    return (
        <div className="anim-up">
            <PageHead title="User Accounts" sub="Manage students and admins, and reset forgotten passwords."
                action={<Button variant="secondary" icon={RefreshCw} onClick={refresh}>Refresh</Button>} />

            <div className="grid grid-3 mb-3">
                <StatCard icon={Users} label="Total Users" value={profiles.length} color="var(--brand)" />
                <StatCard icon={UserCheck} label="Students" value={students} color="var(--accent)" />
                <StatCard icon={Shield} label="Admins" value={admins} color="#8b5cf6" />
            </div>

            <div className="flex gap-2 wrap mb-2">
                <SearchBox value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, username or ID…" />
                <select className="select" style={{ width: 'auto', minWidth: 145 }} value={fRole}
                    onChange={e => setFRole(e.target.value)} aria-label="Filter by role">
                    <option value="all">All Roles</option>
                    <option value="student">Students</option>
                    <option value="admin">Admins</option>
                </select>
            </div>

            {!rows.length ? (
                <EmptyState icon={Users} title="No users found" text="Try a different search or filter." />
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>User</th><th>Student ID</th><th>Role</th><th>Performance</th><th>Status</th><th></th></tr>
                        </thead>
                        <tbody>
                            {rows.map(u => {
                                const st = u.role === 'student' ? statsFor(u.id) : null;
                                return (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="flex center gap-2">
                                                <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                                                    {u.full_name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="f-13 fw-6 truncate">{u.full_name}</div>
                                                    <div className="f-11 text-mute">@{u.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><code className="f-12 fw-6">{u.student_id}</code></td>
                                        <td>
                                            <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}>
                                                {u.role === 'admin' ? <Shield size={10} /> : <UserCheck size={10} />} {u.role}
                                            </span>
                                        </td>
                                        <td>
                                            {st ? (
                                                <div>
                                                    <div className="f-12 fw-6">{st.total} exam{st.total !== 1 ? 's' : ''}</div>
                                                    <div className="f-11 text-mute">Avg {st.avgScore}%</div>
                                                </div>
                                            ) : <span className="f-12 text-mute">—</span>}
                                        </td>
                                        <td>
                                            {u.is_active === false
                                                ? <span className="badge badge-danger"><UserX size={10} /> Disabled</span>
                                                : u.must_change_password
                                                    ? <span className="badge badge-warning"><KeyRound size={10} /> Reset pending</span>
                                                    : <span className="badge badge-success">Active</span>}
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                {u.role === 'student' && onViewReport && (
                                                    <button className="btn btn-ghost btn-icon btn-sm" aria-label="View report"
                                                        onClick={() => onViewReport(u.id)}><BarChart3 size={15} /></button>
                                                )}
                                                <button className="btn btn-ghost btn-icon btn-sm" aria-label="Reset password"
                                                    onClick={() => setResetting(u)}><KeyRound size={15} /></button>
                                                <button className="btn btn-ghost btn-icon btn-sm" aria-label="Edit user"
                                                    onClick={() => setEditing(u)}><Edit3 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && <UserEditor user={editing} isMe={editing.id === me.id}
                onClose={() => setEditing(null)}
                onSaved={async () => { await refresh(); setEditing(null); toast.success('User updated.'); }} />}

            {resetting && <ResetPasswordModal user={resetting}
                onClose={() => setResetting(null)}
                onDone={async () => { await refresh(); }} />}
        </div>
    );
};

/* ─── Admin password reset ─────────────────────────────────────── */
const ResetPasswordModal = ({ user, onClose, onDone }) => {
    const toast = useToast();
    const [pw, setPw] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [copied, setCopied] = useState(false);

    const valid = checkPassword(pw).valid;

    const generate = () => { setPw(suggestPassword()); setError(''); };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(pw);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        } catch { toast.error('Could not copy. Please select the password and copy it by hand.'); }
    };

    const submit = async () => {
        setError(''); setLoading(true);
        try {
            await adminResetPassword(user.id, pw);
            setDone(true);
            await onDone();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    if (done) {
        return (
            <Modal open onClose={onClose} title="Password reset"
                subtitle={`New temporary password for ${user.full_name}`}
                footer={<Button onClick={onClose}>Done</Button>}>
                <Alert type="success" icon={Check}>
                    Give this password to {user.full_name}. They will be asked to choose their own the moment they sign in.
                </Alert>
                <div className="card card-pad card-soft mt-2 flex between center gap-2">
                    <code className="f-15 fw-7" style={{ letterSpacing: '.5px', wordBreak: 'break-all' }}>{pw}</code>
                    <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </div>
                <div className="hint mt-2">
                    Share it through a channel you trust. It will not be shown again after you close this window.
                </div>
            </Modal>
        );
    }

    return (
        <Modal open onClose={onClose} title="Reset password"
            subtitle={`${user.full_name} · ${user.student_id}`}
            footer={<>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button icon={KeyRound} onClick={submit} loading={loading} disabled={!valid}>
                    Reset Password
                </Button>
            </>}>
            {error && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{error}</Alert></div>}

            <Alert type="info" icon={KeyRound}>
                Students cannot reset their own passwords. Set a temporary one here and pass it to them directly.
            </Alert>

            <div className="mt-2">
                <PasswordField label="Temporary password" showMeter value={pw}
                    onChange={e => setPw(e.target.value)} placeholder="Type one, or generate a strong one" />
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={generate}>
                    Generate strong password
                </Button>
            </div>
        </Modal>
    );
};

/* ─── Edit user ────────────────────────────────────────────────── */
const UserEditor = ({ user, isMe, onClose, onSaved }) => {
    const toast = useToast();
    const [f, setF] = useState({
        full_name: user.full_name || '',
        phone: user.phone || '',
        role: user.role,
        is_active: user.is_active !== false,
    });
    const [loading, setLoading] = useState(false);

    const save = async () => {
        setLoading(true);
        try { await updateProfile(user.id, f); await onSaved(); }
        catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal open onClose={onClose} title="Edit User"
            subtitle={`@${user.username} · ${user.student_id}`}
            footer={<>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={save} loading={loading}>Save Changes</Button>
            </>}>
            <Input label="Full Name" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} />

            <Input label="Phone Number" optional value={f.phone}
                onChange={e => setF({ ...f, phone: e.target.value })}
                placeholder="01XXXXXXXXX" inputMode="numeric"
                hint="Optional. Leave blank if not needed." />

            <div className="field">
                <label className="label">Student ID <span className="label-optional">cannot be changed</span></label>
                <div className="input-icon">
                    <Hash size={17} />
                    <input className="input" value={user.student_id} disabled readOnly />
                </div>
            </div>

            <Select label="Role" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}
                options={[{ value: 'student', label: 'Student' }, { value: 'admin', label: 'Admin' }]}
                disabled={isMe}
                hint={isMe ? 'You cannot change your own role.' : 'Admins can manage everything in this portal.'} />

            <label className="checkbox-row">
                <input type="checkbox" checked={f.is_active} disabled={isMe}
                    onChange={e => setF({ ...f, is_active: e.target.checked })} />
                <div>
                    <div className="f-14 fw-6">Account active</div>
                    <div className="hint" style={{ marginTop: 2 }}>
                        {isMe ? 'You cannot disable your own account.' : 'Turn this off to block sign-in without deleting anything.'}
                    </div>
                </div>
            </label>
        </Modal>
    );
};
export default UserManager;
