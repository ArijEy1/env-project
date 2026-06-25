import { apiBaseUrl, authStorage } from './auth-client';

export interface AssessmentAnswer {
  questionId: string;
  score: number;
}

export interface Assessment {
  id: string;
  entityId: string;
  userId: string;
  status: 'draft' | 'submitted';
  currentQuestionIndex: number;
  createdAt: string;
  submittedAt: string | null;
  totalScore: number | null;
  governanceScore: number | null;
  complianceScore: number | null;
  maturityLevel: number | null;
  domainScores: Record<string, number> | null;
  answers: AssessmentAnswer[];
}

export interface GeneratedQuestion {
  questionId: string;
  domainId: string;
  materialityTopicId: string | null;
  effectiveWeight: number;
  displayOrder: number;
  textAr: string;
  textEn: string;
  helpTextAr: string | null;
  helpTextEn: string | null;
  calculatorType: string | null;
}

export interface GeneratedDomain {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface GeneratedQuestionsData {
  assessmentId: string;
  profileSnapshot: unknown;
  totalQuestions: number;
  answerOptions: AnswerOptionDef[];
  domains: GeneratedDomain[];
  questions: GeneratedQuestion[];
}

export interface AssessmentListItem {
  id: string;
  entityId: string;
  userId: string;
  status: 'draft' | 'submitted';
  currentQuestionIndex: number;
  createdAt: string;
  submittedAt: string | null;
  answeredCount: number;
  totalQuestions: number;
  totalScore: number | null;
  governanceScore: number | null;
  complianceScore: number | null;
  maturityLevel: number | null;
}

export interface QuestionDef {
  id: string;
  domain: 'governance' | 'compliance';
  textAr: string;
  textEn: string;
}

export interface DomainDef {
  id: 'governance' | 'compliance';
  nameAr: string;
  nameEn: string;
  weight: number;
}

export interface AnswerOptionDef {
  score: number;
  labelAr: string;
  labelEn: string;
}

export interface QuestionsData {
  questions: QuestionDef[];
  domains: DomainDef[];
  answerOptions: AnswerOptionDef[];
  totalQuestions: number;
}

interface ErrorPayload {
  message?: string | string[];
}

function getToken(): string {
  const token = localStorage.getItem(authStorage.tokenKey);
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let msg = 'Request failed';
    try {
      const payload = (await response.json()) as ErrorPayload;
      msg = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message ?? msg;
    } catch {}
    throw new Error(msg);
  }

  return (await response.json()) as T;
}

export function fetchQuestions() {
  return request<QuestionsData>('/assessments/questions');
}

export function fetchGeneratedQuestions(assessmentId: string) {
  return request<GeneratedQuestionsData>(`/assessments/${assessmentId}/generated`);
}

export function createAssessment() {
  return request<Assessment>('/assessments', { method: 'POST' });
}

export function listAssessments() {
  return request<AssessmentListItem[]>('/assessments');
}

export function getAssessment(id: string) {
  return request<Assessment>(`/assessments/${id}`);
}

export function saveAnswer(assessmentId: string, questionId: string, score: number) {
  return request<AssessmentAnswer>(`/assessments/${assessmentId}/answer`, {
    method: 'PUT',
    body: JSON.stringify({ questionId, score }),
  });
}

export function updateProgress(assessmentId: string, currentQuestionIndex: number) {
  return request<{ currentQuestionIndex: number }>(`/assessments/${assessmentId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ currentQuestionIndex }),
  });
}

export function submitAssessment(assessmentId: string) {
  return request<Assessment>(`/assessments/${assessmentId}/submit`, { method: 'POST' });
}

export interface Recommendation {
  rank: number;
  questionId: string;
  score: number;
  questionTextAr: string;
  questionTextEn: string;
  actionAr: string;
  actionEn: string;
  impactAr: string;
  impactEn: string;
  referenceAr: string;
  referenceEn: string;
}

export function fetchRecommendations(assessmentId: string) {
  return request<Recommendation[]>(`/assessments/${assessmentId}/recommendations`);
}

export async function downloadReport(assessmentId: string) {
  const token = getToken();

  const response = await fetch(`${apiBaseUrl}/assessments/${assessmentId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to download report');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? `assessment-report.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
