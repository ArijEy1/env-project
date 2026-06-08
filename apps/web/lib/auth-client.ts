export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface EntityInfo {
  id: string;
  nameAr: string;
  nameEn: string | null;
  crNumber: string;
  sector: string;
  city: string;
  region: string | null;
  employeeCountBracket: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  unifiedNationalNumber: string | null;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  entityId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  jobRole: string | null;
  role: string;
  createdAt: string;
  entity: EntityInfo;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface RegisterPayload {
  entity: {
    nameAr: string;
    nameEn?: string;
    crNumber: string;
    sector: string;
    city: string;
    region?: string;
    employeeCountBracket?: string;
    contactEmail?: string;
    contactPhone?: string;
    unifiedNationalNumber?: string;
  };
  user: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    jobRole?: string;
    password: string;
  };
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

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobRole?: string;
}

export interface UpdateEntityPayload {
  nameAr?: string;
  nameEn?: string;
  sector?: string;
  city?: string;
  region?: string;
  employeeCountBracket?: string;
  contactEmail?: string;
  contactPhone?: string;
  unifiedNationalNumber?: string;
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

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
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
    headers: authHeaders(token),
  });
}

export function updateProfile(token: string, payload: UpdateProfilePayload) {
  return request<AuthUser>('/auth/profile', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateEntity(token: string, payload: UpdateEntityPayload) {
  return request<EntityInfo>('/auth/entity', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export const authStorage = {
  tokenKey: 'env-project-token',
  userKey: 'env-project-user',
};
