import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetClientForTests,
  ApiError,
  apiRequest,
  buildApiUrl,
  clearSessionMemory,
  getAccessToken,
  normalizeBaseUrl,
  setSessionMemory,
} from '../client';

function createJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API Client & Session Token Lifecycle', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    _resetClientForTests();
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normalizes base URL and builds query strings cleanly', () => {
    expect(normalizeBaseUrl('http://localhost:3000/api/v1///')).toBe(
      'http://localhost:3000/api/v1'
    );
    expect(normalizeBaseUrl('')).toBe('http://localhost:3000/api/v1');

    const url = buildApiUrl('/users', {
      q: 'teacher',
      role: 'TEACHER',
      status: '',
      page: 2,
      page_size: 20,
    });
    expect(url).toContain('/users?q=teacher&role=TEACHER&page=2&page_size=20');
    expect(url).not.toContain('status=');
  });

  it('keeps access token strictly in memory and never writes to localStorage or sessionStorage', () => {
    setSessionMemory('secret-jwt-token', {
      id: '0199ac14-a9bc-7001-8000-000000000001',
      username: 'admin01',
      full_name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    expect(getAccessToken()).toBe('secret-jwt-token');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('deduplicates concurrent 401 refreshes into a single POST /auth/refresh and retries each request once', async () => {
    setSessionMemory('expired-token');

    let refreshCallCount = 0;
    let usersCallCount = 0;
    let meCallCount = 0;

    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const authHeader = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/auth/refresh')) {
        refreshCallCount += 1;
        await new Promise((r) => setTimeout(r, 25));
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'Token refreshed',
          data: {
            access_token: 'fresh-access-token',
            token_type: 'Bearer',
            expires_in: 900,
          },
        });
      }

      if (url.includes('/users')) {
        usersCallCount += 1;
        if (authHeader === 'Bearer expired-token') {
          return createJsonResponse(401, {
            success: false,
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Access Token is invalid or expired.',
          });
        }
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: [{ id: '1', username: 'u1', full_name: 'User 1', role: 'TEACHER', status: 'ACTIVE' }],
        });
      }

      if (url.endsWith('/auth/me')) {
        meCallCount += 1;
        if (authHeader === 'Bearer expired-token') {
          return createJsonResponse(401, {
            success: false,
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Access Token is invalid or expired.',
          });
        }
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: { id: '1', username: 'admin', full_name: 'Admin', role: 'ADMIN', status: 'ACTIVE' },
        });
      }

      return createJsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'Not found' });
    });

    const [usersRes, meRes] = await Promise.all([
      apiRequest('/users'),
      apiRequest('/auth/me'),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(usersCallCount).toBe(2);
    expect(meCallCount).toBe(2);
    expect(getAccessToken()).toBe('fresh-access-token');
    expect(usersRes.success).toBe(true);
    expect(meRes.success).toBe(true);
  });

  it('does not trigger token refresh on 401 INVALID_CURRENT_PASSWORD from PUT /auth/password', async () => {
    setSessionMemory('valid-token');
    let refreshCalled = false;

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalled = true;
      }
      return createJsonResponse(401, {
        success: false,
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect.',
      });
    });

    await expect(
      apiRequest('/auth/password', {
        method: 'PUT',
        body: { current_password: 'wrong', new_password: 'NewPassword!123' },
      })
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CURRENT_PASSWORD',
    });

    expect(refreshCalled).toBe(false);
    expect(getAccessToken()).toBe('valid-token');
  });

  it('does not confuse 403 FORBIDDEN with session expiration', async () => {
    setSessionMemory('teacher-token');
    let refreshCalled = false;

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshCalled = true;
      }
      return createJsonResponse(403, {
        success: false,
        code: 'FORBIDDEN',
        message: 'Admin permission is required.',
      });
    });

    await expect(apiRequest('/users')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });

    expect(refreshCalled).toBe(false);
    expect(getAccessToken()).toBe('teacher-token');
  });

  it('blocks stale in-flight responses after logout clears session memory', async () => {
    setSessionMemory('active-token');

    let resolveFetch!: (value: Response) => void;
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const pendingRequest = apiRequest('/users');

    // User logs out while /users is still in flight
    clearSessionMemory({ broadcast: false, reason: 'logout' });

    resolveFetch(
      createJsonResponse(200, {
        success: true,
        code: 'SUCCESS',
        message: 'OK',
        data: [],
      })
    );

    await expect(pendingRequest).rejects.toThrow(ApiError);
    await expect(pendingRequest).rejects.toMatchObject({
      code: 'SESSION_STALE',
      isStaleSession: true,
    });
  });
});
