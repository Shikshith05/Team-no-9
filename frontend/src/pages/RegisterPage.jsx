
import { useState } from 'react';
import { register } from '../api/auth.js';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      setMessage('Account created successfully! You can now log in.');
      setTimeout(() => {
        window.location.hash = '#/login';
      }, 1200);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page auth-page">
      <div className="card auth-card">
        <h1>Create account</h1>

        <form className="form" noValidate onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="register-name">Full name</label>
            <input
              id="register-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="form-note" role="alert">{error}</p>}
          {message && <p className="form-note" role="status">{message}</p>}

          <button className="button button-block" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p>
          Already have an account? <a className="text-link" href="#/login">Log in</a>
        </p>
      </div>
    </main>
  );
}
