import React from 'react';

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

// ══ LINE / AREA CHART ═══════════════════════════════════════════
export const LineChart = ({ data = [], height = 210, color = '#4f46e5', label = '', maxY = 100 }) => {
    const W = 600, H = height, P = { t: 14, r: 14, b: 30, l: 34 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;

    if (!data.length) return <NoData height={height} />;

    const pts = data.map((d, i) => {
        const x = P.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
        const y = P.t + ih - (Math.min(d.value, maxY) / maxY) * ih;
        return { x, y, ...d };
    });

    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${path} L${pts[pts.length - 1].x.toFixed(1)},${P.t + ih} L${pts[0].x.toFixed(1)},${P.t + ih} Z`;
    const gid = `g${color.replace('#', '')}`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity=".28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map(t => {
                const y = P.t + ih - (t / 100) * ih;
                return (
                    <g key={t}>
                        <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
                        <text x={P.l - 7} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-mute)">{t}</text>
                    </g>
                );
            })}
            <path d={area} fill={`url(#${gid})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="var(--surface)" stroke={color} strokeWidth="2.2" />
                    <title>{p.label}: {p.value}{label}</title>
                </g>
            ))}
            {pts.map((p, i) => (
                (data.length <= 8 || i % Math.ceil(data.length / 7) === 0) && (
                    <text key={`x${i}`} x={p.x} y={H - 9} textAnchor="middle" fontSize="9.5" fill="var(--text-mute)">
                        {String(p.label).slice(0, 7)}
                    </text>
                )
            ))}
        </svg>
    );
};

// ══ BAR CHART ════════════════════════════════════════════════════
export const BarChart = ({ data = [], height = 210, color = '#4f46e5', maxY }) => {
    const W = 600, H = height, P = { t: 14, r: 14, b: 32, l: 34 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const top = maxY || Math.max(...data.map(d => d.value), 1) * 1.15;

    if (!data.length) return <NoData height={height} />;
    const bw = Math.min((iw / data.length) * 0.62, 52);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {[0, .25, .5, .75, 1].map(t => {
                const y = P.t + ih - t * ih;
                return (
                    <g key={t}>
                        <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
                        <text x={P.l - 7} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-mute)">{Math.round(top * t)}</text>
                    </g>
                );
            })}
            {data.map((d, i) => {
                const x = P.l + (i + 0.5) * (iw / data.length) - bw / 2;
                const h = (d.value / top) * ih;
                const y = P.t + ih - h;
                const c = d.color || color;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={bw} height={Math.max(h, 1.5)} rx="5" fill={c} opacity=".88">
                            <title>{d.label}: {d.value}</title>
                        </rect>
                        {h > 18 && <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-sub)">{d.value}</text>}
                        <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="9.5" fill="var(--text-mute)">
                            {String(d.label).slice(0, 9)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

// ══ DONUT CHART ══════════════════════════════════════════════════
export const DonutChart = ({ data = [], size = 168, thickness = 26, centerLabel, centerValue }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    const R = size / 2, r = R - thickness / 2;
    const C = 2 * Math.PI * r;

    let offset = 0;
    const segs = data.map((d, i) => {
        const frac = total > 0 ? d.value / total : 0;
        const seg = { ...d, dash: frac * C, offset, color: d.color || PALETTE[i % PALETTE.length], pct: (frac * 100).toFixed(0) };
        offset += frac * C;
        return seg;
    });

    return (
        <div className="flex center gap-3 wrap" style={{ justifyContent: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
                <circle cx={R} cy={R} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
                {total > 0 && segs.map((s, i) => (
                    <circle key={i} cx={R} cy={R} r={r} fill="none"
                        stroke={s.color} strokeWidth={thickness}
                        strokeDasharray={`${s.dash} ${C - s.dash}`}
                        strokeDashoffset={-s.offset}
                        transform={`rotate(-90 ${R} ${R})`}
                        strokeLinecap="butt">
                        <title>{s.label}: {s.value}</title>
                    </circle>
                ))}
                <text x={R} y={R - 3} textAnchor="middle" fontSize="25" fontWeight="800" fill="var(--text)">
                    {centerValue ?? total}
                </text>
                <text x={R} y={R + 16} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text-mute)">
                    {centerLabel ?? 'Total'}
                </text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {segs.map((s, i) => (
                    <div key={i} className="flex center gap-2">
                        <span style={{ width: 11, height: 11, borderRadius: 3.5, background: s.color, flexShrink: 0 }} />
                        <span className="f-12 fw-6">{s.label}</span>
                        <span className="f-12 text-mute" style={{ marginLeft: 'auto', paddingLeft: 10 }}>{s.value} ({s.pct}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ══ RADIAL PROGRESS ══════════════════════════════════════════════
export const RadialProgress = ({ value = 0, size = 120, thickness = 11, color, label }) => {
    const pct = Math.max(0, Math.min(100, value));
    const c = color || (pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444');
    const R = size / 2, r = R - thickness / 2, C = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={R} cy={R} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
            <circle cx={R} cy={R} r={r} fill="none" stroke={c} strokeWidth={thickness}
                strokeDasharray={`${(pct / 100) * C} ${C}`} strokeLinecap="round"
                transform={`rotate(-90 ${R} ${R})`}
                style={{ transition: 'stroke-dasharray .6s ease' }} />
            <text x={R} y={R + 2} textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill="var(--text)">{pct}%</text>
            {label && <text x={R} y={R + size * 0.17} textAnchor="middle" fontSize="9.5" fill="var(--text-mute)" fontWeight="600">{label}</text>}
        </svg>
    );
};

// ══ HORIZONTAL BARS ══════════════════════════════════════════════
export const HBars = ({ data = [] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    if (!data.length) return <NoData height={120} />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {data.map((d, i) => (
                <div key={i}>
                    <div className="flex between center f-12 mb-1">
                        <span className="fw-6">{d.label}</span>
                        <span className="text-sub fw-6">{d.value}{d.suffix || ''}</span>
                    </div>
                    <div className="progress">
                        <div className="progress-bar" style={{
                            width: `${(d.value / max) * 100}%`,
                            background: d.color || PALETTE[i % PALETTE.length]
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

const NoData = ({ height }) => (
    <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--text-mute)', fontSize: 13 }}>
        No data available yet
    </div>
);

export const ChartCard = ({ title, sub, children, action }) => (
    <div className="card card-pad">
        <div className="flex between center wrap gap-2 mb-2">
            <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</div>
                {sub && <div className="f-12 text-sub" style={{ marginTop: 2 }}>{sub}</div>}
            </div>
            {action}
        </div>
        {children}
    </div>
);

export { PALETTE };
