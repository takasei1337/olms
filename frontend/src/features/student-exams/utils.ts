import type { QuestionKind } from '../questions/types';
import type {
  AutosavePayload,
  LocalAnswerDraft,
  SavedAnswerItem,
} from './types';

export const STUDENT_QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'Chọn một đáp án',
  MULTI_CHOICE: 'Chọn nhiều đáp án',
  DROPDOWN: 'Chọn từ danh sách',
  INPUT: 'Điền đáp án',
  MATCHING: 'Ghép đôi',
};

/**
 * Generates an RFC 4122 v4 UUID suitable for `edit_token` and `Idempotency-Key`.
 */
export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Calculates `serverTimeMs - clientTimeMs` so client countdown aligns with the server clock.
 */
export function computeServerClockOffsetMs(
  serverTimeIso: string,
  clientNowMs = Date.now()
): number {
  const serverMs = new Date(serverTimeIso).getTime();
  if (Number.isNaN(serverMs)) return 0;
  return serverMs - clientNowMs;
}

export function computeRemainingSeconds(
  deadlineIso: string,
  clockOffsetMs: number,
  clientNowMs = Date.now()
): number {
  const deadlineMs = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadlineMs)) return 0;
  const estimatedServerNowMs = clientNowMs + clockOffsetMs;
  return Math.max(0, Math.floor((deadlineMs - estimatedServerNowMs) / 1000));
}

export function formatCountdownSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function formatTimeClock(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function createEmptyDraft(kind: QuestionKind): LocalAnswerDraft {
  return {
    kind,
    selectedOptions: [],
    answerText: '',
    dropdownSelections: [],
    matchingPairs: [],
  };
}

export function cloneDraft(draft: LocalAnswerDraft): LocalAnswerDraft {
  return {
    kind: draft.kind,
    selectedOptions: [...draft.selectedOptions],
    answerText: draft.answerText,
    dropdownSelections: draft.dropdownSelections.map((s) => ({ ...s })),
    matchingPairs: draft.matchingPairs.map((p) => ({ ...p })),
  };
}

export function draftFromSavedAnswer(
  kind: QuestionKind,
  saved?: SavedAnswerItem
): LocalAnswerDraft {
  const base = createEmptyDraft(kind);
  if (!saved) return base;

  if (kind === 'SINGLE_CHOICE' || kind === 'MULTI_CHOICE') {
    base.selectedOptions = Array.isArray(saved.selected_options)
      ? [...saved.selected_options]
      : [];
    return base;
  }

  if (kind === 'INPUT') {
    base.answerText = typeof saved.answer_text === 'string' ? saved.answer_text : '';
    return base;
  }

  if (kind === 'DROPDOWN') {
    const rd = saved.response_data;
    if (rd && rd.kind === 'DROPDOWN' && Array.isArray(rd.selections)) {
      base.dropdownSelections = rd.selections.map((s) => ({
        blank_id: String(s.blank_id),
        value_id: String(s.value_id),
      }));
    }
    return base;
  }

  if (kind === 'MATCHING') {
    const rd = saved.response_data;
    if (rd && rd.kind === 'MATCHING' && Array.isArray(rd.pairs)) {
      base.matchingPairs = rd.pairs.map((p) => ({
        left_id: String(p.left_id),
        right_id: String(p.right_id),
      }));
    }
    return base;
  }

  return base;
}

export function isDraftAnswered(draft: LocalAnswerDraft): boolean {
  switch (draft.kind) {
    case 'SINGLE_CHOICE':
    case 'MULTI_CHOICE':
      return draft.selectedOptions.length > 0;
    case 'INPUT':
      return draft.answerText.trim().length > 0;
    case 'DROPDOWN':
      return draft.dropdownSelections.length > 0;
    case 'MATCHING':
      return draft.matchingPairs.length > 0;
    default:
      return false;
  }
}

export function draftsEqual(a: LocalAnswerDraft, b: LocalAnswerDraft): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'SINGLE_CHOICE':
    case 'MULTI_CHOICE':
      return (
        a.selectedOptions.length === b.selectedOptions.length &&
        a.selectedOptions.every((val, idx) => val === b.selectedOptions[idx])
      );
    case 'INPUT':
      return a.answerText === b.answerText;
    case 'DROPDOWN':
      return (
        a.dropdownSelections.length === b.dropdownSelections.length &&
        a.dropdownSelections.every(
          (item, idx) =>
            item.blank_id === b.dropdownSelections[idx]?.blank_id &&
            item.value_id === b.dropdownSelections[idx]?.value_id
        )
      );
    case 'MATCHING':
      return (
        a.matchingPairs.length === b.matchingPairs.length &&
        a.matchingPairs.every(
          (item, idx) =>
            item.left_id === b.matchingPairs[idx]?.left_id &&
            item.right_id === b.matchingPairs[idx]?.right_id
        )
      );
    default:
      return false;
  }
}

/**
 * Builds the strict allow-listed CAS autosave payload matching `student-exam.service.js`.
 */
export function buildStrictAutosavePayload(
  draft: LocalAnswerDraft,
  expectedClientSequence: number,
  editToken: string
): AutosavePayload {
  const clientSequence = expectedClientSequence + 1;

  switch (draft.kind) {
    case 'SINGLE_CHOICE':
    case 'MULTI_CHOICE':
      return {
        response_kind: draft.kind,
        expected_client_sequence: expectedClientSequence,
        client_sequence: clientSequence,
        edit_token: editToken,
        selected_options: [...draft.selectedOptions],
      };
    case 'DROPDOWN':
      return {
        response_kind: 'DROPDOWN',
        expected_client_sequence: expectedClientSequence,
        client_sequence: clientSequence,
        edit_token: editToken,
        response_data: {
          kind: 'DROPDOWN',
          selections: draft.dropdownSelections.map((s) => ({
            blank_id: s.blank_id,
            value_id: s.value_id,
          })),
        },
      };
    case 'INPUT':
      return {
        response_kind: 'INPUT',
        expected_client_sequence: expectedClientSequence,
        client_sequence: clientSequence,
        edit_token: editToken,
        answer_text: draft.answerText,
      };
    case 'MATCHING':
      return {
        response_kind: 'MATCHING',
        expected_client_sequence: expectedClientSequence,
        client_sequence: clientSequence,
        edit_token: editToken,
        response_data: {
          kind: 'MATCHING',
          pairs: draft.matchingPairs.map((p) => ({
            left_id: p.left_id,
            right_id: p.right_id,
          })),
        },
      };
    default: {
      const exhaustiveCheck: never = draft.kind;
      throw new Error(`Unsupported question kind: ${String(exhaustiveCheck)}`);
    }
  }
}

const FLAG_STORAGE_PREFIX = 'olms_exam_flags_';
const POS_STORAGE_PREFIX = 'olms_exam_pos_';

export function loadFlaggedQuestionIds(submissionId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${FLAG_STORAGE_PREFIX}${submissionId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function saveFlaggedQuestionIds(
  submissionId: string,
  flaggedIds: Set<string>
): void {
  try {
    window.localStorage.setItem(
      `${FLAG_STORAGE_PREFIX}${submissionId}`,
      JSON.stringify(Array.from(flaggedIds))
    );
  } catch {
    // Ignore quota or storage restriction errors
  }
}

export function clearExamLocalPreferences(submissionId: string): void {
  try {
    window.localStorage.removeItem(`${FLAG_STORAGE_PREFIX}${submissionId}`);
    window.sessionStorage.removeItem(`${POS_STORAGE_PREFIX}${submissionId}`);
  } catch {
    // Ignore
  }
}

export function loadSavedQuestionPosition(submissionId: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(`${POS_STORAGE_PREFIX}${submissionId}`);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveQuestionPosition(submissionId: string, index: number): void {
  try {
    window.sessionStorage.setItem(`${POS_STORAGE_PREFIX}${submissionId}`, String(index));
  } catch {
    // Ignore
  }
}
