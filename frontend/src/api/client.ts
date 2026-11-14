import type { AuthUser, RefreshResponseData } from '../features/auth/types';

export interface ApiEnvelope<T = unknown, M = unknown> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  meta?: M;
  trace_id?: string;
  timestamp?: string;
}

export interface LockoutData {
  retry_after_seconds?: number;
  locked_until?: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverMessage: string;
  readonly data: unknown;
  readonly traceId?: string;
  readonly isNetworkError: boolean;
  readonly isStaleSession: boolean;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    serverMessage?: string;
    data?: unknown;
    traceId?: string;
    isNetworkError?: boolean;
    isStaleSession?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.serverMessage = params.serverMessage ?? params.message;
    this.data = params.data ?? null;
    this.traceId = params.traceId;
    this.isNetworkError = Boolean(params.isNetworkError);
    this.isStaleSession = Boolean(params.isStaleSession);
  }
}

export function normalizeBaseUrl(rawUrl?: string): string {
  const fallback = 'http://localhost:3000/api/v1';
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/+$/, '');
}

const DEFAULT_API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
let configuredBaseUrl = DEFAULT_API_BASE_URL;

export function setApiBaseUrl(url: string): void {
  configuredBaseUrl = normalizeBaseUrl(url);
}

export function getApiBaseUrl(): string {
  return configuredBaseUrl;
}

export function buildApiUrl(
  path: string,
  query?: Record<string, string | number | undefined | null>
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${configuredBaseUrl}${cleanPath}`;

  if (!query) return fullUrl;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value).trim());
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${fullUrl}?${queryString}` : fullUrl;
}

export function translateApiError(
  status: number,
  code: string,
  serverMessage: string,
  data?: unknown
): string {
  const lockData = (data && typeof data === 'object' ? data : {}) as LockoutData;

  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Tên đăng nhập hoặc mật khẩu không chính xác, hoặc tài khoản đã bị khóa.';
    case 'ACCOUNT_TEMPORARILY_LOCKED': {
      const secs = lockData.retry_after_seconds;
      if (typeof secs === 'number' && secs > 0) {
        return `Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${secs} giây.`;
      }
      return 'Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút.';
    }
    case 'RATE_LIMIT_EXCEEDED': {
      const secs = lockData.retry_after_seconds;
      if (typeof secs === 'number' && secs > 0) {
        return `Quá nhiều yêu cầu đăng nhập trong thời gian ngắn. Vui lòng thử lại sau ${secs} giây.`;
      }
      return 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau.';
    }
    case 'INVALID_CURRENT_PASSWORD':
      return 'Mật khẩu hiện tại không chính xác.';
    case 'PASSWORD_UNCHANGED':
      return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    case 'USER_ALREADY_EXISTS':
      return 'Tên đăng nhập hoặc địa chỉ email đã tồn tại trong hệ thống.';
    case 'USER_NOT_FOUND':
      return 'Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị xóa.';
    case 'CANNOT_LOCK_SELF':
      return 'Quản trị viên không thể tự khóa tài khoản của chính mình.';
    case 'CANNOT_DELETE_SELF':
      return 'Quản trị viên không thể tự xóa tài khoản của chính mình.';
    case 'FORBIDDEN':
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 'ACCESS_TOKEN_MISSING':
    case 'INVALID_ACCESS_TOKEN':
    case 'REFRESH_TOKEN_MISSING':
    case 'INVALID_REFRESH_TOKEN':
      return 'Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại.';
    case 'PAYLOAD_TOO_LARGE':
      if (serverMessage.toLowerCase().includes('5mb') || serverMessage.toLowerCase().includes('5 mb')) {
        return 'Dung lượng tệp hoặc dữ liệu tải lên vượt quá giới hạn tối đa (5MB).';
      }
      return 'Dữ liệu gửi lên vượt quá dung lượng cho phép.';
    case 'EXAM_NOT_FOUND':
      return 'Không tìm thấy kỳ thi hoặc kỳ thi đã bị xóa.';
    case 'EXAM_CODE_CONFLICT':
      return 'Mã kỳ thi đã tồn tại trong hệ thống. Vui lòng chọn mã khác.';
    case 'EXAM_NOT_DRAFT':
      return 'Chỉ có thể chỉnh sửa cấu hình hoặc xóa kỳ thi khi đang ở trạng thái Bản nháp.';
    case 'EXAM_HAS_VARIANTS':
      return 'Kỳ thi đã phát sinh mã đề nên không thể xóa trực tiếp.';
    case 'INVALID_EXAM_TIME_RANGE':
      return 'Thời điểm đóng đề phải diễn ra sau thời điểm mở đề.';
    case 'FORM_TEMPLATE_REQUIRED':
      return 'Hình thức thi trên giấy hoặc kết hợp yêu cầu mã mẫu phiếu OMR (UUID) hợp lệ.';
    case 'EXAM_MATRIX_EMPTY':
      return 'Ma trận đề thi đang trống. Vui lòng thêm ít nhất một dòng cấu hình.';
    case 'EXAM_TOTAL_QUESTIONS_MISMATCH':
      return 'Tổng số câu hỏi của ma trận hoặc đề gốc chưa khớp với tổng số câu của kỳ thi.';
    case 'EXAM_TOTAL_SCORE_MISMATCH':
      return 'Tổng điểm của ma trận hoặc đề gốc chưa khớp với tổng điểm kỳ thi.';
    case 'EXAM_QUESTION_POOL_INSUFFICIENT':
      return 'Ngân hàng câu hỏi đã duyệt chưa đủ số lượng cho cấu hình ma trận hiện tại.';
    case 'GRADING_RULES_MISSING':
      return 'Thiếu quy tắc chấm điểm cho ít nhất một dạng câu hỏi có trong đề. Vui lòng lưu quy tắc chấm trước khi sinh mã đề.';
    case 'NEGATIVE_MARKING_DISALLOWED':
      return 'Hệ thống không cho phép cấu hình điểm trừ âm.';
    case 'TOPIC_POOL_INSUFFICIENT':
      return 'Số lượng chủ đề khác nhau trong ngân hàng câu hỏi chưa đủ cho tùy chọn chống trùng chủ đề.';
    case 'EXAM_PREVIEW_CHANGED':
      return 'Dữ liệu ngân hàng câu hỏi hoặc ma trận đã thay đổi sau lần xem trước. Vui lòng bấm Xem trước lại.';
    case 'EXAM_NOT_OPEN':
      return 'Chưa đến thời gian mở đề nên chưa thể bắt đầu kỳ thi.';
    case 'INVALID_EXAM_STATUS':
      return 'Trạng thái hiện tại của kỳ thi không cho phép thực hiện thao tác này.';
    case 'ROOT_VARIANT_REQUIRED':
      return 'Kỳ thi chưa có đề gốc cố định. Vui lòng tạo hoặc lưu đề gốc trước.';
    case 'ERR_PARTICIPANT_ALREADY_EXISTS':
      return 'Thí sinh với mã số này đã được ghi danh vào kỳ thi.';
    case 'PARTICIPANT_NOT_FOUND':
      return 'Không tìm thấy thí sinh trong kỳ thi.';
    case 'ERR_UNSUPPORTED_IMPORT_FILE':
      return 'Định dạng tệp chưa được hỗ trợ. Vui lòng chỉ chọn tệp .csv hoặc .xlsx.';
    case 'ERR_INVALID_IMPORT_FILE':
      return 'Tệp danh sách thí sinh không hợp lệ hoặc không thể đọc dữ liệu.';
    case 'ERR_INVALID_IMPORT_HEADERS':
      return 'Tệp thiếu cột bắt buộc (cần có cột mã sinh viên và họ tên: student_code, full_name).';
    case 'INVALID_IMPORT_TOKEN':
      return 'Phiên xem trước dữ liệu import đã hết hạn hoặc không còn hợp lệ. Vui lòng tải tệp và xem trước lại.';
    case 'VALIDATION_FAILED':
    case 'VALIDATION_ERROR': {
      if (serverMessage.includes('password must have at least 8 characters') || serverMessage.includes('New password must have at least 8 characters')) {
        return 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
      }
      if (serverMessage.includes('email must be a valid email')) {
        return 'Địa chỉ email không hợp lệ hoặc vượt quá 150 ký tự.';
      }
      if (serverMessage.includes('phone must be null or a valid phone')) {
        return 'Số điện thoại không hợp lệ (chỉ gồm 9-15 chữ số, có thể bắt đầu bằng dấu +).';
      }
      if (serverMessage.includes('role must be ADMIN or TEACHER')) {
        return 'Chỉ có thể cấp vai trò Quản trị viên hoặc Giáo viên.';
      }
      if (serverMessage.includes('username must not exceed 50 characters')) {
        return 'Tên đăng nhập không được vượt quá 50 ký tự.';
      }
      if (serverMessage.includes('full_name')) {
        return 'Họ và tên không được để trống và tối đa 150 ký tự.';
      }
      return serverMessage || 'Thông tin nhập vào chưa hợp lệ. Vui lòng kiểm tra lại các trường.';
    }
    default: {
      if (status === 403) return 'Bạn không có quyền truy cập trang hoặc thực hiện thao tác này.';
      if (status === 404) return 'Không tìm thấy dữ liệu hoặc trang yêu cầu.';
      if (status === 409) return serverMessage || 'Thông tin bị trùng với dữ liệu đã có.';
      if (status === 429) return 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng đợi ít phút rồi thử lại.';
      if (status >= 500) return 'Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.';
      return serverMessage || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
    }
  }
}

// In-memory session state (NEVER stored in localStorage / sessionStorage)
let inMemoryAccessToken: string | null = null;
let inMemoryUserSnapshot: AuthUser | null = null;
let sessionEpoch = 0;
let activeRefreshPromise: Promise<string | null> | null = null;
let lastPeerTokenUpdateAt = 0;

export type SessionBroadcastEvent =
  | {
      type: 'TOKEN_REFRESHED';
      accessToken: string;
      expiresIn: number;
      timestamp: number;
      tabId: string;
    }
  | {
      type: 'LOGIN_COMPLETED';
      accessToken: string;
      expiresIn: number;
      user: AuthUser;
      timestamp: number;
      tabId: string;
    }
  | {
      type: 'SESSION_CLEARED';
      reason: 'logout' | 'password_changed' | 'expired';
      timestamp: number;
      tabId: string;
    }
  | {
      type: 'REQUEST_PEER_TOKEN';
      requestId: string;
      tabId: string;
    }
  | {
      type: 'PROVIDE_PEER_TOKEN';
      requestId: string;
      accessToken: string;
      user: AuthUser | null;
      timestamp: number;
      tabId: string;
    };

type SessionSyncListener = (event: SessionBroadcastEvent) => void;
const syncListeners = new Set<SessionSyncListener>();
const sensitiveCacheListeners = new Set<() => void>();

const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).slice(2)}`;

let broadcastChannel: BroadcastChannel | null = null;
const pendingPeerWaiters = new Map<
  string,
  (payload: { accessToken: string; user: AuthUser | null }) => void
>();

function ensureBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (broadcastChannel) return broadcastChannel;

  try {
    broadcastChannel = new BroadcastChannel('olms_auth_channel');
    broadcastChannel.onmessage = (ev: MessageEvent<SessionBroadcastEvent>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object' || msg.tabId === TAB_ID) return;

      if (msg.type === 'TOKEN_REFRESHED') {
        inMemoryAccessToken = msg.accessToken;
        lastPeerTokenUpdateAt = msg.timestamp;
        for (const listener of syncListeners) listener(msg);
      } else if (msg.type === 'LOGIN_COMPLETED') {
        sessionEpoch += 1;
        inMemoryAccessToken = msg.accessToken;
        inMemoryUserSnapshot = msg.user;
        lastPeerTokenUpdateAt = msg.timestamp;
        for (const listener of syncListeners) listener(msg);
      } else if (msg.type === 'SESSION_CLEARED') {
        clearInMemorySessionInternal(false);
        for (const listener of syncListeners) listener(msg);
      } else if (msg.type === 'REQUEST_PEER_TOKEN') {
        if (inMemoryAccessToken) {
          broadcastChannel?.postMessage({
            type: 'PROVIDE_PEER_TOKEN',
            requestId: msg.requestId,
            accessToken: inMemoryAccessToken,
            user: inMemoryUserSnapshot,
            timestamp: Date.now(),
            tabId: TAB_ID,
          } satisfies SessionBroadcastEvent);
        }
      } else if (msg.type === 'PROVIDE_PEER_TOKEN') {
        const waiter = pendingPeerWaiters.get(msg.requestId);
        if (waiter && msg.accessToken) {
          pendingPeerWaiters.delete(msg.requestId);
          waiter({ accessToken: msg.accessToken, user: msg.user });
        }
      }
    };
  } catch {
    broadcastChannel = null;
  }

  return broadcastChannel;
}

ensureBroadcastChannel();

function requestTokenFromPeerTabs(
  timeoutMs = 140
): Promise<{ accessToken: string; user: AuthUser | null } | null> {
  const channel = ensureBroadcastChannel();
  if (!channel) return Promise.resolve(null);

  const requestId = `${TAB_ID}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPeerWaiters.delete(requestId);
      resolve(null);
    }, timeoutMs);

    pendingPeerWaiters.set(requestId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    try {
      channel.postMessage({
        type: 'REQUEST_PEER_TOKEN',
        requestId,
        tabId: TAB_ID,
      } satisfies SessionBroadcastEvent);
    } catch {
      clearTimeout(timer);
      pendingPeerWaiters.delete(requestId);
      resolve(null);
    }
  });
}

export function onSessionBroadcast(listener: SessionSyncListener): () => void {
  ensureBroadcastChannel();
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function onClearSensitiveCache(listener: () => void): () => void {
  sensitiveCacheListeners.add(listener);
  return () => {
    sensitiveCacheListeners.delete(listener);
  };
}

function clearInMemorySessionInternal(shouldBroadcast: boolean, reason: 'logout' | 'password_changed' | 'expired' = 'expired'): void {
  sessionEpoch += 1;
  inMemoryAccessToken = null;
  inMemoryUserSnapshot = null;
  activeRefreshPromise = null;

  for (const clearCache of sensitiveCacheListeners) {
    try {
      clearCache();
    } catch {
      // Ignore cache listener errors
    }
  }

  if (shouldBroadcast) {
    try {
      ensureBroadcastChannel()?.postMessage({
        type: 'SESSION_CLEARED',
        reason,
        timestamp: Date.now(),
        tabId: TAB_ID,
      } satisfies SessionBroadcastEvent);
    } catch {
      // Ignore broadcast errors
    }
  }
}

export function clearSessionMemory(
  options: { broadcast?: boolean; reason?: 'logout' | 'password_changed' | 'expired' } = {}
): void {
  clearInMemorySessionInternal(options.broadcast ?? true, options.reason ?? 'expired');
}

export function setSessionMemory(
  accessToken: string,
  user?: AuthUser | null,
  options: { broadcastLogin?: boolean; expiresIn?: number } = {}
): void {
  inMemoryAccessToken = accessToken;
  if (user !== undefined) {
    inMemoryUserSnapshot = user;
  }

  if (options.broadcastLogin && user) {
    try {
      ensureBroadcastChannel()?.postMessage({
        type: 'LOGIN_COMPLETED',
        accessToken,
        expiresIn: options.expiresIn ?? 900,
        user,
        timestamp: Date.now(),
        tabId: TAB_ID,
      } satisfies SessionBroadcastEvent);
    } catch {
      // Ignore broadcast error
    }
  }
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getSessionEpoch(): number {
  return sessionEpoch;
}

const NON_REFRESHABLE_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

/**
 * Single-flight refresh token rotation with multi-tab rotation race protection.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const startEpoch = sessionEpoch;
  const tokenBeforeRefresh = inMemoryAccessToken;

  activeRefreshPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (sessionEpoch !== startEpoch) {
        return null;
      }

      let body: ApiEnvelope<RefreshResponseData> | null = null;
      try {
        body = (await response.json()) as ApiEnvelope<RefreshResponseData>;
      } catch {
        body = null;
      }

      if (response.ok && body?.success && body.data?.access_token) {
        const newToken = body.data.access_token;
        inMemoryAccessToken = newToken;
        lastPeerTokenUpdateAt = Date.now();

        try {
          ensureBroadcastChannel()?.postMessage({
            type: 'TOKEN_REFRESHED',
            accessToken: newToken,
            expiresIn: body.data.expires_in ?? 900,
            timestamp: lastPeerTokenUpdateAt,
            tabId: TAB_ID,
          } satisfies SessionBroadcastEvent);
        } catch {
          // Ignore broadcast error
        }

        return newToken;
      }

      // Handle multi-tab token rotation race:
      // If another tab just refreshed and updated our inMemoryAccessToken while this request was in flight,
      // or if a peer tab currently holds a fresh active token, adopt it instead of treating rotation race as dead session.
      if (response.status === 401) {
        if (
          inMemoryAccessToken &&
          inMemoryAccessToken !== tokenBeforeRefresh &&
          Date.now() - lastPeerTokenUpdateAt < 5000
        ) {
          return inMemoryAccessToken;
        }

        const peerSession = await requestTokenFromPeerTabs(140);
        if (sessionEpoch !== startEpoch) {
          return null;
        }
        if (peerSession?.accessToken && peerSession.accessToken !== tokenBeforeRefresh) {
          inMemoryAccessToken = peerSession.accessToken;
          if (peerSession.user) {
            inMemoryUserSnapshot = peerSession.user;
          }
          return peerSession.accessToken;
        }
      }

      clearInMemorySessionInternal(false, 'expired');
      return null;
    } catch {
      clearInMemorySessionInternal(false, 'expired');
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export function _resetClientForTests(): void {
  inMemoryAccessToken = null;
  inMemoryUserSnapshot = null;
  sessionEpoch = 0;
  activeRefreshPromise = null;
  lastPeerTokenUpdateAt = 0;
  configuredBaseUrl = DEFAULT_API_BASE_URL;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  requiresAuth?: boolean;
  skipAuthRefresh?: boolean;
  _retried?: boolean;
}

export async function apiRequest<T = unknown, M = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiEnvelope<T, M>> {
  const {
    query,
    body,
    requiresAuth = true,
    skipAuthRefresh = false,
    _retried = false,
    headers: customHeaders,
    ...restInit
  } = options;

  const requestEpoch = sessionEpoch;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = buildApiUrl(cleanPath, query);

  const headers = new Headers(customHeaders);
  headers.set('Accept', 'application/json');

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (requiresAuth && inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...restInit,
      credentials: 'include',
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
          ? body
          : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message:
        'Không thể kết nối tới hệ thống OLMS. Vui lòng kiểm tra kết nối mạng và thử lại.',
      serverMessage: err instanceof Error ? err.message : 'Network error',
      isNetworkError: true,
    });
  }

  // Block stale responses if user logged out or switched session while request was in flight
  if (requiresAuth && sessionEpoch !== requestEpoch) {
    throw new ApiError({
      status: 401,
      code: 'SESSION_STALE',
      message: 'Phiên làm việc đã thay đổi hoặc đã đăng xuất.',
      isStaleSession: true,
    });
  }

  let parsed: ApiEnvelope<T, M> | null = null;
  try {
    parsed = (await response.json()) as ApiEnvelope<T, M>;
  } catch {
    parsed = null;
  }

  const errorCode = parsed?.code || (response.ok ? 'SUCCESS' : `HTTP_${response.status}`);
  const serverMessage = parsed?.message || response.statusText || '';
  const traceId = parsed?.trace_id || response.headers.get('X-Trace-Id') || undefined;

  // Handle 401 Unauthorized -> Single-flight refresh & 1x retry
  // Do NOT refresh for login/refresh/logout, and do NOT refresh for INVALID_CURRENT_PASSWORD (PUT /auth/password)
  const canAttemptRefresh =
    response.status === 401 &&
    requiresAuth &&
    !skipAuthRefresh &&
    !_retried &&
    !NON_REFRESHABLE_PATHS.has(cleanPath) &&
    errorCode !== 'INVALID_CURRENT_PASSWORD';

  if (canAttemptRefresh) {
    const newAccessToken = await refreshAccessToken();

    if (newAccessToken && sessionEpoch === requestEpoch) {
      return apiRequest<T, M>(cleanPath, {
        ...options,
        _retried: true,
      });
    }

    for (const listener of syncListeners) {
      listener({
        type: 'SESSION_CLEARED',
        reason: 'expired',
        timestamp: Date.now(),
        tabId: TAB_ID,
      });
    }
    throw new ApiError({
      status: 401,
      code: errorCode,
      message: translateApiError(401, errorCode, serverMessage, parsed?.data),
      serverMessage,
      data: parsed?.data,
      traceId,
    });
  }

  // If a retried authenticated request still returns 401 (e.g. user was locked/deleted), clear session
  if (
    response.status === 401 &&
    requiresAuth &&
    _retried &&
    !NON_REFRESHABLE_PATHS.has(cleanPath) &&
    errorCode !== 'INVALID_CURRENT_PASSWORD'
  ) {
    clearInMemorySessionInternal(false, 'expired');
    for (const listener of syncListeners) {
      listener({
        type: 'SESSION_CLEARED',
        reason: 'expired',
        timestamp: Date.now(),
        tabId: TAB_ID,
      });
    }
  }

  if (!response.ok || (parsed && parsed.success === false)) {
    throw new ApiError({
      status: response.status,
      code: errorCode,
      message: translateApiError(response.status, errorCode, serverMessage, parsed?.data),
      serverMessage,
      data: parsed?.data,
      traceId,
    });
  }

  if (!parsed) {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE_FORMAT',
      message: 'Phản hồi từ máy chủ không đúng định dạng JSON.',
      traceId,
    });
  }

  return parsed;
}
