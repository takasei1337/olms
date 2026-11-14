# OLMS Design System & Token Architecture

Hệ thống Design Tokens chuẩn hóa cho giao diện Frontend OLMS (Online Learning & Examination Management System), theo kiến trúc 3 tầng. Sử dụng semantic token trong component; cập nhật nguồn và adapter nhất quán khi bổ sung token.

---

## 1. Cấu trúc 3 tầng Tokens (3-Layer Architecture)

```mermaid
flowchart TD
    Primitive["Tầng 1: Primitive Tokens (Giá trị thô / Raw Values)<br/>Màu gốc, Thang Spacing, Font, Border Radius"]
    Semantic["Tầng 2: Semantic Tokens (Ý nghĩa nghiệp vụ & Dark Mode)<br/>Surface, Text, Status, Exam Status, AI Badge, OMR State"]
    Component["Tầng 3: Component Specs (Quy chuẩn từng thành phần UI)<br/>QuestionCard, ExamTimer, MatrixGrid, OMRViewer"]

    Primitive --> Semantic --> Component
```

1. **Primitive Tokens (`tokens.json` -> `primitive`)**:
   - Thang màu thương hiệu xanh Navy/Indigo học thuật (`#2563EB`, `#1D4ED8`, `#1E40AF`).
   - Thang màu trung tính Slate/Gray, thang đo khoảng cách 4px-base, radius, typography.
2. **Semantic Tokens (`tokens.json` -> `semantic` & `tokens.css` -> `--olms-*`)**:
   - Trạng thái bề mặt (`--olms-surface-canvas` / `surface-canvas`, `--olms-surface-card` / `surface-card`, `--olms-surface-border` / `surface-border`).
   - Ngữ cảnh học tập & thi cử:
     - **Exam Autosave Status**: `--olms-exam-status-saved` / `exam-saved` (xanh lá), `--olms-exam-status-saving` / `exam-saving` (hổ phách), `--olms-exam-status-unanswered` / `exam-unanswered` (xám viền đứt), `--olms-exam-status-flagged` / `exam-flagged` (tím nhạt).
     - **Exam Countdown Timer**: `--olms-timer-normal` / `timer-normal` (bình thường), `--olms-timer-warning` / `timer-warning` (< 5 phút), `--olms-timer-critical` / `timer-critical` (< 1 phút, kèm cảnh báo chữ, không nhấp nháy).
     - **AI Similarity Warning**: `--olms-ai-similarity-badge` / `ai-similarity` & `--olms-ai-override-notice` / `ai-override` phục vụ cảnh báo trùng ý tưởng câu hỏi.
     - **OMR Bubble Status**: `--olms-omr-valid` / `omr-valid`, `--olms-omr-invalid` / `omr-invalid`, `--olms-omr-ambiguous` / `omr-ambiguous` (chấm phiếu trắc nghiệm).
3. **Component Specs (`tokens.json` -> `component`)**:
   - Quy chuẩn chi tiết cho `question_card`, `exam_timer`, `matrix_grid`, `omr_viewer`.

---

## 2. Hướng dẫn tích hợp Frontend (React / Vite / Next.js)

### Cách 1: Sử dụng qua CSS Variables (`tokens.css`)
Import trực tiếp vào file CSS gốc (`index.css` hoặc `globals.css`):
```css
@import './design-tokens/tokens.css';
```
Hỗ trợ chuyển đổi giao diện sáng/tối tự động bằng cách gán class `.dark` vào thẻ `<html>` hoặc `<body>`.

### Cách 2: Tích hợp với Tailwind CSS (`tailwind.config.js`)
Ví dụ cấu hình theo kiểu Tailwind 3; kiểm tra major version đã cài trước khi tích hợp, không chép nguyên sang Tailwind 4. Điều chỉnh đường dẫn import theo vị trí frontend thực tế. Trong file `tailwind.config.js`:
```javascript
const olmsTokens = require('./design-tokens/tailwind.tokens.js');

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      ...olmsTokens.theme.extend,
    },
  },
  plugins: [],
};
```

---

## 3. Ví dụ triển khai Component thực tế

### 3.1. Thẻ câu hỏi khi thi trực tuyến (`QuestionCard`)
```tsx
export function QuestionCard({ questionNo, status, content, children }) {
  // status: 'saved' | 'saving' | 'unanswered' | 'flagged'
  const borderStyles = {
    saved: 'border-exam-saved bg-surface-card',
    saving: 'border-exam-saving bg-surface-card',
    unanswered: 'border-surface-border border-dashed',
    flagged: 'border-exam-flagged bg-surface-card',
  };

  return (
    <div className={`p-4 rounded border transition-colors ${borderStyles[status]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-text-primary">Câu {questionNo}</span>
        <span className="text-xs text-text-secondary">{status.toUpperCase()}</span>
      </div>
      <div className="text-text-primary text-sm leading-relaxed mb-4">{content}</div>
      <div>{children}</div>
    </div>
  );
}
```

### 3.2. Đồng hồ đếm ngược phòng thi (`ExamTimer`)
```tsx
export function ExamTimer({ remainingSeconds }) {
  const isCritical = remainingSeconds < 60;
  const isWarning = remainingSeconds < 300 && !isCritical;

  const timerColor = isCritical
    ? 'text-timer-critical'
    : isWarning
    ? 'text-timer-warning'
    : 'text-timer-normal';

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div role="timer" aria-label="Thời gian còn lại" aria-live="off" className="flex items-center space-x-2 font-mono text-lg font-bold tabular-nums">
      <span className={timerColor}>{formatTime(remainingSeconds)}</span>
      {isCritical && <span className="text-text-primary">Còn dưới 1 phút</span>}
    </div>
  );
}
```

---

## 4. Danh mục File cấu thành
- `design-tokens/tokens.json`: Cấu trúc JSON nguồn gồm 3 tầng token.
- `design-tokens/tokens.css`: Định nghĩa CSS Variables hỗ trợ theme sáng & dark mode.
- `design-tokens/tailwind.tokens.js`: Adapter kết nối token vào Tailwind utility classes.
- `design-tokens/README.md`: Tài liệu hướng dẫn thiết kế và sử dụng.
