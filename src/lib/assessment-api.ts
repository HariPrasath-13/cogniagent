import { getSession } from './auth-api';

export type QuestionType = 'mcq' | 'question_answer' | 'mixed';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface GeneratedQuestion {
  id: number;
  question: string;
  type?: 'mcq' | 'question_answer';
  options?: string[];
  max_marks?: number;
}

export interface GenerateAssessmentResponse {
  assessment_id: number;
  filename: string;
  total_questions: number;
  question_type?: QuestionType;
  difficulty?: DifficultyLevel;
  duration_minutes?: number;
  questions: GeneratedQuestion[];
}

export interface QuestionEvaluation {
  question_id: number;
  question: string;
  type?: 'mcq' | 'question_answer';
  options?: string[];
  your_answer: string;
  reference_answer: string;
  score: number;
  max_marks?: number;
  feedback: string;
  correct_points: string[];
  missing_points: string[];
}

export interface SubmitAssessmentResponse {
  assessment_id: number;
  score: number;
  total_questions: number;
  question_type?: QuestionType;
  difficulty?: DifficultyLevel;
  auto_submitted?: boolean;
  results: QuestionEvaluation[];
}

export interface AssessmentHistoryItem {
  id: number;
  pdf_name: string;
  score: number | null;
  total_questions: number;
  question_type?: QuestionType;
  difficulty?: DifficultyLevel;
  duration_minutes?: number;
  auto_submitted?: boolean;
  status: 'in_progress' | 'completed';
  created_at: number;
  completed_at: number | null;
}

export interface AssessmentDetailResponse {
  assessment_id: number;
  filename: string;
  status: 'in_progress' | 'completed';
  score: number | null;
  total_questions: number;
  question_type?: QuestionType;
  difficulty?: DifficultyLevel;
  duration_minutes?: number;
  started_at?: number | null;
  deadline?: number | null;
  remaining_seconds?: number;
  auto_submitted?: boolean;
  questions: GeneratedQuestion[];
  results: QuestionEvaluation[] | null;
  created_at: number;
  completed_at: number | null;
}

export interface StartAssessmentResponse {
  assessment_id: number;
  started_at: number;
  deadline: number;
  duration_minutes: number;
  remaining_seconds: number;
  server_time: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function getAuthHeaders(): Record<string, string> {
  const { token } = getSession();
  if (!token) {
    throw new Error('You must be signed in to access assessments. Please sign in first.');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function generateAssessment(
  file: File,
  count: number = 5,
  questionType: QuestionType = 'mcq',
  difficulty: DifficultyLevel = 'medium',
  durationMinutes: number = 15
): Promise<GenerateAssessmentResponse> {
  const headers = getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('count', String(count));
  formData.append('question_type', questionType);
  formData.append('difficulty', difficulty);
  formData.append('duration_minutes', String(durationMinutes));

  const url = `${API_BASE_URL}/api/assessments/generate?count=${count}&question_type=${encodeURIComponent(questionType)}&difficulty=${encodeURIComponent(difficulty)}&duration_minutes=${durationMinutes}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to generate assessment (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as GenerateAssessmentResponse;
}

export async function startAssessment(
  assessmentId: number
): Promise<StartAssessmentResponse> {
  const headers = getAuthHeaders();
  const url = `${API_BASE_URL}/api/assessments/${assessmentId}/start`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to start assessment (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as StartAssessmentResponse;
}

export async function submitAssessment(
  assessmentId: number,
  answers: Record<string, string>,
  isAutoSubmit: boolean = false
): Promise<SubmitAssessmentResponse> {
  const headers = getAuthHeaders();
  const url = `${API_BASE_URL}/api/assessments/submit`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assessment_id: assessmentId,
      answers,
      is_auto_submit: isAutoSubmit,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to submit assessment (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as SubmitAssessmentResponse;
}

export async function getAssessmentHistory(): Promise<{ history: AssessmentHistoryItem[] }> {
  const headers = getAuthHeaders();
  const url = `${API_BASE_URL}/api/assessments/history`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to fetch assessment history (${res.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export interface AssessmentStatsResponse {
  total_assessments: number;
  completed_assessments: number;
  in_progress_assessments: number;
  average_score: number;
  highest_score: number;
  total_questions_attempted: number;
  auto_submitted_count: number;
}

export async function getAssessmentStats(): Promise<AssessmentStatsResponse> {
  const headers = getAuthHeaders();
  const url = `${API_BASE_URL}/api/assessments/stats`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to fetch assessment statistics (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as AssessmentStatsResponse;
}

export async function deleteAssessment(
  assessmentId: number
): Promise<{ success: boolean; message: string }> {
  const headers = getAuthHeaders();
  const url = `${API_BASE_URL}/api/assessments/${assessmentId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to delete assessment (${res.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export async function getAssessment(
  assessmentId: number
): Promise<AssessmentDetailResponse> {
  const headers = getAuthHeaders();
  const url = `${API_BASE_URL}/api/assessments/${assessmentId}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to fetch assessment (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as AssessmentDetailResponse;
}

export interface TutorDocument {
  id: number;
  filename: string;
  created_at: number;
  char_count: number;
}

export interface TutorMessage {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
  source_file?: string | null;
  source_excerpt?: string | null;
  created_at: number;
}

export interface TutorChatResponse {
  reply: string;
  source: {
    file: string;
    excerpt: string;
  } | null;
}

export async function getTutorDocuments(): Promise<{ documents: TutorDocument[] }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/tutor/documents`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch study documents');
  return data;
}

export async function uploadTutorDocument(file: File): Promise<{ success: boolean; document: TutorDocument }> {
  const headers = getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/assessments/tutor/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to upload study document');
  return data;
}

export async function getTutorHistory(): Promise<{ messages: TutorMessage[] }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/tutor/history`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch tutor conversation');
  return data;
}

export async function sendTutorMessage(
  message: string,
  documentId?: number
): Promise<TutorChatResponse> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/tutor/chat`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, document_id: documentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to communicate with AI Tutor');
  return data;
}

export async function clearTutorHistory(): Promise<{ success: boolean }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/tutor/clear`, {
    method: 'POST',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to clear conversation');
  return data;
}


// ---------- Study Materials API ----------

export interface StudyMaterialItem {
  id: number;
  filename: string;
  char_count: number;
  created_at: number;
}

export async function getStudyMaterials(): Promise<{ materials: StudyMaterialItem[] }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/materials`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch study materials');
  return data;
}

export async function uploadStudyMaterial(file: File): Promise<{ success: boolean; material: StudyMaterialItem }> {
  const headers = getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/assessments/materials/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to upload study material');
  return data;
}

export async function deleteStudyMaterial(materialId: number): Promise<{ success: boolean; message: string }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/materials/${materialId}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to delete study material');
  return data;
}

// ---------- AI Study Plan API ----------

export interface StudyPlanSession {
  session_number: number;
  day_number: number;
  title: string;
  concepts_to_study: string[];
  source_sections: string;
  estimated_minutes: number;
  learning_objectives: string[];
  practice_questions: string[];
  revision_activity: string;
  is_revision_session: boolean;
  status?: 'not_started' | 'in_progress' | 'completed';
}

export interface StudyPlanOverview {
  title: string;
  material_name: string;
  learning_objective: string;
  total_duration_days: number;
  estimated_total_hours: number;
  major_topics: string[];
  recommended_learning_order: string[];
}

export interface StudyPlanConfig {
  document_id: number;
  material_name: string;
  target_days: number;
  target_date?: string | null;
  daily_minutes: number;
  knowledge_level: string;
  study_goal: string;
}

export interface StudyPlanItem {
  id: number;
  document_id: number;
  document_name: string;
  config: StudyPlanConfig;
  overview: StudyPlanOverview;
  sessions: StudyPlanSession[];
  completed_sessions: number[];
  progress_pct: number;
  created_at: number;
  updated_at: number;
}

export interface GenerateStudyPlanParams {
  document_id: number;
  target_days?: number;
  target_date?: string;
  daily_minutes?: number;
  knowledge_level?: 'beginner' | 'intermediate' | 'advanced';
  study_goal?: 'exam_preparation' | 'concept_understanding' | 'revision';
}

export async function generateStudyPlan(
  params: GenerateStudyPlanParams
): Promise<{ success: boolean; plan: StudyPlanItem }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/study-plan/generate`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg =
      data.detail ||
      (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
      `Failed to generate study plan (${res.status})`;
    throw new Error(errorMsg);
  }
  return data;
}

export async function getStudyPlans(): Promise<{ plans: StudyPlanItem[] }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/study-plans`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch study plans');
  return data;
}

export async function getStudyPlan(planId: number): Promise<{ plan: StudyPlanItem }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/study-plan/${planId}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to fetch study plan details');
  return data;
}

export async function updateStudyPlanSession(
  planId: number,
  sessionNumber: number,
  status: 'completed' | 'not_started'
): Promise<{ success: boolean; session_number: number; status: string; completed_sessions: number[]; progress_pct: number }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/study-plan/${planId}/session`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_number: sessionNumber, status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to update session progress');
  return data;
}

export async function deleteStudyPlan(planId: number): Promise<{ success: boolean; message: string }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/assessments/study-plan/${planId}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to delete study plan');
  return data;
}
