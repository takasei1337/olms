export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_name: string;
  entity_id: string | null;
  created_at: string;
}

export interface AuditLogsPaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface AuditLogsQueryParams {
  actor_user_id?: string;
  action?: string;
  entity_name?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  users: 'Tài khoản người dùng',
  exams: 'Kỳ thi',
  participants: 'Thí sinh',
  questions: 'Câu hỏi',
  submissions: 'Bài làm',
  grades: 'Điểm thi',
  detected_answers: 'Phiếu OMR',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_STATUS_CHANGED: 'Đổi trạng thái tài khoản',
  USER_PASSWORD_RESET: 'Đặt lại mật khẩu tài khoản',
  USER_SOFT_DELETED: 'Xóa mềm tài khoản',
  AUTH_ACCOUNT_TEMP_LOCKED: 'Tạm khóa do đăng nhập sai nhiều lần',
  EXAM_STATUS_CHANGE: 'Chuyển trạng thái kỳ thi',
  EXAM_CLOSE_TIME_CHANGED: 'Điều chỉnh giờ đóng kỳ thi',
  EXAM_END_EARLY_REQUESTED: 'Kết thúc kỳ thi sớm',
  PUBLISH_RESULTS: 'Công bố kết quả kỳ thi',
  RESULT_VISIBILITY_CHANGED: 'Đổi chế độ xem điểm/đáp án',
  PARTICIPANT_ENROLLED: 'Ghi danh thí sinh',
  PARTICIPANTS_IMPORT_COMMITTED: 'Nhập danh sách thí sinh từ Excel',
  PARTICIPANT_REMOVED: 'Xóa thí sinh khỏi kỳ thi',
  PARTICIPANTS_CREDENTIALS_EXPORTED: 'Xuất bảng tài khoản thí sinh',
  PARTICIPANT_CREDENTIAL_RESET: 'Cấp lại mật khẩu thí sinh',
  AI_DUPLICATE_OVERRIDE: 'Ghi đè cảnh báo trùng lặp câu hỏi',
  SUBMISSION_DEADLINE_FORCE_SUBMITTED: 'Hệ thống tự thu bài hết giờ',
  GRADE_RECALCULATED: 'Chấm lại điểm bài thi',
  MANUAL_OMR_CORRECTION: 'Hiệu chỉnh nhận dạng OMR',
};

export const AUDIT_ENTITY_OPTIONS = Object.entries(AUDIT_ENTITY_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(
  ([value, label]) => ({ value, label })
);
