import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(email, password);
      if (ok) navigate('/');
      else setError('Invalid credentials. Please try again.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">R</div>
          <div>
            <h1>Raah<span>Go</span></h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Admin Panel</p>
          </div>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to your admin account to continue</p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <Mail size={16} className="auth-input-icon" />
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-input-group" style={{ position: 'relative' }}>
            <Lock size={16} className="auth-input-icon" />
            <input
              className="auth-input"
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer'
              }}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <div style={{ textAlign: 'right', marginBottom: 20, marginTop: -6 }}>
            <a href="#" style={{ fontSize: 12, color: 'var(--accent-primary)' }}>Forgot password?</a>
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>RaahGo Admin v1.0 &nbsp;·&nbsp; <a href="#">Privacy Policy</a></p>
        </div>
      </div>
    </div>
  );
}
