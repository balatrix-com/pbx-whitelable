import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import './AcceptInvitePage.css';

/* ─────────────────────────────────────
   Password strength scorer
───────────────────────────────────── */
const getStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8)  score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd))           score++;
    if (/[^A-Za-z0-9]/.test(pwd))    score++;
    if (score <= 1) return { score, label: 'Weak',   color: '#f87171' };
    if (score === 2) return { score, label: 'Fair',   color: '#fb923c' };
    if (score === 3) return { score, label: 'Good',   color: '#facc15' };
    return              { score, label: 'Strong', color: '#4ade80' };
};

/* ─────────────────────────────────────
   Animated shield SVG
───────────────────────────────────── */
const ShieldSVG = () => (
    <svg viewBox="0 0 140 160" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ width: 110, height: 125 }}>
        {/* outer glow */}
        <ellipse cx="70" cy="148" rx="38" ry="7" fill="#6366f1" opacity="0.3" />

        {/* shield gradient defs */}
        <defs>
            <linearGradient id="sg1" x1="70" y1="8" x2="70" y2="128" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#c7d2fe" />
                <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="sg2" x1="70" y1="16" x2="70" y2="118" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#e0e7ff" />
                <stop offset="100%" stopColor="#a5b4fc" />
            </linearGradient>
            <linearGradient id="lock1" x1="54" y1="68" x2="86" y2="92" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>

        {/* shield body */}
        <path
            d="M70 8 L112 26 L112 72 C112 98 70 124 70 124 C70 124 28 98 28 72 L28 26 Z"
            fill="url(#sg1)"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            filter="url(#glow)"
        />
        {/* inner highlight */}
        <path
            d="M70 18 L104 33 L104 72 C104 93 70 114 70 114 C70 114 36 93 36 72 L36 33 Z"
            fill="url(#sg2)"
            opacity="0.55"
        />
        {/* checkered inner highlight strip */}
        <path
            d="M70 24 L70 32"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
        />

        {/* lock body */}
        <rect x="54" y="70" width="32" height="24" rx="6" fill="url(#lock1)"
            stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        {/* lock shackle */}
        <path
            d="M61 70 L61 62 C61 54.5 79 54.5 79 62 L79 70"
            stroke="url(#lock1)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
        />
        {/* keyhole circle */}
        <circle cx="70" cy="80" r="4" fill="white" opacity="0.9" />
        {/* keyhole slot */}
        <rect x="68.2" y="82" width="3.6" height="6" rx="1.8" fill="white" opacity="0.9" />

        {/* sparkle stars */}
        {/* top-left star */}
        <g opacity="0.85">
            <line x1="18" y1="34" x2="18" y2="40" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round"/>
            <line x1="15" y1="37" x2="21" y2="37" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round"/>
        </g>
        {/* top-right star */}
        <g opacity="0.7">
            <line x1="122" y1="28" x2="122" y2="32" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="120" y1="30" x2="124" y2="30" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round"/>
        </g>
        {/* right dots */}
        <circle cx="118" cy="55" r="3" fill="#818cf8" opacity="0.6" />
        <circle cx="125" cy="78" r="2" fill="#c7d2fe" opacity="0.5" />
        {/* left dots */}
        <circle cx="20" cy="60" r="2.5" fill="#a5b4fc" opacity="0.6" />
        <circle cx="14" cy="80" r="2" fill="#818cf8" opacity="0.4" />
        {/* bottom accents */}
        <circle cx="48" cy="132" r="2" fill="#a5b4fc" opacity="0.4" />
        <circle cx="92" cy="130" r="3" fill="#818cf8" opacity="0.35" />
    </svg>
);

/* ─────────────────────────────────────
   Loading dots
───────────────────────────────────── */
const LoadingDots = () => (
    <span className="aip-dots">
        <span className="aip-dot" />
        <span className="aip-dot" />
        <span className="aip-dot" />
    </span>
);

/* ═══════════════════════════════════════
   Main Page Component
═══════════════════════════════════════ */
const AcceptInvitePage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword]               = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword]       = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [loading, setLoading]                 = useState(false);
    const [error, setError]                     = useState('');
    const [success, setSuccess]                 = useState(false);
    const [pwFocused, setPwFocused]             = useState(false);
    const [cfFocused, setCfFocused]             = useState(false);

    useEffect(() => {
        if (!token) setError('Invalid or missing invitation token.');
    }, [token]);

    const strength = getStrength(password);
    const cfMismatch = confirmPassword.length > 0 && confirmPassword !== password;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (password.length < 8)          { setError('Password must be at least 8 characters.'); return; }

        setLoading(true);
        try {
            await api.post('/users/invite/accept', { token, password });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3200);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to accept invitation. The link may have expired.');
        } finally {
            setLoading(false);
        }
    };

    /* ── Success state ── */
    if (success) {
        return (
            <div className="aip-page">
                <div className="aip-blob aip-blob-1" />
                <div className="aip-blob aip-blob-2" />
                <div className="aip-spark aip-spark-1" />
                <div className="aip-spark aip-spark-3" />

                <div className="aip-success-wrap">
                    <div className="aip-success-ring">
                        <CheckCircle2 size={40} color="#4ade80" strokeWidth={2} />
                    </div>
                    <h2 className="aip-success-title">You're all set! 🎉</h2>
                    <p className="aip-success-sub">Your account has been successfully activated.</p>
                    <p className="aip-success-redirect">Redirecting you to login…</p>
                </div>
            </div>
        );
    }

    /* ── Main form ── */
    return (
        <div className="aip-page">
            {/* animated blobs */}
            <div className="aip-blob aip-blob-1" />
            <div className="aip-blob aip-blob-2" />
            <div className="aip-blob aip-blob-3" />

            {/* floating sparkles */}
            <div className="aip-spark aip-spark-1" />
            <div className="aip-spark aip-spark-2" />
            <div className="aip-spark aip-spark-3" />
            <div className="aip-spark aip-spark-4" />
            <div className="aip-spark aip-spark-5" />

            <div className="aip-card">

                {/* ════ LEFT — form ════ */}
                <div className="aip-form-side">
                    <p className="aip-eyebrow">✦ Invitation</p>
                    <h1 className="aip-title">Accept&nbsp;invitation</h1>
                    <p className="aip-subtitle">Create a password to activate your account.</p>

                    {error && (
                        <div className="aip-error">
                            <AlertCircle size={15} style={{ flexShrink: 0 }} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Password */}
                        <div className="aip-field">
                            <label className="aip-label">Password</label>
                            <div className="aip-input-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setPwFocused(true)}
                                    onBlur={() => setPwFocused(false)}
                                    required
                                    placeholder="••••••••••••"
                                    className="aip-input"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="aip-eye-btn"
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide' : 'Show'}
                                >
                                    {showPassword
                                        ? <EyeOff size={17} />
                                        : <Eye    size={17} />}
                                </button>
                            </div>

                            {/* strength bar */}
                            {password.length > 0 && (
                                <div className="aip-strength-row">
                                    <div className="aip-strength-track">
                                        <div
                                            className="aip-strength-fill"
                                            style={{
                                                width: `${(strength.score / 5) * 100}%`,
                                                background: strength.color,
                                                boxShadow: `0 0 8px ${strength.color}88`,
                                            }}
                                        />
                                    </div>
                                    <span className="aip-strength-label" style={{ color: strength.color }}>
                                        {strength.label}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div className="aip-field">
                            <label className="aip-label">Confirm Password</label>
                            <div className="aip-input-wrap">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    onFocus={() => setCfFocused(true)}
                                    onBlur={() => setCfFocused(false)}
                                    required
                                    placeholder="••••••••••••"
                                    className={`aip-input${cfMismatch ? ' aip-input-error' : ''}`}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="aip-eye-btn"
                                    onClick={() => setShowConfirm(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showConfirm ? 'Hide' : 'Show'}
                                >
                                    {showConfirm
                                        ? <EyeOff size={17} />
                                        : <Eye    size={17} />}
                                </button>
                            </div>
                            {cfMismatch && (
                                <span style={{ fontSize: 11, color: '#f87171', marginTop: 4, display: 'block' }}>
                                    Passwords don't match
                                </span>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !token || cfMismatch}
                            className="aip-btn"
                        >
                            {loading ? <LoadingDots /> : 'Activate Account'}
                        </button>
                    </form>

                    <div className="aip-divider">
                        <span className="aip-divider-line" />
                        <span className="aip-divider-text">Secured with end-to-end encryption</span>
                        <span className="aip-divider-line" />
                    </div>
                </div>

                {/* ════ RIGHT — illustration ════ */}
                <div className="aip-illus-side">
                    <div className="aip-shield-wrap">
                        <ShieldSVG />
                    </div>

                    <div className="aip-illus-badge">
                        <span className="aip-illus-badge-dot" />
                        Secure Link
                    </div>

                    <p className="aip-illus-text">
                        A stronger password helps keep your account and team safe.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default AcceptInvitePage;
