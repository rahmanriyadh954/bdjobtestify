import React from 'react';

export const Card = ({ children, hover, pad = true, soft, className = '', ...props }) => (
    <div className={`card ${pad ? 'card-pad' : ''} ${hover ? 'card-hover' : ''} ${soft ? 'card-soft' : ''} ${className}`} {...props}>
        {children}
    </div>
);

export const StatCard = ({ icon: Icon, label, value, color = 'var(--brand)', sub }) => (
    <div className="card stat-card card-hover">
        <div className="stat-icon" style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}>
            {Icon && <Icon size={22} />}
        </div>
        <div style={{ minWidth: 0 }}>
            <div className="stat-val">{value}</div>
            <div className="stat-lbl">{label}</div>
            {sub && <div className="f-11 text-mute" style={{ marginTop: 3 }}>{sub}</div>}
        </div>
    </div>
);

export const PageHead = ({ title, sub, action }) => (
    <header className="page-head">
        <div>
            <h1 className="page-title">{title}</h1>
            {sub && <p className="page-sub">{sub}</p>}
        </div>
        {action}
    </header>
);

export const SearchBox = ({ value, onChange, placeholder = 'Search…', width = 320 }) => (
    <div className="input-icon" style={{ flex: 1, minWidth: 190, maxWidth: width }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input className="input" value={value} onChange={onChange} placeholder={placeholder} type="search" />
    </div>
);
export default Card;
