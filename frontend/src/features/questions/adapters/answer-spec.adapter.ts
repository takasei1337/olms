import { generateUuid } from '../../../lib/uuid';
import type {
  AnswerSpec,
  QuestionKind,
} from '../types';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Initializes a default valid answer_spec for a given question type.
 */
export function createDefaultAnswerSpec(kind: QuestionKind): AnswerSpec {
  switch (kind) {
    case 'SINGLE_CHOICE': {
      const id1 = generateUuid();
      const id2 = generateUuid();
      const id3 = generateUuid();
      const id4 = generateUuid();
      return {
        schema_version: 1,
        kind: 'SINGLE_CHOICE',
        choices: [
          { id: id1, text: '', order_no: 1, is_correct: true },
          { id: id2, text: '', order_no: 2, is_correct: false },
          { id: id3, text: '', order_no: 3, is_correct: false },
          { id: id4, text: '', order_no: 4, is_correct: false },
        ],
      };
    }
    case 'MULTI_CHOICE': {
      const id1 = generateUuid();
      const id2 = generateUuid();
      const id3 = generateUuid();
      const id4 = generateUuid();
      return {
        schema_version: 1,
        kind: 'MULTI_CHOICE',
        choices: [
          { id: id1, text: '', order_no: 1, is_correct: true },
          { id: id2, text: '', order_no: 2, is_correct: false },
          { id: id3, text: '', order_no: 3, is_correct: false },
          { id: id4, text: '', order_no: 4, is_correct: false },
        ],
      };
    }
    case 'DROPDOWN': {
      return {
        schema_version: 1,
        kind: 'DROPDOWN',
        blanks: [
          {
            blank_id: 'b1',
            choices: [
              { value_id: 'v1', label: '' },
              { value_id: 'v2', label: '' },
            ],
            correct_value_id: 'v1',
          },
        ],
      };
    }
    case 'INPUT': {
      return {
        schema_version: 1,
        kind: 'INPUT',
        equivalent_answers: [''],
      };
    }
    case 'MATCHING': {
      return {
        schema_version: 1,
        kind: 'MATCHING',
        left_items: [
          { id: 'l1', label: '' },
          { id: 'l2', label: '' },
        ],
        right_items: [
          { id: 'r1', label: '' },
          { id: 'r2', label: '' },
        ],
        pairs: [
          { left_id: 'l1', right_id: 'r1' },
          { left_id: 'l2', right_id: 'r2' },
        ],
      };
    }
  }
}

/**
 * Validates the draft answer_spec strictly against backend v1 requirements.
 * Returns null if valid, or a Vietnamese error message if invalid.
 */
export function validateAnswerSpecDraft(
  spec: AnswerSpec,
  questionContent: string
): string | null {
  if (!spec || spec.schema_version !== 1) {
    return 'Cấu trúc câu hỏi không đúng định dạng chuẩn (schema_version 1).';
  }

  switch (spec.kind) {
    case 'SINGLE_CHOICE': {
      if (!Array.isArray(spec.choices) || spec.choices.length < 2) {
        return 'Câu hỏi trắc nghiệm một đáp án phải có tối thiểu 2 lựa chọn.';
      }
      const choiceIds = new Set<string>();
      let correctCount = 0;
      for (let i = 0; i < spec.choices.length; i++) {
        const c = spec.choices[i];
        if (!c.text || !c.text.trim()) {
          return `Lựa chọn thứ ${i + 1} chưa có nội dung đáp án.`;
        }
        if (!c.id || !UUID_REGEX.test(c.id)) {
          return `Lựa chọn thứ ${i + 1} không có mã UUID hợp lệ.`;
        }
        if (choiceIds.has(c.id)) {
          return `Mã định danh của lựa chọn thứ ${i + 1} bị trùng lặp.`;
        }
        choiceIds.add(c.id);
        if (c.is_correct) correctCount++;
      }
      if (correctCount !== 1) {
        return 'Câu hỏi một đáp án phải chọn chính xác 1 đáp án đúng.';
      }
      return null;
    }

    case 'MULTI_CHOICE': {
      if (!Array.isArray(spec.choices) || spec.choices.length < 2) {
        return 'Câu hỏi trắc nghiệm nhiều đáp án phải có tối thiểu 2 lựa chọn.';
      }
      const choiceIds = new Set<string>();
      let correctCount = 0;
      for (let i = 0; i < spec.choices.length; i++) {
        const c = spec.choices[i];
        if (!c.text || !c.text.trim()) {
          return `Lựa chọn thứ ${i + 1} chưa có nội dung đáp án.`;
        }
        if (!c.id || !UUID_REGEX.test(c.id)) {
          return `Lựa chọn thứ ${i + 1} không có mã UUID hợp lệ.`;
        }
        if (choiceIds.has(c.id)) {
          return `Mã định danh của lựa chọn thứ ${i + 1} bị trùng lặp.`;
        }
        choiceIds.add(c.id);
        if (c.is_correct) correctCount++;
      }
      if (correctCount < 1) {
        return 'Câu hỏi nhiều đáp án phải có ít nhất 1 đáp án đúng.';
      }
      return null;
    }

    case 'DROPDOWN': {
      if (!Array.isArray(spec.blanks) || spec.blanks.length < 1) {
        return 'Câu hỏi chọn vào chỗ trống phải có ít nhất 1 chỗ trống (blank).';
      }

      const blankIds = new Set<string>();
      for (let i = 0; i < spec.blanks.length; i++) {
        const b = spec.blanks[i];
        const trimmedBlankId = b.blank_id?.trim();
        if (!trimmedBlankId) {
          return `Chỗ trống thứ ${i + 1} chưa có mã định danh (blank_id).`;
        }
        if (blankIds.has(trimmedBlankId)) {
          return `Mã chỗ trống "${trimmedBlankId}" bị trùng lặp.`;
        }
        blankIds.add(trimmedBlankId);

        if (!Array.isArray(b.choices) || b.choices.length < 2) {
          return `Chỗ trống "${trimmedBlankId}" phải có ít nhất 2 lựa chọn.`;
        }

        const valueIds = new Set<string>();
        for (let j = 0; j < b.choices.length; j++) {
          const ch = b.choices[j];
          if (!ch.value_id?.trim()) {
            return `Lựa chọn ${j + 1} trong chỗ trống "${trimmedBlankId}" thiếu value_id.`;
          }
          if (valueIds.has(ch.value_id)) {
            return `Mã giá trị "${ch.value_id}" bị trùng trong chỗ trống "${trimmedBlankId}".`;
          }
          valueIds.add(ch.value_id);
          if (!ch.label?.trim()) {
            return `Lựa chọn ${j + 1} trong chỗ trống "${trimmedBlankId}" chưa nhập nhãn hiển thị.`;
          }
        }

        if (!b.correct_value_id || !valueIds.has(b.correct_value_id)) {
          return `Chỗ trống "${trimmedBlankId}" phải chọn một đáp án đúng từ danh sách lựa chọn.`;
        }
      }

      // Check placeholders in question content
      const placeholders = questionContent.match(/\{\{([^}]+)\}\}/g) || [];
      const foundPlaceholderIds = placeholders.map((p) => p.slice(2, -2).trim());

      for (const blankId of blankIds) {
        const count = foundPlaceholderIds.filter((id) => id === blankId).length;
        if (count === 0) {
          return `Nội dung câu hỏi chưa chứa placeholder "{{${blankId}}}" cho chỗ trống "${blankId}".`;
        }
        if (count > 1) {
          return `Placeholder "{{${blankId}}}" xuất hiện nhiều hơn 1 lần trong nội dung câu hỏi.`;
        }
      }

      for (const foundId of foundPlaceholderIds) {
        if (!blankIds.has(foundId)) {
          return `Nội dung câu hỏi chứa placeholder lạ "{{${foundId}}}" không có trong danh sách chỗ trống.`;
        }
      }

      return null;
    }

    case 'INPUT': {
      if (
        !Array.isArray(spec.equivalent_answers) ||
        spec.equivalent_answers.length < 1
      ) {
        return 'Câu hỏi điền đáp án phải có ít nhất 1 đáp án chấp nhận.';
      }
      const seen = new Set<string>();
      for (let i = 0; i < spec.equivalent_answers.length; i++) {
        const ans = spec.equivalent_answers[i]?.trim();
        if (!ans) {
          return `Đáp án tương đương thứ ${i + 1} chưa được nhập nội dung.`;
        }
        if (seen.has(ans)) {
          return `Đáp án tương đương "${ans}" bị trùng lặp.`;
        }
        seen.add(ans);
      }
      return null;
    }

    case 'MATCHING': {
      if (!Array.isArray(spec.left_items) || spec.left_items.length < 1) {
        return 'Câu hỏi ghép cặp phải có ít nhất 1 mục bên trái.';
      }
      if (!Array.isArray(spec.right_items) || spec.right_items.length < 1) {
        return 'Câu hỏi ghép cặp phải có ít nhất 1 mục bên phải.';
      }
      if (!Array.isArray(spec.pairs) || spec.pairs.length < 1) {
        return 'Câu hỏi ghép cặp phải có ít nhất 1 cặp ghép.';
      }

      const leftIds = new Set<string>();
      for (let i = 0; i < spec.left_items.length; i++) {
        const it = spec.left_items[i];
        if (!it.id?.trim()) return `Mục trái thứ ${i + 1} thiếu mã ID.`;
        if (leftIds.has(it.id)) return `Mã ID mục trái "${it.id}" bị trùng.`;
        leftIds.add(it.id);
        if (!it.label?.trim()) return `Mục trái thứ ${i + 1} chưa nhập nội dung.`;
      }

      const rightIds = new Set<string>();
      for (let i = 0; i < spec.right_items.length; i++) {
        const it = spec.right_items[i];
        if (!it.id?.trim()) return `Mục phải thứ ${i + 1} thiếu mã ID.`;
        if (rightIds.has(it.id)) return `Mã ID mục phải "${it.id}" bị trùng.`;
        rightIds.add(it.id);
        if (!it.label?.trim()) return `Mục phải thứ ${i + 1} chưa nhập nội dung.`;
      }

      const pairedLeft = new Set<string>();
      const pairedRight = new Set<string>();

      for (let i = 0; i < spec.pairs.length; i++) {
        const p = spec.pairs[i];
        if (!p.left_id || !leftIds.has(p.left_id)) {
          return `Cặp ghép thứ ${i + 1} có vế trái không hợp lệ.`;
        }
        if (!p.right_id || !rightIds.has(p.right_id)) {
          return `Cặp ghép thứ ${i + 1} có vế phải không hợp lệ.`;
        }
        if (pairedLeft.has(p.left_id)) {
          return `Mục trái "${p.left_id}" được ghép nhiều hơn 1 lần.`;
        }
        if (pairedRight.has(p.right_id)) {
          return `Mục phải "${p.right_id}" được ghép nhiều hơn 1 lần.`;
        }
        pairedLeft.add(p.left_id);
        pairedRight.add(p.right_id);
      }

      return null;
    }
  }
}

/**
 * Prepares strict payload answer_spec for POST/PATCH without extra properties.
 */
export function sanitizeAnswerSpecPayload(spec: AnswerSpec): AnswerSpec {
  switch (spec.kind) {
    case 'SINGLE_CHOICE':
      return {
        schema_version: 1,
        kind: 'SINGLE_CHOICE',
        choices: spec.choices.map((c, idx) => ({
          id: c.id,
          text: c.text.trim(),
          order_no: idx + 1,
          is_correct: Boolean(c.is_correct),
        })),
      };
    case 'MULTI_CHOICE':
      return {
        schema_version: 1,
        kind: 'MULTI_CHOICE',
        choices: spec.choices.map((c, idx) => ({
          id: c.id,
          text: c.text.trim(),
          order_no: idx + 1,
          is_correct: Boolean(c.is_correct),
        })),
      };
    case 'DROPDOWN':
      return {
        schema_version: 1,
        kind: 'DROPDOWN',
        blanks: spec.blanks.map((b) => ({
          blank_id: b.blank_id.trim(),
          choices: b.choices.map((ch) => ({
            value_id: ch.value_id.trim(),
            label: ch.label.trim(),
          })),
          correct_value_id: b.correct_value_id.trim(),
        })),
      };
    case 'INPUT':
      return {
        schema_version: 1,
        kind: 'INPUT',
        equivalent_answers: spec.equivalent_answers.map((a) => a.trim()),
      };
    case 'MATCHING':
      return {
        schema_version: 1,
        kind: 'MATCHING',
        left_items: spec.left_items.map((item) => ({
          id: item.id.trim(),
          label: item.label.trim(),
        })),
        right_items: spec.right_items.map((item) => ({
          id: item.id.trim(),
          label: item.label.trim(),
        })),
        pairs: spec.pairs.map((p) => ({
          left_id: p.left_id.trim(),
          right_id: p.right_id.trim(),
        })),
      };
  }
}
