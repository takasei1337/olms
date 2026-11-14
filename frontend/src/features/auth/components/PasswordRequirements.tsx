import { Check, Circle } from 'lucide-react';
import { evaluatePasswordComplexity } from '../types';

interface PasswordRequirementsProps {
  password: string;
  id?: string;
}

export function PasswordRequirements({ password, id }: PasswordRequirementsProps) {
  const checks = evaluatePasswordComplexity(password);
  const hasTyped = password.length > 0;

  const rules = [
    { key: 'minLength', label: 'Ít nhất 8 ký tự', passed: checks.minLength },
    { key: 'hasUppercase', label: 'Chữ in hoa (A-Z)', passed: checks.hasUppercase },
    { key: 'hasLowercase', label: 'Chữ thường (a-z)', passed: checks.hasLowercase },
    { key: 'hasNumber', label: 'Chữ số (0-9)', passed: checks.hasNumber },
    {
      key: 'hasSpecial',
      label: 'Ký tự đặc biệt (!@#...)',
      passed: checks.hasSpecial,
    },
  ];

  const passedCount = rules.filter((r) => r.passed).length;

  return (
    <div
      id={id}
      className="rounded-md border border-surface-border bg-surface-muted/70 px-3 py-2 text-xs"
      aria-label="Yêu cầu độ mạnh mật khẩu"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-medium text-text-primary">Yêu cầu mật khẩu</span>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            hasTyped && checks.isValid
              ? 'font-semibold text-semantic-success'
              : 'text-text-secondary'
          }`}
        >
          {hasTyped && checks.isValid
            ? 'Đã đạt đủ 5/5'
            : `${hasTyped ? passedCount : 0}/5 tiêu chí`}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        {rules.map((rule, index) => {
          const statusClass =
            hasTyped && rule.passed
              ? 'text-semantic-success font-medium'
              : 'text-text-secondary';
          const spanClass = index === rules.length - 1 ? 'sm:col-span-2' : '';

          return (
            <li
              key={rule.key}
              className={`flex items-center gap-1.5 ${spanClass} ${statusClass}`}
            >
              {hasTyped && rule.passed ? (
                <Check
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-semantic-success"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-text-secondary/70"
                />
              )}
              <span>
                {rule.label}
                <span className="sr-only">
                  {rule.passed ? ' (Đã đạt)' : ' (Chưa đạt)'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
