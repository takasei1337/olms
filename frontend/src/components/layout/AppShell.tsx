import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../features/auth/AuthContext';
import { ROLE_LABELS } from '../../features/auth/types';
import { RoleBadge } from '../../features/users/components/UserBadges';
import { ThemeToggle } from '../ui/ThemeToggle';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppShell() {
  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Focus trap, Escape key and body scroll lock when mobile drawer is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const triggerEl = menuTriggerRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const container = sidebarRef.current;
      if (!container) return;
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMobileMenuOpen(false);
        triggerEl?.focus();
        return;
      }

      if (e.key === 'Tab') {
        const container = sidebarRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  if (!user) {
    return null;
  }

  const canManageUsers = user.role === 'ADMIN';
  const canManageQuestions = user.role === 'ADMIN' || user.role === 'TEACHER';
  const canChangePassword = user.role === 'ADMIN' || user.role === 'TEACHER';

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsMobileMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const closeMobileMenuAndRestoreFocus = () => {
    setIsMobileMenuOpen(false);
    menuTriggerRef.current?.focus();
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast ${
      isActive
        ? 'bg-semantic-info-bg text-brand-700 dark:text-brand-200 font-semibold'
        : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
    }`;

  return (
    <div className="min-h-dvh flex flex-col bg-surface-canvas text-text-primary lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Chuyển đến nội dung chính
      </a>

      {/* Mobile Top Bar (< lg) */}
      <header className="flex items-center justify-between gap-2 border-b border-surface-border bg-surface-card px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Mở menu điều hướng"
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-sidebar"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-surface-border bg-surface-card text-text-primary transition-colors duration-fast hover:bg-surface-muted"
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>

          <Link
            to="/"
            className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-text-primary"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
              OLMS
            </span>
            <span className="truncate">Hệ thống Khảo thí OLMS</span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <RoleBadge role={user.role} />
        </div>
      </header>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen ? (
        <div
          aria-hidden="true"
          onClick={closeMobileMenuAndRestoreFocus}
          className="fixed inset-0 z-40 bg-surface-overlay lg:hidden"
        />
      ) : null}

      {/* Sidebar (Fixed vertical on lg+, Slide-over drawer on <lg when open) */}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        role={isMobileMenuOpen ? 'dialog' : undefined}
        aria-modal={isMobileMenuOpen ? 'true' : undefined}
        aria-label="Thanh điều hướng ứng dụng"
        className={`${
          isMobileMenuOpen
            ? 'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shadow-lg'
            : 'hidden'
        } flex-col border-r border-surface-border bg-surface-card lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:shadow-none`}
      >
        {/* Brand Header inside Sidebar */}
        <div className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-4">
          <Link
            to="/"
            className="inline-flex min-w-0 items-center gap-2.5 text-base font-bold text-text-primary hover:text-brand-600 dark:hover:text-brand-200"
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white shadow-sm">
              OLMS
            </span>
            <span className="truncate">Khảo thí OLMS</span>
          </Link>

          {isMobileMenuOpen ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={closeMobileMenuAndRestoreFocus}
              aria-label="Đóng menu điều hướng"
              className="size-8 shrink-0 lg:hidden"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
        </div>

        {/* Role-based Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav aria-label="Điều hướng chính" className="space-y-1">
            <NavLink to="/" end className={navLinkClass}>
              <LayoutDashboard aria-hidden="true" className="size-4 shrink-0" />
              <span>Tổng quan</span>
            </NavLink>

            {canManageQuestions ? (
              <>
                <NavLink to="/catalog" className={navLinkClass}>
                  <BookOpen aria-hidden="true" className="size-4 shrink-0" />
                  <span>Môn &amp; Bài học</span>
                </NavLink>
                <NavLink to="/questions" className={navLinkClass}>
                  <HelpCircle aria-hidden="true" className="size-4 shrink-0" />
                  <span>Ngân hàng câu hỏi</span>
                </NavLink>
              </>
            ) : null}

            {canManageUsers ? (
              <NavLink to="/admin/users" className={navLinkClass}>
                <Users aria-hidden="true" className="size-4 shrink-0" />
                <span>Quản lý tài khoản</span>
              </NavLink>
            ) : null}

            {canChangePassword ? (
              <NavLink to="/account/password" className={navLinkClass}>
                <KeyRound aria-hidden="true" className="size-4 shrink-0" />
                <span>Đổi mật khẩu</span>
              </NavLink>
            ) : null}
          </nav>
        </div>

        {/* Account Summary & Logout at Footer of Sidebar */}
        <div className="border-t border-surface-border bg-surface-muted/40 p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold text-text-primary"
                title={user.full_name}
              >
                {user.full_name}
              </p>
              <p
                className="truncate font-mono text-xs text-text-secondary"
                title={user.username}
              >
                @{user.username}
              </p>
            </div>
            <RoleBadge role={user.role} />
          </div>

          <div className="space-y-2">
            <ThemeToggle showLabel className="w-full justify-center" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full justify-center gap-2 text-xs font-medium"
            >
              <LogOut aria-hidden="true" className="size-3.5 text-text-secondary" />
              <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 focus:outline-none"
        >
          <Outlet />
        </main>

        <footer className="border-t border-surface-border bg-surface-card px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-1 text-xs text-text-secondary sm:flex-row sm:items-center">
            <span>OLMS - Hệ thống Quản lý Học tập &amp; Khảo thí Trực tuyến</span>
            <span>
              Vai trò: <strong className="font-semibold text-text-primary">{ROLE_LABELS[user.role]}</strong>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
