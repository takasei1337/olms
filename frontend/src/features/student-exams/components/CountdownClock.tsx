import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeRemainingSeconds, formatCountdownSeconds } from '../utils';

interface CountdownClockProps {
  deadlineIso: string;
  clockOffsetMs: number;
  initialRemainingSeconds: number;
  isStopped?: boolean;
  onExpire?: () => void;
}

/**
 * Displays a server-synchronized HH:MM:SS countdown timer.
 * Uses visual updates cleanly every second with aria-live="off", while emitting
 * milestone screen-reader notices only at critical thresholds.
 */
export function CountdownClock({
  deadlineIso,
  clockOffsetMs,
  initialRemainingSeconds,
  isStopped = false,
  onExpire,
}: CountdownClockProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    deadlineIso
      ? computeRemainingSeconds(deadlineIso, clockOffsetMs)
      : initialRemainingSeconds
  );
  const [milestoneNotice, setMilestoneNotice] = useState<string>('');

  const notified5MinRef = useRef(false);
  const notified1MinRef = useRef(false);
  const expiredCalledRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!deadlineIso) return;
    const synced = computeRemainingSeconds(deadlineIso, clockOffsetMs);
    setRemainingSeconds(synced);
    if (synced > 300) notified5MinRef.current = false;
    if (synced > 60) notified1MinRef.current = false;
    if (synced > 0) expiredCalledRef.current = false;
  }, [deadlineIso, clockOffsetMs]);

  useEffect(() => {
    if (isStopped || !deadlineIso) return;

    const tick = () => {
      const next = computeRemainingSeconds(deadlineIso, clockOffsetMs);
      setRemainingSeconds(next);

      if (next <= 300 && next > 60 && !notified5MinRef.current) {
        notified5MinRef.current = true;
        setMilestoneNotice('Còn 5 phút làm bài.');
      } else if (next <= 60 && next > 0 && !notified1MinRef.current) {
        notified1MinRef.current = true;
        setMilestoneNotice('Còn dưới 1 phút làm bài.');
      } else if (next <= 0 && !expiredCalledRef.current) {
        expiredCalledRef.current = true;
        setMilestoneNotice('Đã hết thời gian làm bài.');
        onExpireRef.current?.();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineIso, clockOffsetMs, isStopped]);

  const urgency =
    remainingSeconds <= 60
      ? 'danger'
      : remainingSeconds <= 300
      ? 'warning'
      : 'normal';

  return (
    <>
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums transition-colors',
          urgency === 'danger' &&
            'border-semantic-danger/45 bg-semantic-danger-bg text-semantic-danger',
          urgency === 'warning' &&
            'border-semantic-warning/45 bg-semantic-warning-bg text-semantic-warning',
          urgency === 'normal' &&
            'border-surface-border bg-surface-panel text-text-primary'
        )}
        title="Thời gian còn lại theo đồng hồ máy chủ"
      >
        <Clock aria-hidden="true" className="size-4 shrink-0" />
        <span aria-live="off">{formatCountdownSeconds(remainingSeconds)}</span>
      </div>

      {milestoneNotice ? (
        <span className="sr-only" aria-live="polite">
          {milestoneNotice}
        </span>
      ) : null}
    </>
  );
}
