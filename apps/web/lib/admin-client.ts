import { apiBaseUrl, authStorage } from './auth-client';

export interface AdminSectorStat {
  sector: string;
  entityCount: number;
  completed: number;
  averageMaturity: number | null;
}

export interface AdminStats {
  totalEntities: number;
  totalUsers: number;
  totalAssessments: number;
  submittedAssessments: number;
  averageScore: number | null;
  averageMaturity: number | null;
  reportDownloads: number;
  bySector: AdminSectorStat[];
}

export interface AdminGlossaryTerm {
  id: string;
  termAr: string;
  termEn: string | null;
  definitionAr: string;
  definitionEn: string | null;
  category: string | null;
  active: boolean;
}

export interface AdminQuestion {
  id: string;
  domainId: string;
  domainNameEn: string;
  textAr: string;
  textEn: string;
  helpTextAr: string | null;
  helpTextEn: string | null;
  materialityTopicId: string | null;
  baseWeight: number;
  calculatorType: string | null;
  active: boolean;
}

export interface AdminRecommendation {
  id: string;
  materialityTopicId: string | null;
  domainId: string;
  triggerMaxScore: number;
  immediateActionAr: string;
  immediateActionEn: string;
  shortTermActionAr: string;
  shortTermActionEn: string;
  mediumTermActionAr: string;
  mediumTermActionEn: string;
  costEstimate: string | null;
  effortLevel: string;
  scoreImpactPoints: number;
  timelineWeeks: number;
  legalReference: string | null;
  active: boolean;
}

export interface AdminRegMapping {
  id: string;
  bankQuestionId: string;
  questionTextEn: string | null;
  regulation: string;
  clause: string | null;
  authority: string | null;
  url: string | null;
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

async function mutate<T>(
  path: string,
  method: 'PATCH' | 'PUT' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const token = getToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const b = await response.json().catch(() => ({}));
    throw new Error((b as { message?: string }).message ?? 'Request failed');
  }
  return (await response.json()) as T;
}

export function fetchAdminStats() {
  return request<AdminStats>('/admin/stats');
}

export function fetchAdminQuestions() {
  return request<AdminQuestion[]>('/admin/questions');
}

export function updateAdminQuestion(id: string, patch: Partial<AdminQuestion>) {
  return mutate<{ id: string; updated: boolean }>(`/admin/questions/${id}`, 'PATCH', patch);
}

export function fetchAdminRecommendations() {
  return request<AdminRecommendation[]>('/admin/recommendations');
}

export function updateAdminRecommendation(id: string, patch: Partial<AdminRecommendation>) {
  return mutate<AdminRecommendation>(`/admin/recommendations/${id}`, 'PUT', patch);
}

export function fetchAdminRegulatoryMappings() {
  return request<AdminRegMapping[]>('/admin/regulatory-mappings');
}

export function fetchGlossary() {
  return request<AdminGlossaryTerm[]>('/admin/glossary');
}

export function createGlossaryTerm(term: Partial<AdminGlossaryTerm>) {
  return mutate<AdminGlossaryTerm>('/admin/glossary', 'POST', term);
}

export function updateGlossaryTerm(id: string, patch: Partial<AdminGlossaryTerm>) {
  return mutate<AdminGlossaryTerm>(`/admin/glossary/${id}`, 'PUT', patch);
}

export function deleteGlossaryTerm(id: string) {
  return mutate<{ id: string; deleted: boolean }>(`/admin/glossary/${id}`, 'DELETE');
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
