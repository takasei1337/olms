import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  ariaLabel: string;
  visibleLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  value,
  ariaLabel,
  visibleLabel,
  copiedLabel = 'Đã sao chép',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
    } catch {
      setCopied(true);
    }
  };

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? `${copiedLabel}: ${value}` : ariaLabel}
        title={copied ? copiedLabel : ariaLabel}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-surface-border bg-surface-card px-1.5 py-0.5 text-[11px] font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
          className
        )}
      >
        {copied ? (
          <>
            <Check aria-hidden="true" className="size-3 shrink-0 text-semantic-success" />
            <span className="text-semantic-success">{copiedLabel}</span>
          </>
        ) : (
          <>
            <Copy aria-hidden="true" className="size-3 shrink-0" />
            {visibleLabel ? <span>{visibleLabel}</span> : <span className="sr-only">{ariaLabel}</span>}
          </>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${copiedLabel} ${value}` : ''}
      </span>
    </span>
  );
}
