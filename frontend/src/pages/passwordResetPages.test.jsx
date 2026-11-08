// @vitest-environment jsdom
// B24: the forgot and reset password pages against the backend's replies
// (PWM-F-003, TC-Auth-03; SAD 4.3.4). Only fetch is replaced.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from './ForgotPasswordPage.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';

const reply = (status, body) => new Response(JSON.stringify(body), { status });
const apiError = (status, code, message, fields = []) => reply(status, { error: { code, message, fields } });
const sentBody = () => JSON.parse(fetch.mock.calls.at(-1)[1].body);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ForgotPasswordPage', () => {
  it('posts the email and shows the same "check your email" message as the API', async () => {
    fetch.mockResolvedValue(reply(202, { success: true, message: 'If an account exists…' }));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' user@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect((await screen.findByTestId('reset-requested')).textContent).toContain('If an account exists for that email');
    expect(fetch.mock.calls[0][0]).toBe('/api/auth/forgot-password');
    expect(sentBody()).toEqual({ email: 'user@example.com' });
  });

  it('shows a server field error on the email input', async () => {
    fetch.mockResolvedValue(
      apiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', [
        { field: 'email', message: 'Enter a valid email address, like name@example.com.' },
      ]),
    );
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect((await screen.findByText('Enter a valid email address, like name@example.com.')).id).toBe('forgot-email-error');
  });
});

describe('ResetPasswordPage', () => {
  function submit(password = 'BlueRiver2027y', confirmation = password) {
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirmation } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  }

  it('sends {token, password}, shows success and drops this browser\'s old session', async () => {
    localStorage.setItem('token', 'old-jwt');
    fetch.mockResolvedValue(reply(200, { success: true }));
    render(<ResetPasswordPage token="abc123" />);
    submit();

    expect((await screen.findByTestId('reset-done')).textContent).toContain('You can now log in with your new password.');
    expect(fetch.mock.calls[0][0]).toBe('/api/auth/reset-password');
    expect(sentBody()).toEqual({ token: 'abc123', password: 'BlueRiver2027y' });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it.each([
    ['RESET_TOKEN_EXPIRED', 'This reset link has expired.', 'reset-link-expired'],
    ['RESET_TOKEN_USED', 'This reset link has already been used.', 'reset-link-used'],
    ['RESET_TOKEN_INVALID', 'This reset link is not valid.', 'reset-link-invalid'],
  ])('%s shows its own screen with a way to request a new link', async (code, message, testId) => {
    fetch.mockResolvedValue(apiError(400, code, message, [{ field: 'token', message }]));
    render(<ResetPasswordPage token="abc123" />);
    submit();

    const screenEl = await screen.findByTestId(testId);
    expect(screenEl.querySelector('a[href="#/forgot-password"]')).toBeTruthy();
  });

  it('a weak password rejected by the server is shown on the password field', async () => {
    fetch.mockResolvedValue(
      apiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', [
        { field: 'password', message: 'This password is too common. Choose another one.' },
      ]),
    );
    render(<ResetPasswordPage token="abc123" />);
    submit('Password1234');

    await waitFor(() =>
      expect(document.getElementById('new-password-error')?.textContent).toBe('This password is too common. Choose another one.'),
    );
    expect(screen.getByLabelText('New password').getAttribute('aria-invalid')).toBe('true');
  });

  it('a password that fails the policy in the browser is never sent', () => {
    render(<ResetPasswordPage token="abc123" />);
    submit('short1');
    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById('new-password-error').textContent).toBe('Use at least 10 characters.');
  });

  it('without a token the link is invalid straight away', () => {
    render(<ResetPasswordPage token="" />);
    expect(screen.getByTestId('reset-link-invalid')).toBeTruthy();
  });
});
