// @vitest-environment jsdom
// B1/B2 (#59, #60): login stores the session, logout revokes it (PRJ-SR-003).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from './auth.js';

function reply(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('login', () => {
  it('stores the token under the single key "token"', async () => {
    fetch.mockResolvedValue(reply(200, { token: 'jwt', user: { id: 1, email: 'a@b.co' } }));
    await login('a@b.co', 'GreenTea2026x');

    expect(localStorage.getItem('token')).toBe('jwt');
    expect(localStorage.getItem('auth_token')).toBeNull();
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', password: 'GreenTea2026x' });
  });

  it('stores nothing when the reply has no token', async () => {
    fetch.mockResolvedValue(reply(200, {}));
    await expect(login('a@b.co', 'x')).rejects.toThrow('valid token');
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('logout', () => {
  it('calls POST /api/auth/logout with the token, clears the session and goes to login', async () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', '{}');
    fetch.mockResolvedValue(reply(200, { success: true }));

    await logout();

    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });

  it('still logs out of this browser when the server cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('token', 'jwt');
    fetch.mockRejectedValue(new TypeError('offline'));

    await expect(logout()).resolves.toBeUndefined();

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });

  it('makes no request when there is no session', async () => {
    await logout();
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/login');
  });
});
