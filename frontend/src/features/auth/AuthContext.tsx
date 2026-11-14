import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ApiError,
  clearSessionMemory,
  getSessionEpoch,
  onSessionBroadcast,
  refreshAccessToken,
  setSessionMemory,
} from '../../api/client';
import { getMeApi, loginApi, logoutApi } from './auth.api';
import type { AuthUser, LoginRequest } from './types';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export interface SessionNotice {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface LogoutResult {
  serverRevoked: boolean;
  error?: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  sessionNotice: SessionNotice | null;
  isLoggingOut: boolean;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  logout: () => Promise<LogoutResult>;
  clearNotice: () => void;
  setNotice: (notice: SessionNotice | null) => void;
  handlePasswordChanged: () => void;
  updateCurrentUser: (updates: Partial<AuthUser>) => void;
  refreshProfile: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Module-level deduplication for session bootstrap under React StrictMode double-mounting
let bootstrapInFlightPromise: Promise<AuthUser | null> | null = null;

export function _resetAuthBootstrapForTests(): void {
  bootstrapInFlightPromise = null;
}

async function performSessionBootstrap(): Promise<AuthUser | null> {
  if (bootstrapInFlightPromise) {
    return bootstrapInFlightPromise;
  }

  const startEpoch = getSessionEpoch();

  bootstrapInFlightPromise = (async () => {
    try {
      const token = await refreshAccessToken();
      if (!token || getSessionEpoch() !== startEpoch) {
        return null;
      }

      const meResponse = await getMeApi();
      if (getSessionEpoch() !== startEpoch) {
        return null;
      }

      const user = meResponse.data;
      setSessionMemory(token, user);
      return user;
    } catch {
      if (getSessionEpoch() === startEpoch) {
        clearSessionMemory({ broadcast: false, reason: 'expired' });
      }
      return null;
    } finally {
      bootstrapInFlightPromise = null;
    }
  })();

  return bootstrapInFlightPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    const mountEpoch = getSessionEpoch();

    performSessionBootstrap().then((restoredUser) => {
      if (!mounted) return;
      if (getSessionEpoch() !== mountEpoch && !restoredUser) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      if (restoredUser) {
        setUser(restoredUser);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionBroadcast((event) => {
      if (event.type === 'SESSION_CLEARED') {
        setUser(null);
        setStatus('unauthenticated');
        if (event.reason === 'password_changed') {
          setSessionNotice({
            type: 'info',
            message:
              'Mật khẩu đã được thay đổi ở cửa sổ khác. Vui lòng đăng nhập lại bằng mật khẩu mới.',
          });
        } else if (event.reason === 'expired') {
          setSessionNotice({
            type: 'warning',
            message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          });
        } else {
          setSessionNotice({
            type: 'info',
            message: 'Bạn đã đăng xuất khỏi hệ thống.',
          });
        }
      } else if (event.type === 'LOGIN_COMPLETED') {
        setUser(event.user);
        setStatus('authenticated');
        setSessionNotice(null);
      }
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (credentials: LoginRequest): Promise<AuthUser> => {
    const response = await loginApi({
      username: credentials.username.trim(),
      password: credentials.password,
    });

    const { access_token, expires_in, user: loggedInUser } = response.data;
    setSessionMemory(access_token, loggedInUser, {
      broadcastLogin: true,
      expiresIn: expires_in,
    });
    setUser(loggedInUser);
    setStatus('authenticated');
    setSessionNotice(null);
    return loggedInUser;
  }, []);

  const logout = useCallback(async (): Promise<LogoutResult> => {
    setIsLoggingOut(true);
    // Immediately invalidate session epoch and clear sensitive memory/caches so in-flight responses cannot write back
    clearSessionMemory({ broadcast: true, reason: 'logout' });

    try {
      await logoutApi();
      setUser(null);
      setStatus('unauthenticated');
      setSessionNotice({
        type: 'info',
        message: 'Bạn đã đăng xuất khỏi hệ thống.',
      });
      return { serverRevoked: true };
    } catch (err) {
      const errorDetail =
        err instanceof ApiError
          ? err.message
          : 'Không thể kết nối tới hệ thống.';
      setUser(null);
      setStatus('unauthenticated');
      setSessionNotice({
        type: 'error',
        message: `Đã đăng xuất trên trình duyệt này, nhưng chưa thể kết nối để đóng phiên từ xa (${errorDetail}). Vui lòng kiểm tra kết nối mạng hoặc đóng trình duyệt.`,
      });
      return { serverRevoked: false, error: errorDetail };
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  const handlePasswordChanged = useCallback(() => {
    clearSessionMemory({ broadcast: true, reason: 'password_changed' });
    setUser(null);
    setStatus('unauthenticated');
    setSessionNotice({
      type: 'success',
      message:
        'Đã đổi mật khẩu. Bạn đã được đăng xuất khỏi mọi thiết bị — vui lòng đăng nhập lại bằng mật khẩu mới.',
    });
  }, []);

  const updateCurrentUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const refreshProfile = useCallback(async (): Promise<AuthUser | null> => {
    const startEpoch = getSessionEpoch();
    try {
      const response = await getMeApi();
      if (getSessionEpoch() !== startEpoch) return null;
      setUser(response.data);
      return response.data;
    } catch {
      return null;
    }
  }, []);

  const clearNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionNotice,
      isLoggingOut,
      login,
      logout,
      clearNotice,
      setNotice: setSessionNotice,
      handlePasswordChanged,
      updateCurrentUser,
      refreshProfile,
    }),
    [
      status,
      user,
      sessionNotice,
      isLoggingOut,
      login,
      logout,
      clearNotice,
      handlePasswordChanged,
      updateCurrentUser,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  }
  return ctx;
}
