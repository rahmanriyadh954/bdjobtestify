// ═══════════════════════════════════════════════════════════════════════════
//  BD JobTestify — Security Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clean user text WITHOUT mangling it.
 *
 * Why this does NOT escape quotes into &quot; :
 * React escapes everything automatically when it renders. If we escaped text
 * here too, it would be escaped twice and the user would literally see
 * &quot; on screen. Since this app never uses dangerouslySetInnerHTML,
 * React's own escaping is the correct and complete protection.
 *
 * So here we only strip things that are genuinely dangerous or invisible:
 * null bytes, control characters, and any embedded <script>/<iframe> markup.
 */
export const cleanText = (input, maxLength = 20000) => {
    if (input === null || input === undefined) return '';
    let s = String(input);
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); // control chars
    s = s.replace(/<\s*\/?\s*(script|iframe|object|embed|link|meta)\b[^>]*>/gi, '');
    s = s.replace(/\son\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');        // onclick= etc
    s = s.replace(/javascript\s*:/gi, '');
    if (s.length > maxLength) s = s.slice(0, maxLength);
    return s;
};

/** Kept for backwards compatibility — same non-mangling behaviour. */
export const sanitizeInput = (input) => cleanText(input);

/** Use ONLY when injecting into raw HTML (we don't, but it's here if needed). */
export const escapeForHTML = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
};

/** Repair text that was double-escaped by the older version of this file. */
export const unescapeLegacy = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/&#x2F;/g, '/').replace(/&#x3D;/g, '=').replace(/&#96;/g, '`')
        .replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};

// ─── Password policy ───────────────────────────────────────────────────────
const COMMON_PASSWORDS = [
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
    'qwerty', 'qwerty123', 'abc123', 'admin', 'admin123', 'letmein', 'welcome',
    'monkey', 'dragon', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball',
    'master', 'shadow', 'superman', 'trustno1', 'bangladesh', 'dhaka123', '11111111',
    '00000000', 'asdfghjk', 'zxcvbnm', 'passw0rd', 'p@ssword', 'qwertyui',
];

export const PASSWORD_RULES = [
    { key: 'length', label: 'At least 8 characters',            test: p => p.length >= 8 },
    { key: 'upper',  label: 'One uppercase letter (A–Z)',        test: p => /[A-Z]/.test(p) },
    { key: 'lower',  label: 'One lowercase letter (a–z)',        test: p => /[a-z]/.test(p) },
    { key: 'number', label: 'One number (0–9)',                  test: p => /[0-9]/.test(p) },
    { key: 'symbol', label: 'One symbol (!@#$…)',                test: p => /[^A-Za-z0-9]/.test(p) },
    { key: 'common', label: 'Not a commonly used password',      test: p => !COMMON_PASSWORDS.includes(p.toLowerCase()) },
    { key: 'repeat', label: 'No character repeated 3+ times',    test: p => !/(.)\1{2,}/.test(p) },
    { key: 'seq',    label: 'No obvious sequence (123, abc)',    test: p => !/(012|123|234|345|456|567|678|789|abc|bcd|cde|def|xyz)/i.test(p) },
];

export const checkPassword = (password = '') => {
    const results = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(password) }));
    const passedCount = results.filter(r => r.passed).length;
    const valid = results.every(r => r.passed);
    let strength = 'weak';
    if (passedCount >= PASSWORD_RULES.length) strength = 'strong';
    else if (passedCount >= 6) strength = 'good';
    else if (passedCount >= 4) strength = 'fair';
    return { valid, results, strength, score: Math.round((passedCount / PASSWORD_RULES.length) * 100) };
};

export const validatePassword = (password) => checkPassword(password).valid;

export const firstPasswordError = (password) => {
    const { results } = checkPassword(password);
    const failed = results.find(r => !r.passed);
    return failed ? `Password needs: ${failed.label.toLowerCase()}` : null;
};

/** Suggest a password that satisfies every rule (for admin resets). */
export const suggestPassword = () => {
    const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz';
    const N = '23456789', S = '!@#$%&*?';
    const pick = (set, n) => Array.from({ length: n },
        () => set[Math.floor(Math.random() * set.length)]).join('');
    for (let attempt = 0; attempt < 40; attempt++) {
        const raw = pick(U, 2) + pick(L, 5) + pick(N, 3) + pick(S, 2);
        const shuffled = raw.split('').sort(() => Math.random() - 0.5).join('');
        if (checkPassword(shuffled).valid) return shuffled;
    }
    return 'Bd!Test' + Math.floor(Math.random() * 9000 + 1000) + '@x';
};

// ─── Other validators ──────────────────────────────────────────────────────
export const validateUsername = (username = '') => /^[a-z0-9_]{4,20}$/i.test(username);

export const usernameError = (username = '') => {
    if (!username.trim()) return 'Username is required';
    if (username.length < 4) return 'Username must be at least 4 characters';
    if (username.length > 20) return 'Username must be 20 characters or fewer';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Only letters, numbers and underscore allowed';
    return null;
};

export const validatePhoneNumber = (phone = '') => /^01[3-9]\d{8}$/.test(phone.replace(/\D/g, ''));

export const validateFullName = (name = '') => name.trim().length >= 3 && name.trim().length <= 60;

// ─── Rate limiter (client-side speed bump; the server is the real guard) ───
const _attempts = {};
const WINDOW = 15 * 60 * 1000;
const MAX_TRIES = 5;

export const rateLimiter = {
    check: (key) => {
        const a = _attempts[key];
        if (!a) return true;
        if (Date.now() - a.firstAttempt > WINDOW) { delete _attempts[key]; return true; }
        return a.count < MAX_TRIES;
    },
    record: (key) => {
        const now = Date.now();
        const a = _attempts[key];
        if (!a || now - a.firstAttempt > WINDOW) _attempts[key] = { count: 1, firstAttempt: now };
        else a.count++;
    },
    reset: (key) => { delete _attempts[key]; },
    getRemainingTime: (key) => {
        const a = _attempts[key];
        if (!a) return 0;
        const left = WINDOW - (Date.now() - a.firstAttempt);
        return left > 0 ? Math.ceil(left / 60000) : 0;
    },
};

// ─── Deterministic shuffle (same paper on reload, different per student) ───
export const seededShuffle = (arr, seed) => {
    const a = [...arr];
    let s = Math.abs(seed) || 1;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const seedFrom = (str = '') => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h || 1;
};

// ─── Local UI preferences only (never sensitive data) ─────────────────────
export const uiStore = {
    set: (k, v) => { try { localStorage.setItem(`bjt_${k}`, JSON.stringify(v)); } catch { /* ignore */ } },
    get: (k, fallback = null) => {
        try { const r = localStorage.getItem(`bjt_${k}`); return r ? JSON.parse(r) : fallback; }
        catch { return fallback; }
    },
    remove: (k) => { try { localStorage.removeItem(`bjt_${k}`); } catch { /* ignore */ } },
};
