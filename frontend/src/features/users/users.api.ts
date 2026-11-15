import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  CreateUserPayload,
  ResetUserPasswordPayload,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  UserRecord,
  UsersPaginationMeta,
  UsersQueryParams,
} from './types';

export async function getUsersApi(
  params: UsersQueryParams,
  signal?: AbortSignal
): Promise<ApiEnvelope<UserRecord[], UsersPaginationMeta>> {
  return apiRequest<UserRecord[], UsersPaginationMeta>('/users', {
    method: 'GET',
    query: {
      q: params.q || undefined,
      role: params.role || undefined,
      status: params.status || undefined,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
    },
    signal,
  });
}

export async function getUserByIdApi(
  userId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<UserRecord>> {
  return apiRequest<UserRecord>(`/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    signal,
  });
}

export async function createUserApi(
  payload: CreateUserPayload
): Promise<ApiEnvelope<UserRecord>> {
  return apiRequest<UserRecord>('/users', {
    method: 'POST',
    body: {
      username: payload.username,
      password: payload.password,
      full_name: payload.full_name,
      email: payload.email,
      role: payload.role,
    },
  });
}

export async function updateUserApi(
  userId: string,
  payload: UpdateUserPayload
): Promise<ApiEnvelope<UserRecord>> {
  return apiRequest<UserRecord>(`/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function updateUserStatusApi(
  userId: string,
  payload: UpdateUserStatusPayload
): Promise<ApiEnvelope<UserRecord>> {
  return apiRequest<UserRecord>(
    `/users/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      body: { status: payload.status },
    }
  );
}

export async function resetUserPasswordApi(
  userId: string,
  payload: ResetUserPasswordPayload
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/users/${encodeURIComponent(userId)}/reset-password`,
    {
      method: 'POST',
      body: { new_password: payload.new_password },
    }
  );
}

export async function softDeleteUserApi(
  userId: string
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/users/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    }
  );
}
