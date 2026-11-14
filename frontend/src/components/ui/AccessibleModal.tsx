import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  isBusy?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  isBusy = false,
  maxWidthClass = 'max-w-lg',
  children,
}: AccessibleModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(isBusy);

  useEffect(() => {
    onCloseRef.current = onClose;
    isBusyRef.current = isBusy;
  }, [onClose, isBusy]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const container = dialogRef.current;
      if (!container) return;
      const firstInput = container.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (firstInput) {
        firstInput.focus();
        return;
      }
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        container.focus();
      }
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented || document.querySelector('[role="listbox"]')) {
          return;
        }
        if (!isBusyRef.current) {
          e.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
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
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function'
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full ${maxWidthClass} flex flex-col overflow-hidden rounded-lg border border-surface-border bg-surface-card shadow-lg focus:outline-none`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-surface-border px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-base font-bold text-text-primary sm:text-lg"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-xs text-text-secondary sm:text-sm"
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Đóng cửa sổ"
            className="size-8 shrink-0 text-text-secondary hover:text-text-primary"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
