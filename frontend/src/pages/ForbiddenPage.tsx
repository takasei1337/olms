import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '../features/auth/AuthContext';
import { ROLE_LABELS, type UserRole } from '../features/auth/types';

interface ForbiddenPageProps {
  requiredRoles?: UserRole[];
}

export function ForbiddenPage({ requiredRoles }: ForbiddenPageProps) {
  const { user } = useAuth();

  const requiredRolesLabel =
    requiredRoles && requiredRoles.length > 0
      ? requiredRoles.map((role) => ROLE_LABELS[role]).join(', ')
      : null;

  return (
    <section aria-labelledby="forbidden-heading" className="mx-auto my-8 max-w-xl">
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-semantic-error/30 bg-semantic-error-bg px-2.5 py-1 text-xs font-semibold text-semantic-error">
            <ShieldAlert aria-hidden="true" className="size-4 shrink-0" />
            <span>Từ chối truy cập (403)</span>
          </div>

          <h1
            id="forbidden-heading"
            className="text-xl font-bold text-balance text-text-primary sm:text-2xl"
          >
            Bạn không có quyền truy cập trang này
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-pretty text-text-secondary">
            Tài khoản hiện tại của bạn
            {user ? (
              <>
                {' '}
                (<strong className="font-mono font-semibold text-text-primary">@{user.username}</strong> — vai trò{' '}
                <strong className="font-semibold text-text-primary">
                  {ROLE_LABELS[user.role]}
                </strong>
                )
              </>
            ) : null}{' '}
            chưa được cấp quyền mở chức năng này.
          </p>

          {requiredRolesLabel ? (
            <p className="mt-2 text-xs text-text-secondary">
              Chức năng này chỉ dành cho vai trò:{' '}
              <strong className="font-semibold text-text-primary">{requiredRolesLabel}</strong>.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/" className={buttonVariants({ variant: 'default' })}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span>Quay về Tổng quan</span>
            </Link>

            {user?.role === 'ADMIN' ? (
              <Link to="/admin/users" className={buttonVariants({ variant: 'outline' })}>
                <Users aria-hidden="true" className="size-4" />
                <span>Quản lý tài khoản</span>
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
