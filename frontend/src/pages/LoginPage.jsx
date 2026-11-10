
import { useState } from 'react';
import { login } from '../api/auth.js';
import { fieldErrors } from '../api/http.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFields({});

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
      window.location.hash = '#/';
    } catch (err) {
      // The backend's own words: 401 invalid credentials, 423 locked with the
      // retry time (PRJ-SR-005), 400 with messages per field.
      setFields(fieldErrors(err));
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
              aria-invalid={fields.email ? 'true' : undefined}
              aria-describedby={fields.email ? 'login-email-error' : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            {fields.email && (
              <p id="login-email-error" className="field-error">
                {fields.email}
              </p>
            )}
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
              aria-invalid={fields.password ? 'true' : undefined}
              aria-describedby={fields.password ? 'login-password-error' : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fields.password && (
              <p id="login-password-error" className="field-error">
                {fields.password}
              </p>
            )}
          </div>

          {error && (
            <p className="form-error" role="alert">
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
