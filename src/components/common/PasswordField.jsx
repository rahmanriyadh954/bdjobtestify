import React, { useState, useMemo } from 'react';
import { Lock, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';
import { checkPassword } from '../../utils/security';

const TONE = {
    weak:   { color: 'var(--danger)',  label: 'Weak' },
    fair:   { color: 'var(--warning)', label: 'Fair' },
    good:   { color: 'var(--accent)',  label: 'Good' },
    strong: { color: 'var(--success)', label: 'Strong' },
};

export const PasswordField = ({
    label = 'Password', value, onChange, error, placeholder = 'Enter a strong password',
    showMeter = false, autoComplete = 'new-password', ...props
}) => {
    const [show, setShow] = useState(false);
    const check = useMemo(() => checkPassword(value || ''), [value]);
    const tone = TONE[check.strength];

    return (
        <div className="field">
            {label && <label className="label">{label}</label>}
            <div className="input-icon">
                <Lock size={17} />
                <input
                    className={`input input-trail ${error ? 'input-err' : ''}`}
                    type={show ? 'text' : 'password'}
                    value={value} onChange={onChange}
                    placeholder={placeholder} autoComplete={autoComplete}
                    {...props}
                />
                <button type="button" className="trail-btn" onClick={() => setShow(s => !s)}
                    aria-label={show ? 'Hide password' : 'Show password'} tabIndex={-1}>
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
            </div>

            {error && <div className="err-text"><AlertCircle size={13} />{error}</div>}

            {showMeter && value && (
                <div className="mt-1">
                    <div className="flex between center mb-1">
                        <span className="f-11 text-sub fw-6">Password strength</span>
                        <span className="f-11 fw-7" style={{ color: tone.color }}>{tone.label}</span>
                    </div>
                    <div className="pw-bar">
                        <div className="pw-fill" style={{ width: `${check.score}%`, background: tone.color }} />
                    </div>
                    <div className="mt-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: '0 14px' }}>
                        {check.results.map(r => (
                            <div key={r.key} className="pw-rule" style={{ color: r.passed ? 'var(--success)' : 'var(--text-mute)' }}>
                                {r.passed ? <Check size={13} /> : <X size={13} />}
                                <span>{r.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
export default PasswordField;
