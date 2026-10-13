import { getSession } from './auth-api';

export interface StudyPlanDocument {
  id: number;
  filename: string;
  created_at: number;
  char_count: number;
}

export type ActivityType = 'Study' | 'Practice' | 'Break' | 'Revision';

export interface StudyPlanTask {
  id: number;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  activity_type: ActivityType;
  topic: string;
  is_completed: number | boolean;
}

export interface StudyPlanStats {
  total_tasks: number;
  completed_tasks: number;
  progress_percentage: number;
}

export interface StudyPlan {
  id: number;
  title: string;
  document_id: number;
  filename?: string;
  start_date: string;
  target_date: string;
  daily_hours: number;
  start_time: string;
  learning_level: string;
  learning_goal: string;
  break_minutes: number;
  include_revision: boolean | number;
  total_days: number;
  total_hours: number;
  limitation_note?: string | null;
  created_at: number;
  tasks: StudyPlanTask[];
  stats: StudyPlanStats;
}

export interface CreatePlanConfig {
  document_id: number;
  start_date: string;
  target_date: string;
  daily_study_hours: number;
  daily_start_time: string;
  learning_level: 'Beginner' | 'Intermediate' | 'Advanced';
  learning_goal: 'Exam Preparation' | 'Concept Understanding' | 'Revision' | 'Complete Syllabus';
  break_duration_minutes: number;
  include_revision: boolean;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function getAuthHeaders(): Record<string, string> {
  const { token } = getSession();
  if (!token) {
    throw new Error('You must be signed in to create and manage study plans.');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

function formatNetworkError(err: any): Error {
  if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
    const isCloud = API_BASE_URL.includes('onrender.com') || !API_BASE_URL.includes('localhost');
    if (isCloud) {
      return new Error(
        `Cannot connect to cloud backend (${API_BASE_URL}). The Render server is waking up from sleep mode (this may take 30-50 seconds)—please wait a moment and try again.`
      );
    }
    return new Error(
      `Cannot connect to backend server (${API_BASE_URL}). Please ensure the FastAPI server is running on port 8000.`
    );
  }
  return err;
}

export async function getStudyDocuments(): Promise<StudyPlanDocument[]> {
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${API_BASE_URL}/api/study-plans/documents`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to load study documents');
    }
    return data.documents || [];
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}

export async function uploadStudyDocument(
  file: File,
  onProgress?: (progress: number) => void
): Promise<StudyPlanDocument> {
  const headers = getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);

  // Using XMLHttpRequest for upload progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/study-plans/upload`);
    xhr.setRequestHeader('Authorization', headers.Authorization);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      try {
        const resp = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(resp.document);
        } else {
          reject(new Error(resp.detail || 'Upload failed.'));
        }
      } catch (e: any) {
        reject(new Error(e.message || 'Failed to parse upload response.'));
      }
    };

    xhr.onerror = () => {
      const isCloud = API_BASE_URL.includes('onrender.com') || !API_BASE_URL.includes('localhost');
      if (isCloud) {
        reject(
          new Error(
            `Cannot connect to cloud backend (${API_BASE_URL}). The server is waking up from sleep mode—please wait a moment and try again.`
          )
        );
      } else {
        reject(
          new Error(
            `Cannot connect to backend server (${API_BASE_URL}). Please ensure the FastAPI server is running on port 8000.`
          )
        );
      }
    };

    xhr.send(formData);
  });
}

export async function generateStudyPlan(
  config: CreatePlanConfig
): Promise<StudyPlan> {
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${API_BASE_URL}/api/study-plans/generate`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to generate study plan');
    }
    return data.plan;
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}

export async function getLatestStudyPlan(): Promise<StudyPlan | null> {
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${API_BASE_URL}/api/study-plans/latest`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch latest study plan');
    }
    return data.plan;
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      return null;
    }
    throw err;
  }
}

export async function updateTaskStatus(
  taskId: number,
  isCompleted: boolean
): Promise<{ success: boolean; stats: StudyPlanStats }> {
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${API_BASE_URL}/api/study-plans/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_completed: isCompleted }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to update task completion');
    }
    return data;
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}

export async function deleteStudyPlan(planId: number): Promise<void> {
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${API_BASE_URL}/api/study-plans/${planId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to delete study plan');
    }
  } catch (err: any) {
    throw formatNetworkError(err);
  }
}
