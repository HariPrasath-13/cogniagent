export interface UserData {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: UserData;
  email?: string;
  email_sent?: boolean;
  delivery_notice?: string | null;
}

export interface ApiError {
  detail: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        (data as ApiError).detail ||
        (Array.isArray(data.detail) ? data.detail[0]?.msg : null) ||
        `Request failed with status ${res.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      throw new Error(
        'Cannot connect to authentication backend (http://localhost:8000). Please ensure the FastAPI server is running.'
      );
    }
    throw err;
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function verifyRegistration(
  email: string,
  otp: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/verify-registration', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function sendLoginOtp(email: string): Promise<AuthResponse> {
  return request<AuthResponse>('/send-login-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyLoginOtp(
  email: string,
  otp: string
): Promise<AuthResponse> {
  return request<AuthResponse>('/verify-login-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function getCurrentUser(token: string): Promise<{ user: UserData }> {
  return request<{ user: UserData }>('/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function saveSession(token: string, user: UserData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cogni_auth_token', token);
    localStorage.setItem('cogni_user', JSON.stringify(user));
  }
}

export function getSession(): { token: string | null; user: UserData | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  const token = localStorage.getItem('cogni_auth_token');
  const userStr = localStorage.getItem('cogni_user');
  let user: UserData | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }
  return { token, user };
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cogni_auth_token');
    localStorage.removeItem('cogni_user');
  }
}
