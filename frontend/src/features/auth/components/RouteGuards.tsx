import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ForbiddenPage } from '../../../pages/ForbiddenPage';
import { useAuth } from '../AuthContext';
import type { UserRole } from '../types';
import { getSafeRedirectPath } from '../utils/redirect';

export function SessionInitializingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center bg-surface-canvas px-4 text-center"
    >
      <Card className="w-full max-w-sm border-surface-border bg-surface-card shadow-sm">
        <CardContent className="p-6">
          <Loader2
            aria-hidden="true"
            className="mx-auto mb-3 size-6 animate-spin text-brand-600 dark:text-brand-200"
          />
          <p className="text-sm font-semibold text-text-primary">
            Đang mở không gian làm việc OLMS...
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Vui lòng đợi trong giây lát.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { status, sessionNotice } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <SessionInitializingScreen />;
  }

  if (status === 'unauthenticated') {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    const shouldPreserveFrom =
      !sessionNotice || sessionNotice.type === 'warning';
    return (
      <Navigate
        to="/login"
        replace
        state={shouldPreserveFrom ? { from: requestedPath } : null}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'initializing') {
    return <SessionInitializingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <ForbiddenPage requiredRoles={allowedRoles} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <SessionInitializingScreen />;
  }

  if (status === 'authenticated' && user) {
    const state = location.state as { from?: unknown } | null;
    const redirectTo = getSafeRedirectPath(state?.from, user.role);
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
