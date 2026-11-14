import { ApiError } from '../../api/client';
import type {
  ExamResultParticipantStatus,
  QuestionGradingStatus,
  ResultVisibilityMode,
} from './types';

export function getReadableErrorMessage(
  err: unknown,
  fallback = 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'
): string {
  if (err instanceof ApiError) {
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export const VISIBILITY_LABELS: Record<ResultVisibilityMode, string> = {
  HIDDEN: 'Đang ẩn kết quả',
  SCORE_ONLY: 'Chỉ hiện tổng điểm',
  SCORE_AND_STATUS: 'Điểm & trạng thái câu',
  FULL_REVIEW: 'Xem chi tiết đầy đủ',
};

export const VISIBILITY_SHORT_LABELS: Record<ResultVisibilityMode, string> = {
  HIDDEN: 'Đang ẩn',
  SCORE_ONLY: 'Chỉ tổng điểm',
  SCORE_AND_STATUS: 'Điểm & Đúng/Sai',
  FULL_REVIEW: 'Chi tiết đầy đủ',
};

export const VISIBILITY_DESCRIPTIONS: Record<ResultVisibilityMode, string> = {
  HIDDEN: 'Thí sinh chỉ thấy kỳ thi chưa công bố kết quả; điểm và bài làm được giữ kín.',
  SCORE_ONLY: 'Thí sinh chỉ xem được tổng điểm và trạng thái nộp/chấm của bài thi.',
  SCORE_AND_STATUS:
    'Thí sinh xem được tổng điểm, thống kê Đúng / Sai / Bỏ trống và trạng thái từng câu (ẩn đáp án đúng).',
  FULL_REVIEW:
    'Thí sinh xem được toàn bộ tổng điểm, đáp án đã chọn, đáp án đúng và giải thích từng câu.',
};

export const GRADING_STATUS_LABELS: Record<QuestionGradingStatus, string> = {
  CORRECT: 'Đúng',
  PARTIAL: 'Đúng một phần',
  WRONG: 'Sai',
  BLANK: 'Bỏ trống',
};

export const PARTICIPANT_RESULT_STATUS_LABELS: Record<ExamResultParticipantStatus, string> = {
  NOT_STARTED: 'Chưa vào thi',
  REGISTERED: 'Chưa vào thi',
  IN_PROGRESS: 'Đang làm bài',
  SUBMITTED: 'Đã nộp — chờ chấm',
  GRADING: 'Đang chấm điểm',
  GRADED: 'Đã chấm điểm',
  FLAGGED: 'Cần xem xét',
};

export function formatScoreValue(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return '--';
  }
  return Number(score).toFixed(2);
}

export function formatCompactScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return '--';
  }
  const rounded = Math.round(Number(score) * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

export function formatQuestionKindLabel(kind: string | undefined): string {
  switch (kind) {
    case 'SINGLE_CHOICE':
      return 'Một đáp án';
    case 'MULTI_CHOICE':
      return 'Nhiều đáp án';
    case 'DROPDOWN':
      return 'Điền từ danh sách';
    case 'INPUT':
      return 'Điền đáp án';
    case 'MATCHING':
      return 'Ghép cặp';
    default:
      return 'Câu hỏi';
  }
}
