// @vitest-environment jsdom
// B2 (#60): Bearer token, SAD error shape, and what a 401 does (PRJ-SR-003).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDownload, apiFetch, fieldErrors } from './http.js';

function reply(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('apiFetch', () => {
  it('attaches the stored token as a Bearer header', async () => {
    localStorage.setItem('token', 'abc.def.ghi');
    fetch.mockResolvedValue(reply(200, { ok: true }));

    await expect(apiFetch('/api/assets')).resolves.toEqual({ ok: true });

    const [, init] = fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc.def.ghi');
    // The deviation from SAD 4.3.1: no cookies are involved.
    expect(init.credentials).toBeUndefined();
  });

  it('sends no Authorization header without a session', async () => {
    fetch.mockResolvedValue(reply(200, {}));
    await apiFetch('/api/health');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('sends a JSON body', async () => {
    fetch.mockResolvedValue(reply(200, {}));
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 } });
    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('turns the SAD error shape into an ApiError', async () => {
    localStorage.setItem('token', 't');
    fetch.mockResolvedValue(
      reply(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please correct the highlighted fields.',
          fields: [{ field: 'value', message: 'must be 0 or more' }],
        },
      }),
    );

    const error = await apiFetch('/api/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.' });
    expect(fieldErrors(error)).toEqual({ value: 'must be 0 or more' });
    // Anything other than a 401 leaves the session alone.
    expect(localStorage.getItem('token')).toBe('t');
  });

  it('survives an error reply that is not JSON (e.g. a proxy 502 page)', async () => {
    fetch.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 502, message: 'Request failed (502)' });
  });

  it('reports a network failure without touching the session', async () => {
    localStorage.setItem('token', 't');
    fetch.mockRejectedValue(new TypeError('failed'));
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(localStorage.getItem('token')).toBe('t');
  });
});

describe('a 401', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'expired');
    localStorage.setItem('user', '{"id":1}');
    fetch.mockResolvedValue(reply(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.', fields: [] } }));
  });

  it('clears the session and goes to the login page', async () => {
    await expect(apiFetch('/api/assets')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });

  it('does the same for a file download', async () => {
    await expect(apiDownload('/api/reports/export/csv', 'text/csv')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });

  it('on the login form is about the credentials, not a session', async () => {
    window.location.hash = '#/login';
    localStorage.clear();
    await expect(apiFetch('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid or expired token.',
    });
    expect(window.location.hash).toBe('#/login');
  });

  it('from an older request does not end a newer session', async () => {
    let answer;
    fetch.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const stale = apiFetch('/api/assets').catch((e) => e);

    localStorage.setItem('token', 'fresh'); // logged in again while it was in flight
    answer(reply(401, { error: { code: 'UNAUTHORIZED', message: 'x', fields: [] } }));

    expect((await stale).status).toBe(401);
    expect(localStorage.getItem('token')).toBe('fresh');
    expect(window.location.hash).toBe('#/');
  });
});

describe('apiDownload', () => {
  it('returns the file and sends the token and Accept header', async () => {
    localStorage.setItem('token', 't');
    fetch.mockResolvedValue(new Response('a,b\r\n1,2', { status: 200 }));

    const blob = await apiDownload('/api/reports/export/csv', 'text/csv');

    expect(await blob.text()).toBe('a,b\r\n1,2');
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/reports/export/csv');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t', Accept: 'text/csv' });
  });
});
