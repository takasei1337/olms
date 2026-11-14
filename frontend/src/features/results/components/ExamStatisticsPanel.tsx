import { BarChart3, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import { formatExamDateTime } from '../../exams/utils';
import { cn } from '../../../lib/utils';
import type { ExamRecord } from '../../exams/types';
import type { ExamStatisticsData } from '../types';
import { formatScoreValue } from '../utils';
import { VisibilityModeBadge } from './VisibilityAndGradingBadges';

interface ExamStatisticsPanelProps {
  exam: ExamRecord;
  statistics: ExamStatisticsData | null;
  loading: boolean;
}

export function ExamStatisticsPanel({
  exam,
  statistics,
  loading,
}: ExamStatisticsPanelProps) {
  if (loading && !statistics) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <Skeleton key={idx} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const participantCount = statistics?.participant_count ?? 0;
  const gradedCount = statistics?.graded_count ?? 0;
  const gradedPct =
    participantCount > 0 ? Math.round((gradedCount / participantCount) * 100) : 0;
  const avgScore = statistics?.average_score ?? null;
  const buckets = statistics?.distribution ?? [];
  const maxBucketCount = buckets.reduce((acc, b) => Math.max(acc, b.count), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Thí sinh dự kiến / tham gia</span>
            <Users aria-hidden="true" className="size-4 text-text-muted" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {participantCount}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Thí sinh trong danh sách thi</p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Đã hoàn tất chấm điểm</span>
            <CheckCircle2 aria-hidden="true" className="size-4 text-semantic-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-text-primary">
              {gradedCount}
            </span>
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              / {participantCount} ({gradedPct}%)
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-semantic-success transition-all duration-300"
              style={{ width: `${Math.min(100, gradedPct)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Điểm trung bình toàn kỳ thi</span>
            <TrendingUp aria-hidden="true" className="size-4 text-brand-600 dark:text-brand-300" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold tabular-nums text-text-primary">
              {formatScoreValue(avgScore)}
            </span>
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              / {formatScoreValue(exam.total_score)}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {gradedCount > 0 ? `Tính trên ${gradedCount} bài đã chấm` : 'Chưa có bài chấm'}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Công bố kết quả</span>
            <BarChart3 aria-hidden="true" className="size-4 text-text-muted" />
          </div>
          <div className="mt-2">
            <VisibilityModeBadge
              mode={
                exam.status === 'RESULT_PUBLISHED' || exam.status === 'ARCHIVED'
                  ? exam.result_visibility_mode
                  : 'HIDDEN'
              }
            />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {exam.result_published_at
              ? `Công bố lúc ${formatExamDateTime(exam.result_published_at)}`
              : 'Thí sinh chưa xem được kết quả'}
          </p>
        </div>
      </div>

      <section
        aria-label="Phân bố phổ điểm"
        className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Phân bố phổ điểm 5 khoảng</h2>
            <p className="text-xs text-text-secondary">
              Tổng hợp theo {gradedCount} bài thi đã chấm điểm trên thang {formatScoreValue(exam.total_score)}
            </p>
          </div>
          <span className="text-xs font-medium text-text-secondary">Đơn vị: số bài thi (%)</span>
        </div>

        {buckets.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-surface-border bg-surface-canvas px-4 py-8 text-center text-xs text-text-secondary">
            Chưa có dữ liệu phân bố điểm cho kỳ thi này.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-5 items-end gap-2 sm:gap-4">
            {buckets.map((bucket) => {
              const heightPct =
                maxBucketCount > 0 && bucket.count > 0
                  ? Math.max(12, Math.round((bucket.count / maxBucketCount) * 100))
                  : 0;
              const sharePct =
                gradedCount > 0 ? Math.round((bucket.count / gradedCount) * 100) : 0;

              return (
                <div
                  key={bucket.range}
                  className="flex flex-col items-center gap-2"
                  title={`Khoảng ${bucket.range}: ${bucket.count} bài (${sharePct}%)`}
                >
                  <div className="text-center font-mono text-[11px] tabular-nums text-text-secondary sm:text-xs">
                    <span className="font-semibold text-text-primary">{bucket.count}</span>
                    <span className="hidden sm:inline"> ({sharePct}%)</span>
                  </div>

                  <div className="flex h-36 w-full max-w-[84px] items-end rounded-lg border border-surface-border bg-surface-canvas p-1">
                    <div
                      className={cn(
                        'w-full rounded-md transition-all duration-300',
                        bucket.count > 0
                          ? 'bg-brand-600 dark:bg-brand-500'
                          : 'bg-surface-muted'
                      )}
                      style={{ height: bucket.count > 0 ? `${heightPct}%` : '4px' }}
                    />
                  </div>

                  <span className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-text-primary sm:text-xs">
                    {bucket.range}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
