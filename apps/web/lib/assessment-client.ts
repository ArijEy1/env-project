import { apiBaseUrl, authStorage, clearAuthAndRedirect } from './auth-client';

export interface RawAnswerStored {
  canonical?: string | null;
  optionIndex?: number | null;
  optionValue?: string | null;
  number?: number | null;
  attribution?: string | null;
}

export interface AssessmentAnswer {
  questionId: string;
  score: number;
  rawAnswer?: RawAnswerStored | null;
  calculatorInputs?: Record<string, unknown> | null;
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

export interface QuestionOption {
  index: number;
  value: string;
  labelAr: string;
  labelEn: string | null;
  level: number | null;
}

export interface GeneratedQuestion {
  questionId: string;
  domainId: string;
  displayOrder: number;
  category: string | null;
  textAr: string;
  textEn: string;
  helpTextAr: string | null;
  helpTextEn: string | null;
  guidanceAr: string | null;
  guidanceEn: string | null;
  answerType: string | null;
  options: QuestionOption[];
  minEvidenceLevel: string | null;
  attributionRequired: boolean;
  isRouting: boolean;
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
  domains: GeneratedDomain[];
  questions: GeneratedQuestion[];
}

/** What the client submits for an answer, per the question's answer type. */
export interface AnswerPayload {
  optionIndex?: number;
  number?: number;
  attribution?: string;
  evidenceLevel?: string;
}

export interface SaveAnswerResult {
  questionId: string;
  score: number | null;
  canonical: string | null;
  needsAttribution: boolean;
  redFlag: boolean;
  activeCount: number | null;
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
    // All assessment calls are authenticated; a 401 means the session expired.
    if (response.status === 401) {
      clearAuthAndRedirect();
    }
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

export interface DomainResult {
  id: string;
  nameAr: string;
  nameEn: string;
  score: number;
  maturity: number;
  topGapAr: string | null;
  topGapEn: string | null;
}

export interface ResultsProfile {
  sector: string | null;
  entityType: string | null;
  environmentalExposure: string | null;
  employeeCountBracket: string | null;
}

export interface ResultsData {
  assessmentId: string;
  totalScore: number;
  maturityLevel: number;
  confidenceScore: number | null;
  gateStatus: 'none' | 'soft' | 'hard';
  gateReasons: string[];
  redFlagCount: number;
  submittedAt: string | null;
  domains: DomainResult[];
  profile: ResultsProfile;
}

export function fetchResults(assessmentId: string) {
  return request<ResultsData>(`/assessments/${assessmentId}/results`);
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

export function saveAnswer(
  assessmentId: string,
  questionId: string,
  payload: AnswerPayload,
) {
  return request<SaveAnswerResult>(`/assessments/${assessmentId}/answer`, {
    method: 'PUT',
    body: JSON.stringify({ questionId, ...payload }),
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

export function deleteAssessment(assessmentId: string) {
  return request<{ discarded: boolean }>(`/assessments/${assessmentId}`, { method: 'DELETE' });
}

export interface Recommendation {
  rank: number;
  recommendationId: string;
  questionId: string;
  domainId: string;
  materialityTopicId: string | null;
  currentScore: number;
  isCompliance: boolean;
  questionTextAr: string;
  questionTextEn: string;
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
