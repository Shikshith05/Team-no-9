// @vitest-environment jsdom
// B1 (#59): the login and register forms against the backend's replies
// (PWM-F-001, PWM-F-002, PRJ-SR-005). Only fetch is replaced.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import ReportsPage from './ReportsPage.jsx';

function reply(status, body) {
  return new Response(JSON.stringify(body), { status });
}

function apiError(status, code, message, fields = []) {
  return reply(status, { error: { code, message, fields } });
}

function submitLogin(email = 'a@b.co', password = 'GreenTea2026x') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/login';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('stores the token and goes to the dashboard on success', async () => {
    fetch.mockResolvedValue(reply(200, { success: true, token: 'jwt', user: { id: 1 } }));
    render(<LoginPage />);
    submitLogin();

    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(localStorage.getItem('token')).toBe('jwt');
  });

  it('shows 401 invalid credentials and stays on the page', async () => {
    fetch.mockResolvedValue(apiError(401, 'UNAUTHORIZED', 'Invalid email or password.'));
    render(<LoginPage />);
    submitLogin();

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password.');
    expect(window.location.hash).toBe('#/login');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('shows 423 locked with the retry time', async () => {
    const message = 'Account locked after 5 failed attempts. Please retry in 15 minutes.';
    fetch.mockResolvedValue(apiError(423, 'ACCOUNT_LOCKED', message));
    render(<LoginPage />);
    submitLogin();

    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('shows 400 messages next to their fields', async () => {
    fetch.mockResolvedValue(
      apiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', [
        { field: 'email', message: 'Email is required.' },
        { field: 'password', message: 'Password is required.' },
      ]),
    );
    render(<LoginPage />);
    submitLogin();

    await screen.findByText('Email is required.');
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toBe('login-email-error');
  });

  it('asks for both fields before sending anything', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Please enter your email and password.');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('RegisterPage', () => {
  function submitRegister() {
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
  }

  it('shows 400 validation errors next to their fields', async () => {
    fetch.mockResolvedValue(
      apiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', [
        { field: 'password', message: 'Password must be at least 10 characters.' },
      ]),
    );
    render(<RegisterPage />);
    submitRegister();

    await screen.findByText('Password must be at least 10 characters.');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Please correct the highlighted fields.');
  });

  it('shows 409 on the email field', async () => {
    fetch.mockResolvedValue(
      apiError(409, 'CONFLICT', 'Email is already registered.', [
        { field: 'email', message: 'Email is already registered.' },
      ]),
    );
    render(<RegisterPage />);
    submitRegister();

    await waitFor(() => expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById('register-email-error').textContent).toBe('Email is already registered.');
  });

  it('confirms a successful registration', async () => {
    fetch.mockResolvedValue(reply(201, { success: true, user: { id: 1 } }));
    render(<RegisterPage />);
    submitRegister();

    expect((await screen.findByRole('status')).textContent).toContain('Account created');
  });
});

describe('ReportsPage', () => {
  it('sends the token from the shared helper and goes to login on a 401', async () => {
    localStorage.setItem('token', 'revoked');
    window.location.hash = '#/reports';
    fetch.mockResolvedValue(apiError(401, 'UNAUTHORIZED', 'Token has been revoked. Please log in again.'));
    render(<ReportsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(window.location.hash).toBe('#/login'));
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer revoked');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
