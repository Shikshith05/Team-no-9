
import { useState } from 'react';
import { login } from '../api/auth.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
      window.location.hash = '#/';
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page auth-page">
      <div className="card auth-card">
        <h1 tabIndex={-1}>Log in</h1>

        <form className="form" noValidate onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              className="input"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <div className="field-label-row">
              <label htmlFor="login-password">Password</label>
              <a className="text-link" href="#/forgot-password">
                Forgot password?
              </a>
            </div>

            <input
              id="login-password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className="form-note" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="button button-block"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p>
          Don't have an account?{' '}
          <a className="text-link" href="#/register">
            Register
          </a>
        </p>
      </div>
    </main>
  );
}
