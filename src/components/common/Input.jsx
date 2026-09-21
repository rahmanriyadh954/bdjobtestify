import React from 'react';
import { AlertCircle } from 'lucide-react';

export const Input = ({ label, optional, error, hint, icon: Icon, trail, ...props }) => (
    <div className="field">
        {label && <label className="label">{label}{optional && <span className="label-optional">optional</span>}</label>}
        <div className={Icon || trail ? 'input-icon' : ''}>
            {Icon && <Icon size={17} />}
            <input className={`input ${error ? 'input-err' : ''} ${trail ? 'input-trail' : ''}`} {...props} />
            {trail}
        </div>
        {error && <div className="err-text"><AlertCircle size={13} />{error}</div>}
        {hint && !error && <div className="hint">{hint}</div>}
    </div>
);

export const Select = ({ label, optional, error, hint, options = [], children, ...props }) => (
    <div className="field">
        {label && <label className="label">{label}{optional && <span className="label-optional">optional</span>}</label>}
        <select className={`select ${error ? 'input-err' : ''}`} {...props}>
            {children || options.map(o => (
                <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
            ))}
        </select>
        {error && <div className="err-text"><AlertCircle size={13} />{error}</div>}
        {hint && !error && <div className="hint">{hint}</div>}
    </div>
);

export const Textarea = ({ label, optional, error, hint, ...props }) => (
    <div className="field">
        {label && <label className="label">{label}{optional && <span className="label-optional">optional</span>}</label>}
        <textarea className={`textarea ${error ? 'input-err' : ''}`} {...props} />
        {error && <div className="err-text"><AlertCircle size={13} />{error}</div>}
        {hint && !error && <div className="hint">{hint}</div>}
    </div>
);

export const Alert = ({ type = 'info', icon: Icon, children }) => (
    <div className={`alert alert-${type}`}>
        {Icon && <Icon size={17} />}
        <div>{children}</div>
    </div>
);

export default Input;
