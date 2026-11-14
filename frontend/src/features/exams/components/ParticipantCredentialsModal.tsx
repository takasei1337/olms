import { AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { CopyButton } from '../../../components/ui/CopyButton';
import type { ParticipantCredentialOutcome } from '../types';

interface ParticipantCredentialsModalProps {
  outcome: ParticipantCredentialOutcome | null;
  mode: 'enroll' | 'reset';
  onClose: () => void;
}

export function ParticipantCredentialsModal({
  outcome,
  mode,
  onClose,
}: ParticipantCredentialsModalProps) {
  if (!outcome) return null;

  const { participant, username, initial_password } = outcome;
  const hasNewPassword = Boolean(initial_password);

  const combinedText = [
    `Họ tên: ${participant.full_name_snapshot}`,
    `MSSV: ${participant.student_code}`,
    username ? `Tên đăng nhập: ${username}` : null,
    initial_password ? `Mật khẩu khởi tạo: ${initial_password}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <AccessibleModal
      isOpen={Boolean(outcome)}
      onClose={onClose}
      maxWidthClass="max-w-md"
      title={
        mode === 'reset'
          ? 'Đã đặt lại mật khẩu thí sinh'
          : 'Đã ghi danh thí sinh thành công'
      }
      description="Lưu giữ và bàn giao thông tin tài khoản thi cho thí sinh ngay lúc này."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-3.5 py-2.5 text-xs text-semantic-success">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {participant.full_name_snapshot} ({participant.student_code})
            </p>
            <p className="mt-0.5 text-[11px] opacity-90">
              {hasNewPassword
                ? 'Tài khoản đã sẵn sàng cho kỳ thi này.'
                : 'Đã khôi phục hồ sơ thí sinh trước đó trong kỳ thi.'}
            </p>
          </div>
        </div>

        {hasNewPassword ? (
          <>
            <div className="space-y-2.5 rounded-lg border border-surface-border bg-surface-muted/35 p-3.5 text-xs">
              {username ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-secondary">
                      Tên đăng nhập
                    </p>
                    <p className="truncate font-mono text-xs font-semibold text-text-primary">
                      {username}
                    </p>
                  </div>
                  <CopyButton
                    value={username}
                    ariaLabel="Sao chép tên đăng nhập"
                    visibleLabel="Sao chép"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 border-t border-surface-border pt-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <KeyRound aria-hidden="true" className="size-3" />
                    <span>Mật khẩu khởi tạo (hiển thị 1 lần)</span>
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold tracking-wider text-text-primary">
                    {initial_password}
                  </p>
                </div>
                <CopyButton
                  value={initial_password || ''}
                  ariaLabel="Sao chép mật khẩu khởi tạo"
                  visibleLabel="Sao chép"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-semantic-warning/35 bg-semantic-warning-bg px-3.5 py-2.5 text-xs text-semantic-warning">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p className="leading-relaxed">
                Vì lý do bảo mật (P-01), hệ thống chỉ hiển thị mật khẩu khởi tạo đúng 1 lần này và không xuất kèm trong file danh sách sau đó. Nếu thí sinh quên trước khi thi, hãy dùng chức năng <strong>Đặt lại mật khẩu</strong>.
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-surface-border bg-surface-muted/35 px-3.5 py-3 text-xs text-text-secondary">
            Thí sinh sử dụng lại tài khoản đã cấp trước đó. Nếu cần cấp mật khẩu mới, hãy bấm <strong>Đặt lại mật khẩu</strong> trên dòng thí sinh.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
          {hasNewPassword ? (
            <CopyButton
              value={combinedText}
              ariaLabel="Sao chép toàn bộ thông tin tài khoản"
              visibleLabel="Sao chép toàn bộ"
              className="h-8 px-2.5 text-xs"
            />
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold"
          >
            Tôi đã lưu thông tin
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
