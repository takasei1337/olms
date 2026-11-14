import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponseData,
  RefreshResponseData,
} from './types';

export async function loginApi(
  payload: LoginRequest
): Promise<ApiEnvelope<LoginResponseData>> {
  return apiRequest<LoginResponseData>('/auth/login', {
    method: 'POST',
    body: payload,
    requiresAuth: false,
    skipAuthRefresh: true,
  });
}

export async function refreshApi(): Promise<ApiEnvelope<RefreshResponseData>> {
  return apiRequest<RefreshResponseData>('/auth/refresh', {
    method: 'POST',
    requiresAuth: false,
    skipAuthRefresh: true,
  });
}

export async function logoutApi(): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>('/auth/logout', {
    method: 'POST',
    requiresAuth: false,
    skipAuthRefresh: true,
  });
}

export async function getMeApi(
  signal?: AbortSignal
): Promise<ApiEnvelope<AuthUser>> {
  return apiRequest<AuthUser>('/auth/me', {
    method: 'GET',
    requiresAuth: true,
    skipAuthRefresh: true,
    signal,
  });
}

export async function changePasswordApi(
  payload: ChangePasswordRequest
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>('/auth/password', {
    method: 'PUT',
    body: payload,
    requiresAuth: true,
  });
}
