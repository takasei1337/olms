import type { UserRole, UserStatus } from '../auth/types';

export interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  email?: string;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UsersPaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface UsersQueryParams {
  q?: string;
  role?: UserRole | '';
  status?: UserStatus | '';
  page?: number;
  page_size?: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  full_name: string;
  email: string;
  role: 'ADMIN' | 'TEACHER';
}

export interface UpdateUserPayload {
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: 'ADMIN' | 'TEACHER';
}

export interface UpdateUserStatusPayload {
  status: 'ACTIVE' | 'LOCKED';
}

export interface ResetUserPasswordPayload {
  new_password: string;
}
