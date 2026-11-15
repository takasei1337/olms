import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

interface PaginationFooterProps {
  page: number;
  pageSize?: number;
  meta: PaginationMeta | null;
  itemLabel: string;
  isLoading?: boolean;
  showPageSize?: boolean;
  compact?: boolean;
  ariaLabel?: string;
  pageSizeOptions?: readonly number[];
  onPageChange: (nextPage: number) => void;
  onPageSizeChange?: (nextPageSize: number) => void;
}

/**
 * Standardized OLMS table/list pagination footer using `<<`, `<`, `>`, `>>` chevron controls.
 */
export function PaginationFooter({
  page,
  pageSize,
  meta,
  itemLabel,
  isLoading = false,
  showPageSize = true,
  compact = false,
  ariaLabel,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
}: PaginationFooterProps) {
  if (!meta || meta.total_pages <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-2 border-t border-surface-border text-xs text-text-secondary',
        compact ? 'px-3 py-2.5' : 'gap-3 px-4 py-3 sm:flex-row'
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums">
          Trang <strong className="font-semibold text-text-primary">{meta.page}</strong> /{' '}
          {meta.total_pages} (Tổng cộng{' '}
          <strong className="font-semibold text-text-primary">{meta.total_items}</strong>{' '}
          {itemLabel})
        </span>

        {!compact && showPageSize && pageSize !== undefined && onPageSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">Hiển thị:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger
                aria-label={`Số ${itemLabel} mỗi trang`}
                className="h-7 w-24 bg-surface-card text-xs text-text-primary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt} dòng
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <nav
        aria-label={ariaLabel || `Phân trang ${itemLabel}`}
        className="flex items-center gap-1"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || isLoading}
          aria-label="Trang đầu"
          className="h-7 w-7 p-0"
        >
          <ChevronsLeft aria-hidden="true" className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isLoading}
          aria-label="Trang trước"
          className="h-7 w-7 p-0"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
        </Button>

        <span className="px-2 text-xs font-medium tabular-nums text-text-primary">
          {page} / {meta.total_pages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(meta.total_pages, page + 1))}
          disabled={page >= meta.total_pages || isLoading}
          aria-label="Trang sau"
          className="h-7 w-7 p-0"
        >
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.total_pages)}
          disabled={page >= meta.total_pages || isLoading}
          aria-label="Trang cuối"
          className="h-7 w-7 p-0"
        >
          <ChevronsRight aria-hidden="true" className="size-3.5" />
        </Button>
      </nav>
    </div>
  );
}
