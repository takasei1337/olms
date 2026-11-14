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
import type { ExamsPaginationMeta } from '../types';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 dòng' },
  { value: '20', label: '20 dòng' },
  { value: '50', label: '50 dòng' },
] as const;

interface ExamPaginationFooterProps {
  page: number;
  pageSize?: number;
  meta: ExamsPaginationMeta | null;
  itemLabel: string;
  isLoading?: boolean;
  showPageSize?: boolean;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange?: (nextPageSize: number) => void;
}

/**
 * Standardized OLMS table pagination footer using `<<`, `<`, `>`, `>>` chevron controls.
 */
export function ExamPaginationFooter({
  page,
  pageSize,
  meta,
  itemLabel,
  isLoading = false,
  showPageSize = true,
  onPageChange,
  onPageSizeChange,
}: ExamPaginationFooterProps) {
  if (!meta || meta.total_pages <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-surface-border px-4 py-3 text-xs text-text-secondary sm:flex-row">
      <div className="flex flex-wrap items-center gap-3">
        <span className="tabular-nums">
          Trang <strong className="font-semibold text-text-primary">{meta.page}</strong> /{' '}
          {meta.total_pages} (Tổng cộng{' '}
          <strong className="font-semibold text-text-primary">{meta.total_items}</strong>{' '}
          {itemLabel})
        </span>

        {showPageSize && pageSize !== undefined && onPageSizeChange ? (
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
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
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
      </div>
    </div>
  );
}
