export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  gradeLevel?: string;
  joinedDate?: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  size: string;
  pages: number;
  uploadDate: string;
  status: 'processing' | 'ready' | 'error';
}

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface Question {
  id: number;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  sourceDoc: string;
  sourcePage: number;
}

export interface TestSession {
  id: string;
  subject: string;
  totalQuestions: number;
  timeLimitMinutes: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  answers: Record<number, string>;
  isCompleted: boolean;
  score?: number;
  timeTakenMinutes?: number;
}

export interface StudyRecommendation {
  id: string;
  title: string;
  subject: string;
  actionText: string;
  type: 'video' | 'notes' | 'quiz' | 'lecture';
}

export interface AssessmentNotification {
  id: string;
  title: string;
  subject: string;
  questionsCount: number;
  durationMinutes: number;
  scheduledTime: string;
  type: 'assessment' | 'improvement' | 'recommendation' | 'goal';
  timestamp: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: {
    file: string;
    page?: number;
    excerpt?: string;
  };
}


export interface ModelMetricComparison {
  metric: string;
  baselineLLM: number;
  baseRAG: number;
  cogniAgent: number;
  lowerIsBetter?: boolean;
}
