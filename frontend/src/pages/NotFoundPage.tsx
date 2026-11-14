import { Link } from 'react-router-dom';
import { ArrowLeft, FileQuestion, LogIn, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '../features/auth/AuthContext';

export function NotFoundPage() {
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authenticated' && Boolean(user);

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-12">
      <section aria-labelledby="not-found-heading" className="w-full max-w-xl">
        <Card className="border-surface-border bg-surface-card shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">
              <FileQuestion aria-hidden="true" className="size-4 shrink-0" />
              <span>Không tìm thấy trang (404)</span>
            </div>

            <h1
              id="not-found-heading"
              className="text-xl font-bold text-balance text-text-primary sm:text-2xl"
            >
              Không tìm thấy trang yêu cầu
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-pretty text-text-secondary">
              Địa chỉ bạn vừa mở không tồn tại hoặc đã thay đổi. Vui lòng kiểm tra lại đường dẫn hoặc quay về trang làm việc chính.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <>
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
                </>
              ) : (
                <Link to="/login" className={buttonVariants({ variant: 'default' })}>
                  <LogIn aria-hidden="true" className="size-4" />
                  <span>Đến trang Đăng nhập</span>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
