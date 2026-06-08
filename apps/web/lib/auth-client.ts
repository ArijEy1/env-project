export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  countryCode: string | null;
  entity: string | null;
  jobRole: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName?: string;
  fullName: string;
  email: string;
  phone?: string;
  countryCode?: string;
  entity?: string;
  jobRole?: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface ApiMessageResponse {
  message: string;
}

interface ErrorPayload {
  message?: string | string[];
}

async function parseError(response: Response) {
  const fallbackMessage = 'An unexpected error occurred.';

  try {
    const payload = (await response.json()) as ErrorPayload;

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }

    return payload.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export function registerUser(payload: RegisterPayload) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestPasswordReset(payload: ForgotPasswordPayload) {
  return request<ApiMessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: ResetPasswordPayload) {
  return request<ApiMessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchProfile(token: string) {
  return request<AuthUser>('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export const authStorage = {
  tokenKey: 'env-project-token',
  userKey: 'env-project-user',
};
