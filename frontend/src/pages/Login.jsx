import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const styles = {
  page: { minHeight: '100vh', display: 'flex', background: 'var(--bg)' },

  // Left brand panel (deep green, editorial)
  brand: {
    flex: '1.05', position: 'relative', overflow: 'hidden',
    background: 'radial-gradient(120% 120% at 0% 0%, #243029 0%, #19211C 55%, #131A16 100%)',
    color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '54px 56px',
  },
  brandTop: { display: 'flex', alignItems: 'center', gap: '13px' },
  logoBox: {
    width: '50px', height: '50px', borderRadius: '14px',
    background: '#1F6F54', color: '#E7C988',
    border: '1px solid rgba(199,154,75,0.55)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: '26px', letterSpacing: '0.5px',
  },
  wordmark: { fontFamily: "'Fraunces', Georgia, serif", fontSize: '22px', fontWeight: 600, letterSpacing: '0.2px' },
  wordmarkSub: { fontSize: '12px', color: '#8A9690', marginTop: '1px' },
  heroWrap: { maxWidth: '420px' },
  hero: { fontFamily: "'Fraunces', Georgia, serif", fontSize: '38px', lineHeight: 1.15, fontWeight: 600, letterSpacing: '-0.5px' },
  heroAccent: { color: '#C79A4B' },
  heroSub: { fontSize: '15px', color: '#AEB8B1', marginTop: '18px', lineHeight: 1.6 },
  brandFoot: { fontSize: '12px', color: '#6B756F' },
  rule: { width: '46px', height: '3px', background: '#C79A4B', borderRadius: '3px', marginBottom: '22px' },

  // Right form panel
  formSide: { flex: '0.95', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
  card: { width: '100%', maxWidth: '380px' },
  title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: '26px', fontWeight: 600, color: 'var(--text-1)', margin: 0 },
  subtitle: { fontSize: '14px', color: 'var(--text-3)', marginTop: '6px', marginBottom: '30px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '7px' },
  input: {
    width: '100%', padding: '12px 14px', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', fontSize: '14.5px', marginBottom: '18px', boxSizing: 'border-box',
    outline: 'none', color: 'var(--text-1)', background: 'var(--surface)', transition: 'border-color .15s, box-shadow .15s',
  },
  button: {
    width: '100%', padding: '13px', background: 'var(--primary)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius)', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px',
    boxShadow: 'var(--shadow-sm)', transition: 'background .15s',
  },
  error: {
    background: 'var(--danger-dim)', border: '1px solid rgba(192,73,47,0.3)', borderRadius: 'var(--radius)',
    padding: '11px 13px', color: 'var(--danger)', fontSize: '13px', marginBottom: '18px',
  },
  foot: { fontSize: '12px', color: 'var(--text-4)', marginTop: '26px', textAlign: 'center' },
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/login', { email, password });
      const { token, user } = res.data.data;
      localStorage.setItem('fg_token', token);
      localStorage.setItem('fg_user', JSON.stringify(user));
      navigate('/items');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (name) => ({
    ...styles.input,
    ...(focus === name ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 3px var(--primary-dim)' } : {}),
  });

  return (
    <div style={styles.page}>
      {/* Brand panel */}
      <div style={styles.brand}>
        <div style={styles.brandTop}>
          <div style={styles.logoBox}>BE</div>
          <div>
            <div style={styles.wordmark}>Book Ends</div>
            <div style={styles.wordmarkSub}>Store · Surat</div>
          </div>
        </div>
        <div style={styles.heroWrap}>
          <div style={styles.rule} />
          <div style={styles.hero}>Every product,<br />counted to the <span style={styles.heroAccent}>last gram</span>.</div>
          <div style={styles.heroSub}>Scan goods in, dispatch them out, and watch stock, batches and expiry update in real time — built for the way your store actually works.</div>
        </div>
        <div style={styles.brandFoot}>© 2026 Book Ends Store · Surat</div>
      </div>

      {/* Form panel */}
      <div style={styles.formSide}>
        <div style={styles.card}>
          <p style={styles.title}>Welcome back</p>
          <p style={styles.subtitle}>Sign in to manage your inventory.</p>
          <form onSubmit={handleSubmit}>
            {error && <div style={styles.error}>{error}</div>}
            <label style={styles.label}>Email</label>
            <input
              style={inputStyle('email')} type="email" value={email}
              onChange={e => setEmail(e.target.value)} onFocus={() => setFocus('email')} onBlur={() => setFocus('')}
              placeholder="admin@fg.local" required autoFocus
            />
            <label style={styles.label}>Password</label>
            <input
              style={inputStyle('password')} type="password" value={password}
              onChange={e => setPassword(e.target.value)} onFocus={() => setFocus('password')} onBlur={() => setFocus('')}
              placeholder="••••••••" required
            />
            <button
              style={{ ...styles.button, background: loading ? 'var(--primary-hover)' : 'var(--primary)' }}
              type="submit" disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <div style={styles.foot}>Authorised staff only · Contact your administrator for access</div>
        </div>
      </div>
    </div>
  );
}
