import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';

interface TechnicalDetailsProps {
  code?: string;
  traceId?: string;
  className?: string;
}

export function TechnicalDetails({ code, traceId, className = 'mt-2' }: TechnicalDetailsProps) {
  if (!code && !traceId) {
    return null;
  }

  const copyPayload = [
    code ? `Mã lỗi: ${code}` : null,
    traceId ? `Trace: ${traceId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <Collapsible className={cn('text-xs text-text-secondary', className)}>
      <CollapsibleTrigger className="group inline-flex cursor-pointer select-none items-center gap-1 rounded px-0.5 py-0.5 font-medium text-text-secondary transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform duration-fast group-data-[state=open]:rotate-90"
        />
        <span>Chi tiết kỹ thuật</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-surface-border bg-surface-card px-2.5 py-1.5 font-mono text-[11px] text-text-secondary">
          <span className="break-all">
            {code ? `Mã tham chiếu: ${code}` : null}
            {code && traceId ? ' · ' : null}
            {traceId ? `Trace: ${traceId}` : null}
          </span>
          <CopyButton
            value={copyPayload}
            ariaLabel="Sao chép mã lỗi kỹ thuật"
            visibleLabel="Sao chép mã"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
