export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'INACTIVE';

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponseData {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface RefreshResponseData {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Sinh viên',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Đã khóa',
  INACTIVE: 'Ngừng hoạt động',
};

export interface PasswordValidationChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function evaluatePasswordComplexity(password: string): PasswordValidationChecks {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    isValid: minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial,
  };
}
