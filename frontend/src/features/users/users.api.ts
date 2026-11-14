import {
  apiRequest,
  onClearSensitiveCache,
  type ApiEnvelope,
} from '../../api/client';
import type {
  CreateUserPayload,
  ResetUserPasswordPayload,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  UserRecord,
  UsersPaginationMeta,
  UsersQueryParams,
} from './types';

interface ExtraUserMetadata {
  email?: string;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Session-scoped in-memory metadata cache for fields returned by POST/PATCH
// that GET /users and GET /users/:id do not select. Cleared automatically on logout/session clear.
const sessionUserMetadata = new Map<string, ExtraUserMetadata>();

onClearSensitiveCache(() => {
  sessionUserMetadata.clear();
});

export function _clearUserMetadataCacheForTests(): void {
  sessionUserMetadata.clear();
}

function captureAndMergeUser(user: UserRecord): UserRecord {
  const existing = sessionUserMetadata.get(user.id) || {};
  const nextMeta: ExtraUserMetadata = {
    email: user.email !== undefined ? user.email : existing.email,
    phone: user.phone !== undefined ? user.phone : existing.phone,
    created_at: user.created_at !== undefined ? user.created_at : existing.created_at,
    updated_at: user.updated_at !== undefined ? user.updated_at : existing.updated_at,
  };

  if (
    nextMeta.email !== undefined ||
    nextMeta.phone !== undefined ||
    nextMeta.created_at !== undefined ||
    nextMeta.updated_at !== undefined
  ) {
    sessionUserMetadata.set(user.id, nextMeta);
  }

  return {
    ...user,
    ...nextMeta,
  };
}

export async function getUsersApi(
  params: UsersQueryParams,
  signal?: AbortSignal
): Promise<ApiEnvelope<UserRecord[], UsersPaginationMeta>> {
  const response = await apiRequest<UserRecord[], UsersPaginationMeta>('/users', {
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

  return {
    ...response,
    data: Array.isArray(response.data) ? response.data.map(captureAndMergeUser) : [],
  };
}

export async function getUserByIdApi(
  userId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<UserRecord>> {
  const response = await apiRequest<UserRecord>(`/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
    signal,
  });

  return {
    ...response,
    data: captureAndMergeUser(response.data),
  };
}

export async function createUserApi(
  payload: CreateUserPayload
): Promise<ApiEnvelope<UserRecord>> {
  const response = await apiRequest<UserRecord>('/users', {
    method: 'POST',
    body: {
      username: payload.username,
      password: payload.password,
      full_name: payload.full_name,
      email: payload.email,
      role: payload.role,
    },
  });

  return {
    ...response,
    data: captureAndMergeUser(response.data),
  };
}

export async function updateUserApi(
  userId: string,
  payload: UpdateUserPayload
): Promise<ApiEnvelope<UserRecord>> {
  const response = await apiRequest<UserRecord>(`/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: payload,
  });

  return {
    ...response,
    data: captureAndMergeUser(response.data),
  };
}

export async function updateUserStatusApi(
  userId: string,
  payload: UpdateUserStatusPayload
): Promise<ApiEnvelope<UserRecord>> {
  const response = await apiRequest<UserRecord>(
    `/users/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      body: { status: payload.status },
    }
  );

  return {
    ...response,
    data: captureAndMergeUser(response.data),
  };
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
  const response = await apiRequest<Record<string, never>>(
    `/users/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    }
  );
  sessionUserMetadata.delete(userId);
  return response;
}
