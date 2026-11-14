import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

export function PasswordInput({
  label,
  error,
  hint,
  id: providedId,
  className = '',
  disabled,
  ...inputProps
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = providedId || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const [visible, setVisible] = useState(false);

  const describedBy =
    [
      error ? errorId : null,
      hint ? hintId : null,
      inputProps['aria-describedby'] || null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-text-primary"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <Input
          {...inputProps}
          id={inputId}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            'h-10 bg-surface-card pr-20 text-sm text-text-primary placeholder:text-text-secondary',
            error
              ? 'border-semantic-error focus-visible:ring-semantic-error'
              : 'border-surface-border focus-visible:border-brand-600 focus-visible:ring-brand-500/30',
            'disabled:bg-surface-muted disabled:text-text-secondary',
            className
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={visible ? 'Ẩn ký tự đang nhập' : 'Hiện ký tự đang nhập'}
          aria-pressed={visible}
          className="absolute right-1.5 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {visible ? (
            <>
              <EyeOff aria-hidden="true" className="size-3.5 shrink-0" />
              <span>Ẩn</span>
            </>
          ) : (
            <>
              <Eye aria-hidden="true" className="size-3.5 shrink-0" />
              <span>Hiện</span>
            </>
          )}
        </button>
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-semantic-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
