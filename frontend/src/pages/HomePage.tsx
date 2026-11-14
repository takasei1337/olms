import { Link } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CopyButton } from '../components/ui/CopyButton';
import { useAuth } from '../features/auth/AuthContext';
import { ROLE_LABELS } from '../features/auth/types';
import { RoleBadge, StatusBadge } from '../features/users/components/UserBadges';

export function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-surface-border pb-4">
        <h1 className="text-xl font-bold text-balance text-text-primary sm:text-2xl">
          Xin chào, {user.full_name}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-pretty text-text-secondary">
          Không gian làm việc dành cho {ROLE_LABELS[user.role]} trên hệ thống khảo thí trực tuyến OLMS.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Primary Column: Role-specific Actions ("Việc bạn có thể làm") */}
        <section aria-labelledby="role-actions-heading" className="lg:col-span-8">
          <Card className="border-surface-border bg-surface-card shadow-sm">
            <CardHeader className="border-b border-surface-border px-5 py-4">
              <CardTitle
                id="role-actions-heading"
                className="text-base font-semibold text-text-primary"
              >
                Việc bạn có thể làm
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Các tác vụ khả dụng cho vai trò {ROLE_LABELS[user.role]} trong phiên hiện tại.
              </CardDescription>
            </CardHeader>

            <CardContent className="divide-y divide-surface-border p-0">
              {user.role === 'ADMIN' ? (
                <>
                  <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-brand-500/30 bg-semantic-info-bg text-brand-600 dark:text-brand-200">
                        <Users aria-hidden="true" className="size-4" />
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-text-primary">
                          Quản lý danh sách tài khoản
                        </h3>
                        <p className="max-w-xl text-xs leading-relaxed text-pretty text-text-secondary">
                          Tìm kiếm người dùng, tạo tài khoản Quản trị viên hoặc Giáo viên mới, khóa mở tài khoản và đặt lại mật khẩu khi người dùng quên.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/admin/users"
                      className={cn(
                        buttonVariants({ variant: 'default', size: 'sm' }),
                        'shrink-0 font-semibold'
                      )}
                    >
                      <span>Quản lý tài khoản</span>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>

                  <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-surface-border bg-surface-muted text-text-secondary">
                        <KeyRound aria-hidden="true" className="size-4" />
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-text-primary">
                          Bảo mật &amp; đổi mật khẩu cá nhân
                        </h3>
                        <p className="max-w-xl text-xs leading-relaxed text-pretty text-text-secondary">
                          Cập nhật mật khẩu đăng nhập định kỳ. Sau khi đổi mật khẩu, bạn sẽ được đăng xuất khỏi mọi thiết bị để đảm bảo an toàn.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/account/password"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'shrink-0 font-semibold'
                      )}
                    >
                      Đổi mật khẩu
                    </Link>
                  </div>
                </>
              ) : null}

              {user.role === 'TEACHER' ? (
                <>
                  <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-brand-500/30 bg-semantic-info-bg text-brand-600 dark:text-brand-200">
                        <KeyRound aria-hidden="true" className="size-4" />
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-text-primary">
                          Bảo mật &amp; đổi mật khẩu cá nhân
                        </h3>
                        <p className="max-w-xl text-xs leading-relaxed text-pretty text-text-secondary">
                          Đổi mật khẩu đăng nhập cho tài khoản Giáo viên của bạn và đăng xuất khỏi các thiết bị cũ.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/account/password"
                      className={cn(
                        buttonVariants({ variant: 'default', size: 'sm' }),
                        'shrink-0 font-semibold'
                      )}
                    >
                      <span>Đổi mật khẩu</span>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>

                  <div className="flex items-start gap-3 p-5">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-surface-border bg-surface-muted text-text-secondary">
                      <ShieldCheck aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        Quyền hạn tài khoản Giáo viên
                      </h3>
                      <p className="mt-1 max-w-xl text-xs leading-relaxed text-pretty text-text-secondary">
                        Tài khoản của bạn được cấp quyền giảng dạy và tổ chức thi. Chức năng quản lý danh sách người dùng toàn hệ thống chỉ dành cho Quản trị viên.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}

              {user.role === 'STUDENT' ? (
                <div className="flex items-start gap-3 p-5">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-surface-border bg-surface-muted text-text-secondary">
                    <UserCheck aria-hidden="true" className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Hướng dẫn sử dụng tài khoản Sinh viên
                    </h3>
                    <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-pretty text-text-secondary">
                      Tài khoản Sinh viên được cấp theo danh sách thí sinh của từng kỳ thi. Nếu bạn cần cấp lại mật khẩu hoặc điều chỉnh họ tên, vui lòng liên hệ Giáo viên coi thi hoặc Quản trị viên nhà trường.
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* Secondary Column: Compact Account Information ("Thông tin tài khoản của bạn") */}
        <section aria-labelledby="session-profile-heading" className="lg:col-span-4">
          <Card className="border-surface-border bg-surface-card shadow-sm">
            <CardHeader className="border-b border-surface-border px-5 py-4">
              <CardTitle
                id="session-profile-heading"
                className="text-base font-semibold text-text-primary"
              >
                Thông tin tài khoản của bạn
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <dl className="divide-y divide-surface-border px-5 text-sm">
                <div className="py-3.5">
                  <dt className="text-xs font-medium text-text-secondary">Họ và tên</dt>
                  <dd className="mt-1 break-words font-semibold text-text-primary">
                    {user.full_name}
                  </dd>
                </div>

                <div className="py-3.5">
                  <dt className="text-xs font-medium text-text-secondary">Tên đăng nhập</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2">
                    <span
                      className="truncate font-mono text-xs font-medium text-text-primary"
                      title={user.username}
                    >
                      @{user.username}
                    </span>
                    <CopyButton
                      value={user.username}
                      ariaLabel={`Sao chép tên đăng nhập ${user.username}`}
                      visibleLabel="Sao chép"
                    />
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2 py-3.5">
                  <dt className="text-xs font-medium text-text-secondary">Vai trò</dt>
                  <dd>
                    <RoleBadge role={user.role} />
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2 py-3.5">
                  <dt className="text-xs font-medium text-text-secondary">Trạng thái</dt>
                  <dd>
                    <StatusBadge status={user.status} />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
