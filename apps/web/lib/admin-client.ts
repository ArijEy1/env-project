import { apiBaseUrl, authStorage } from './auth-client';

export interface AdminStats {
  totalEntities: number;
  totalUsers: number;
  totalAssessments: number;
  submittedAssessments: number;
  averageScore: number | null;
}

export interface AdminEntity {
  id: string;
  nameAr: string;
  nameEn: string | null;
  crNumber: string;
  sector: string;
  city: string;
  region: string | null;
  createdAt: string;
  userCount: number;
  assessmentCount: number;
}

export interface AdminEntityDetail extends AdminEntity {
  employeeCountBracket: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  unifiedNationalNumber: string | null;
  users: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    jobRole: string | null;
    role: string;
    createdAt: string;
  }>;
}

export interface AdminAssessment {
  id: string;
  entityId: string;
  entityNameAr: string;
  entityNameEn: string | null;
  userFullName: string;
  status: string;
  totalScore: number | null;
  maturityLevel: number | null;
  answeredCount: number;
  totalQuestions: number;
  createdAt: string;
  submittedAt: string | null;
}

function getToken(): string {
  const token = localStorage.getItem(authStorage.tokenKey);
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function request<T>(path: string): Promise<T> {
  const token = getToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Request failed');
  }

  return (await response.json()) as T;
}

export function fetchAdminStats() {
  return request<AdminStats>('/admin/stats');
}

export function fetchAdminEntities() {
  return request<AdminEntity[]>('/admin/entities');
}

export function fetchAdminEntity(id: string) {
  return request<AdminEntityDetail>(`/admin/entities/${id}`);
}

export function fetchAdminAssessments() {
  return request<AdminAssessment[]>('/admin/assessments');
}

export async function downloadAdminReport(assessmentId: string) {
  const token = getToken();
  const response = await fetch(`${apiBaseUrl}/admin/assessments/${assessmentId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to download report');

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? 'report.pdf';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
