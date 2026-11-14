import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetClientForTests } from '../../../api/client';
import { AppRoutes } from '../../../App';
import { _resetAuthBootstrapForTests, AuthProvider } from '../AuthContext';
import type { AuthUser } from '../types';
import { getSafeRedirectPath } from '../utils/redirect';

function createJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAppAt(initialEntry: string) {
  return render(
    <StrictMode>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </StrictMode>
  );
}

describe('Auth Lifecycle, StrictMode Bootstrap, Sidebar & Mobile Drawer, Role Route Guards', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    _resetClientForTests();
    _resetAuthBootstrapForTests();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getSafeRedirectPath', () => {
    it('allows valid internal paths and blocks external or disallowed paths', () => {
      expect(getSafeRedirectPath('/admin/users?page=2', 'ADMIN')).toBe(
        '/admin/users?page=2'
      );
      expect(getSafeRedirectPath('https://evil.example.com', 'ADMIN')).toBe(
        '/admin/users'
      );
      expect(getSafeRedirectPath('//evil.example.com', 'ADMIN')).toBe(
        '/admin/users'
      );
      expect(getSafeRedirectPath('javascript:alert(1)', 'ADMIN')).toBe(
        '/admin/users'
      );
      expect(getSafeRedirectPath('/login', 'TEACHER')).toBe('/');
      expect(getSafeRedirectPath('/admin/users', 'TEACHER')).toBe('/');
      expect(getSafeRedirectPath('/account/password', 'STUDENT')).toBe('/');
    });
  });

  it('deduplicates session bootstrap in React StrictMode, renders role sidebar with aria-current, and supports mobile drawer with Escape focus return', async () => {
    const user = userEvent.setup();
    let refreshCount = 0;
    let meCount = 0;

    const adminUser: AuthUser = {
      id: '0199ac14-a9bc-7001-8000-000000000001',
      username: 'admin_test',
      full_name: 'Quản trị viên Hệ thống',
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: { access_token: 'restored-token', token_type: 'Bearer', expires_in: 900 },
        });
      }
      if (url.endsWith('/auth/me')) {
        meCount += 1;
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: adminUser,
        });
      }
      return createJsonResponse(200, {
        success: true,
        code: 'SUCCESS',
        message: 'OK',
        data: [],
        meta: { page: 1, page_size: 20, total_items: 0, total_pages: 0 },
      });
    });

    renderAppAt('/');

    expect(
      screen.getByText(/Đang mở không gian làm việc OLMS/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Xin chào, Quản trị viên Hệ thống/i })
      ).toBeInTheDocument();
    });

    expect(refreshCount).toBe(1);
    expect(meCount).toBe(1);

    // Sidebar navigation links for ADMIN + aria-current="page"
    const overviewLink = screen.getByRole('link', { name: 'Tổng quan' });
    expect(overviewLink).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getAllByRole('link', { name: 'Quản lý tài khoản' }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Đổi mật khẩu' }).length
    ).toBeGreaterThan(0);

    // Mobile drawer open -> Escape -> closes and restores focus to trigger button
    const menuTrigger = screen.getByRole('button', { name: 'Mở menu điều hướng' });
    await user.click(menuTrigger);
    expect(
      screen.getByRole('dialog', { name: 'Thanh điều hướng ứng dụng' })
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'Thanh điều hướng ứng dụng' })
    ).not.toBeInTheDocument();
    expect(menuTrigger).toHaveFocus();
  });

  it('redirects unauthenticated users to /login and logs in successfully', async () => {
    const user = userEvent.setup();

    const teacherUser: AuthUser = {
      id: '0199ac14-a9bc-7001-8000-000000000002',
      username: 'teacher01',
      full_name: 'Giáo viên Nguyễn Văn A',
      role: 'TEACHER',
      status: 'ACTIVE',
    };

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return createJsonResponse(401, {
          success: false,
          code: 'REFRESH_TOKEN_MISSING',
          message: 'Refresh Token is required.',
        });
      }
      if (url.endsWith('/auth/login')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'Login successful.',
          data: {
            access_token: 'teacher-jwt',
            token_type: 'Bearer',
            expires_in: 900,
            user: teacherUser,
          },
        });
      }
      return createJsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'Not found' });
    });

    renderAppAt('/account/password');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Đăng nhập hệ thống OLMS/i })
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Tên đăng nhập/i), 'teacher01');
    await user.type(screen.getByLabelText(/^Mật khẩu$/i), 'ValidPass!123');
    await user.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    // Should redirect back to requested /account/password for TEACHER
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Đổi mật khẩu cá nhân/i })
      ).toBeInTheDocument();
    });

    // TEACHER must NOT see Quản lý tài khoản link in nav
    expect(
      screen.queryByRole('link', { name: 'Quản lý tài khoản' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('shows 403 Forbidden page when STUDENT accesses /account/password and hides admin/teacher nav links', async () => {
    const studentUser: AuthUser = {
      id: '0199ac14-a9bc-7001-8000-000000000003',
      username: 'student01',
      full_name: 'Sinh viên Trần Thị B',
      role: 'STUDENT',
      status: 'ACTIVE',
    };

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: { access_token: 'student-token', token_type: 'Bearer', expires_in: 900 },
        });
      }
      if (url.endsWith('/auth/me')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: studentUser,
        });
      }
      return createJsonResponse(403, {
        success: false,
        code: 'FORBIDDEN',
        message: 'Forbidden',
      });
    });

    renderAppAt('/account/password');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Bạn không có quyền truy cập trang này/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Từ chối truy cập \(403\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Quản lý tài khoản' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Đổi mật khẩu' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tổng quan' })).toBeInTheDocument();
  });

  it('displays remote session close warning if POST /auth/logout fails instead of claiming full remote logout', async () => {
    const user = userEvent.setup();

    const adminUser: AuthUser = {
      id: '0199ac14-a9bc-7001-8000-000000000001',
      username: 'admin01',
      full_name: 'Quản trị viên',
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: { access_token: 'admin-token', token_type: 'Bearer', expires_in: 900 },
        });
      }
      if (url.endsWith('/auth/me')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: adminUser,
        });
      }
      if (url.endsWith('/auth/logout')) {
        return createJsonResponse(500, {
          success: false,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database unreachable',
        });
      }
      return createJsonResponse(200, { success: true, code: 'SUCCESS', message: 'OK', data: [] });
    });

    renderAppAt('/');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đăng xuất/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Đăng xuất/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Đăng nhập hệ thống OLMS/i })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/chưa thể kết nối để đóng phiên từ xa/i)
    ).toBeInTheDocument();
  });

  it('handles change password errors (401 INVALID_CURRENT_PASSWORD) without logging out and redirects to /login on 200 SUCCESS', async () => {
    const user = userEvent.setup();

    const teacherUser: AuthUser = {
      id: '0199ac14-a9bc-7001-8000-000000000002',
      username: 'teacher_pw',
      full_name: 'Giáo viên Đổi MK',
      role: 'TEACHER',
      status: 'ACTIVE',
    };

    let passwordAttempt = 0;

    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url.endsWith('/auth/refresh')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: { access_token: 'teacher-token', token_type: 'Bearer', expires_in: 900 },
        });
      }
      if (url.endsWith('/auth/me')) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: teacherUser,
        });
      }
      if (url.endsWith('/auth/password') && method === 'PUT') {
        passwordAttempt += 1;
        if (passwordAttempt === 1) {
          return createJsonResponse(401, {
            success: false,
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect.',
          });
        }
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'Password changed successfully.',
          data: {},
        });
      }
      return createJsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'Not found' });
    });

    renderAppAt('/account/password');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Đổi mật khẩu cá nhân/i })
      ).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/i), 'WrongCurrent!1');
    await user.type(screen.getByLabelText(/^Mật khẩu mới$/i), 'NewStrong!2026');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới/i), 'NewStrong!2026');
    await user.click(screen.getByRole('button', { name: /^Đổi mật khẩu$/i }));

    // First attempt returns 401 INVALID_CURRENT_PASSWORD -> stays on page and shows error
    await waitFor(() => {
      expect(
        screen.getAllByText(/Mật khẩu hiện tại không chính xác/i).length
      ).toBeGreaterThan(0);
    });
    expect(
      screen.getByRole('heading', { name: /Đổi mật khẩu cá nhân/i })
    ).toBeInTheDocument();

    // Second attempt succeeds -> clears session and redirects to /login with security banner
    await user.clear(screen.getByLabelText(/Mật khẩu hiện tại/i));
    await user.type(screen.getByLabelText(/Mật khẩu hiện tại/i), 'RightCurrent!1');
    await user.click(screen.getByRole('button', { name: /^Đổi mật khẩu$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Đăng nhập hệ thống OLMS/i })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Đã đổi mật khẩu\. Bạn đã được đăng xuất khỏi mọi thiết bị/i)
    ).toBeInTheDocument();
  });
});
