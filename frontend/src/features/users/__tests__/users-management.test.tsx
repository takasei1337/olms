import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetClientForTests } from '../../../api/client';
import { AppRoutes } from '../../../App';
import { _resetAuthBootstrapForTests, AuthProvider } from '../../auth/AuthContext';
import type { AuthUser } from '../../auth/types';
import { _clearUserMetadataCacheForTests } from '../users.api';

function createJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ADMIN_USER: AuthUser = {
  id: '0199ac14-a9bc-7001-8000-000000000001',
  username: 'admin_main',
  full_name: 'Quản trị viên Chính',
  role: 'ADMIN',
  status: 'ACTIVE',
};

const TEACHER_ROW = {
  id: '0199ac14-a9bc-7001-8000-000000000002',
  username: 'teacher_alpha',
  full_name: 'Giáo viên Nguyễn Thị Alpha',
  role: 'TEACHER' as const,
  status: 'ACTIVE' as const,
};

describe('ADMIN Users Management Page', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    _resetClientForTests();
    _resetAuthBootstrapForTests();
    _clearUserMetadataCacheForTests();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('loads user list, copies username, disables self-lock/self-delete in Thao tác menu, and executes create, status lock, reset password, and delete flows', async () => {
    const user = userEvent.setup();
    let currentRows = [ADMIN_USER, { ...TEACHER_ROW }];
    let lastResetBody: unknown = null;
    let lastStatusBody: unknown = null;

    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

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
          data: ADMIN_USER,
        });
      }

      if (url.includes('/users') && method === 'GET' && !url.includes(`/users/${TEACHER_ROW.id}`)) {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'Users retrieved successfully.',
          data: currentRows,
          meta: {
            page: 1,
            page_size: 20,
            total_items: currentRows.length,
            total_pages: 1,
          },
        });
      }

      if (url.endsWith('/users') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        const created = {
          id: '0199ac14-a9bc-7001-8000-000000000009',
          username: body.username,
          full_name: body.full_name,
          email: body.email,
          role: body.role,
          status: 'ACTIVE' as const,
        };
        currentRows = [...currentRows, created];
        return createJsonResponse(201, {
          success: true,
          code: 'SUCCESS',
          message: 'User created successfully.',
          data: created,
        });
      }

      if (url.endsWith(`/users/${TEACHER_ROW.id}/status`) && method === 'PATCH') {
        lastStatusBody = JSON.parse(String(init?.body));
        const updated = { ...TEACHER_ROW, status: 'LOCKED' as const };
        currentRows = currentRows.map((r) => (r.id === TEACHER_ROW.id ? updated : r));
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'User status updated successfully.',
          data: updated,
        });
      }

      if (url.endsWith(`/users/${TEACHER_ROW.id}/reset-password`) && method === 'POST') {
        lastResetBody = JSON.parse(String(init?.body));
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'User password reset successfully.',
          data: {},
        });
      }

      if (url.endsWith(`/users/${TEACHER_ROW.id}`) && method === 'DELETE') {
        currentRows = currentRows.filter((r) => r.id !== TEACHER_ROW.id);
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'User deleted successfully.',
          data: {},
        });
      }

      return createJsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'Not found' });
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/users']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('@teacher_alpha')).toBeInTheDocument();
    });

    // Copy username button works and announces "Đã sao chép"
    const copyTeacherUsernameBtn = screen.getByRole('button', {
      name: 'Sao chép tên đăng nhập teacher_alpha',
    });
    await user.click(copyTeacherUsernameBtn);
    expect(
      screen.getByRole('button', { name: /Đã sao chép: teacher_alpha/i })
    ).toBeInTheDocument();

    // Open "Thao tác" menu for admin_main -> self-lock and self-delete must be disabled with clear explanation
    await user.click(
      screen.getByRole('button', { name: 'Thao tác cho tài khoản admin_main' })
    );
    const adminMenu = await screen.findByRole('menu');
    expect(
      within(adminMenu).getByRole('menuitem', { name: /Khóa tài khoản/i })
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(adminMenu).getByText(/Không thể tự khóa tài khoản đang đăng nhập/i)
    ).toBeInTheDocument();
    expect(
      within(adminMenu).getByRole('menuitem', { name: /Xóa tài khoản/i })
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(adminMenu).getByText(/Không thể tự xóa tài khoản đang đăng nhập/i)
    ).toBeInTheDocument();

    // Close admin_main menu with Escape
    await user.keyboard('{Escape}');

    // 1. Create a new teacher account
    await user.click(screen.getByRole('button', { name: /^Tạo tài khoản$/i }));
    const createDialog = await screen.findByRole('dialog');
    await user.type(within(createDialog).getByLabelText(/Tên đăng nhập/i), 'teacher_beta');
    await user.type(within(createDialog).getByLabelText(/Họ và tên/i), 'Giáo viên Beta');
    await user.type(
      within(createDialog).getByLabelText(/Địa chỉ Email/i),
      'beta@example.invalid'
    );
    await user.type(
      within(createDialog).getByLabelText(/Mật khẩu khởi tạo/i),
      'ValidPass!123'
    );
    await user.click(within(createDialog).getByRole('button', { name: /^Tạo tài khoản$/i }));

    await waitFor(() => {
      expect(screen.getByText('@teacher_beta')).toBeInTheDocument();
    });

    // 2. Lock teacher_alpha account via "Thao tác" menu
    await user.click(
      screen.getByRole('button', { name: 'Thao tác cho tài khoản teacher_alpha' })
    );
    const teacherMenu1 = await screen.findByRole('menu');
    await user.click(
      within(teacherMenu1).getByRole('menuitem', { name: /Khóa tài khoản/i })
    );

    const statusDialog = await screen.findByRole('dialog');
    await user.click(
      within(statusDialog).getByRole('button', { name: /^Khóa tài khoản$/i })
    );

    await waitFor(() => {
      expect(lastStatusBody).toEqual({ status: 'LOCKED' });
    });

    // 3. Reset password for teacher_alpha via "Thao tác" menu
    await user.click(
      screen.getByRole('button', { name: 'Thao tác cho tài khoản teacher_alpha' })
    );
    const teacherMenu2 = await screen.findByRole('menu');
    await user.click(
      within(teacherMenu2).getByRole('menuitem', { name: /Đặt lại mật khẩu/i })
    );

    const resetDialog = await screen.findByRole('dialog');
    await user.type(
      within(resetDialog).getByLabelText(/^Mật khẩu mới \*/i),
      'ResetPass!2026'
    );
    await user.type(
      within(resetDialog).getByLabelText(/^Xác nhận mật khẩu mới \*/i),
      'ResetPass!2026'
    );
    await user.click(
      within(resetDialog).getByRole('button', { name: /^Đặt lại mật khẩu$/i })
    );

    await waitFor(() => {
      expect(lastResetBody).toEqual({ new_password: 'ResetPass!2026' });
    });

    // 4. Soft delete teacher_alpha via "Thao tác" menu
    await user.click(
      screen.getByRole('button', { name: 'Thao tác cho tài khoản teacher_alpha' })
    );
    const teacherMenu3 = await screen.findByRole('menu');
    await user.click(
      within(teacherMenu3).getByRole('menuitem', { name: /Xóa tài khoản/i })
    );

    const deleteDialog = await screen.findByRole('dialog');
    await user.click(
      within(deleteDialog).getByRole('button', { name: /^Xóa tài khoản$/i })
    );

    await waitFor(() => {
      expect(screen.queryByText('@teacher_alpha')).not.toBeInTheDocument();
    });
  });

  it('falls back to previous page when deleting the last item on page > 1 and omits role when editing a STUDENT user', async () => {
    const user = userEvent.setup();
    const studentOnPage2 = {
      id: '0199ac14-a9bc-7001-8000-000000000055',
      username: 'sv_page2',
      full_name: 'Sinh viên Trang 2',
      role: 'STUDENT' as const,
      status: 'ACTIVE' as const,
    };

    let deletedStudent = false;
    let lastPatchBody: Record<string, unknown> | null = null;
    const requestedPages: number[] = [];

    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

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
          data: ADMIN_USER,
        });
      }

      if (url.endsWith(`/users/${studentOnPage2.id}`) && method === 'GET') {
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: studentOnPage2,
        });
      }

      if (url.endsWith(`/users/${studentOnPage2.id}`) && method === 'PATCH') {
        lastPatchBody = JSON.parse(String(init?.body));
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'Updated',
          data: { ...studentOnPage2, full_name: String(lastPatchBody?.full_name) },
        });
      }

      if (url.endsWith(`/users/${studentOnPage2.id}`) && method === 'DELETE') {
        deletedStudent = true;
        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'Deleted',
          data: {},
        });
      }

      if (url.includes('/users') && method === 'GET') {
        const parsed = new URL(url);
        const p = Number(parsed.searchParams.get('page') || '1');
        requestedPages.push(p);

        if (p === 1) {
          return createJsonResponse(200, {
            success: true,
            code: 'SUCCESS',
            message: 'OK',
            data: [ADMIN_USER],
            meta: {
              page: 1,
              page_size: 1,
              total_items: deletedStudent ? 1 : 2,
              total_pages: deletedStudent ? 1 : 2,
            },
          });
        }

        return createJsonResponse(200, {
          success: true,
          code: 'SUCCESS',
          message: 'OK',
          data: deletedStudent ? [] : [studentOnPage2],
          meta: {
            page: 2,
            page_size: 1,
            total_items: deletedStudent ? 1 : 2,
            total_pages: deletedStudent ? 1 : 2,
          },
        });
      }

      return createJsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'Not found' });
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/users']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Xem chi tiết tài khoản admin_main' })
      ).toBeInTheDocument();
    });

    // Navigate to page 2
    await user.click(screen.getByRole('button', { name: 'Sau' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Thao tác cho tài khoản sv_page2' })
      ).toBeInTheDocument();
    });

    // Edit STUDENT user via "Thao tác" menu -> role must NOT be sent in PATCH body
    await user.click(
      screen.getByRole('button', { name: 'Thao tác cho tài khoản sv_page2' })
    );
    const studentMenu1 = await screen.findByRole('menu');
    await user.click(
      within(studentMenu1).getByRole('menuitem', { name: /Chỉnh sửa thông tin/i })
    );

    const editDialog = await screen.findByRole('dialog');
    const fullNameInput = within(editDialog).getByLabelText(/Họ và tên/i);
    await user.clear(fullNameInput);
    await user.type(fullNameInput, 'Sinh viên Trang 2 Đã Sửa');
    await user.click(within(editDialog).getByRole('button', { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(lastPatchBody).toEqual({ full_name: 'Sinh viên Trang 2 Đã Sửa' });
    });

    // Delete the only user on page 2 -> must automatically navigate back to page 1
    await user.click(
      screen.getByRole('button', { name: 'Thao tác cho tài khoản sv_page2' })
    );
    const studentMenu2 = await screen.findByRole('menu');
    await user.click(
      within(studentMenu2).getByRole('menuitem', { name: /Xóa tài khoản/i })
    );

    const deleteDialog = await screen.findByRole('dialog');
    await user.click(
      within(deleteDialog).getByRole('button', { name: /^Xóa tài khoản$/i })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Xem chi tiết tài khoản admin_main' })
      ).toBeInTheDocument();
    });
    expect(requestedPages[requestedPages.length - 1]).toBe(1);
  });
});
