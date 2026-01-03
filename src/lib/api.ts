const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Helper function to get auth token
const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Helper function to set auth token
const setToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

// Helper function to remove auth token
const removeToken = (): void => {
  localStorage.removeItem('auth_token');
};

// API request helper
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors (backend not running, CORS, etc.)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to backend API at ${API_BASE_URL}. Please make sure the backend server is running.`);
    }
    // Re-throw other errors
    throw error;
  }
};

// Auth API
export const authAPI = {
  register: async (email: string, password: string, displayName?: string, adminSecretKey?: string) => {
    const data = await apiRequest<{ user: any; token: string; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, adminSecretKey }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  login: async (email: string, password: string, adminSecretKey?: string) => {
    const data = await apiRequest<{ user: any; token: string; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, adminSecretKey }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  logout: () => {
    removeToken();
  },

  getToken: getToken,
};

// Quiz API
export const quizAPI = {
  submit: async (quizData: {
    quizType: 'plugin' | 'theme';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    timeTakenSeconds: number;
    detailedAnswers: any[];
  }) => {
    return apiRequest<{ message: string; resultId: string }>('/quiz/submit', {
      method: 'POST',
      body: JSON.stringify(quizData),
    });
  },

  getHistory: async () => {
    return apiRequest<{ results: any[] }>('/quiz/history');
  },
};

// Admin API
export const adminAPI = {
  getUsers: async () => {
    return apiRequest<{ users: any[]; total: number }>('/admin/users');
  },

  getResults: async () => {
    return apiRequest<{ results: any[]; total: number }>('/admin/results');
  },

  updateUserStatus: async (userId: string, status: 'selected' | 'pending') => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteUserResults: async (userId: string) => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}/results`, {
      method: 'DELETE',
    });
  },

  getStats: async () => {
    return apiRequest<{
      totalAttempts: number;
      uniqueUsers: number;
      averageScore: number;
      averageTime: number;
      totalCorrect: number;
      totalWrong: number;
      pluginAttempts: number;
      themeAttempts: number;
    }>('/admin/stats');
  },

  getUserWarnings: async (userId: string) => {
    return apiRequest<{ warningCount: number; isBlocked: boolean }>(`/admin/users/${userId}/warnings`);
  },

  updateUserWarnings: async (userId: string, warningCount: number) => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}/warnings`, {
      method: 'PATCH',
      body: JSON.stringify({ warningCount }),
    });
  },

  blockUser: async (userId: string, reason: string) => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  unblockUser: async (userId: string) => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}/unblock`, {
      method: 'POST',
    });
  },

  getUserRestartCount: async (userId: string) => {
    return apiRequest<{ restartCount: number; isBlocked: boolean }>(`/admin/users/${userId}/restarts`);
  },

  updateUserRestartCount: async (userId: string, restartCount: number) => {
    return apiRequest<{ message: string }>(`/admin/users/${userId}/restarts`, {
      method: 'PATCH',
      body: JSON.stringify({ restartCount }),
    });
  },
};

export { removeToken, setToken, getToken };

