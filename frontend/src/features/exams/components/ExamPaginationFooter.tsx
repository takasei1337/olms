import { PaginationFooter } from '@/components/ui/PaginationFooter';
import type { ExamsPaginationMeta } from '../types';

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
 * Exam table pagination wrapper delegating to the shared PaginationFooter.
 */
export function ExamPaginationFooter(props: ExamPaginationFooterProps) {
  return <PaginationFooter {...props} />;
}
