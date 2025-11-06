// API base URL for backend requests - using relative URLs for better compatibility
function getApiBase(): string {
  // In development, use explicit localhost URL with /api prefix
  // In production, use relative URLs since frontend and backend are served from same domain
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000/api';
  }
  return '/api'; // Use relative URLs with /api prefix in production
}

// Tiny fetch helper with JSON + error handling
export async function apiGet<T>(endpoint: string): Promise<T> {
  const apiBase = getApiBase();
  // Clean endpoint - remove leading /api if present to prevent duplication
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4); // Remove '/api' prefix
  }
  // Ensure no double slashes
  const url = `${apiBase}${cleanEndpoint}`.replace(/\/+/g, '/').replace('http:/', 'http://');

  // Get auth token from localStorage with fallback
  const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('🌐 API GET Debug:', {
    url,
    endpoint,
    hasToken: !!token,
    tokenLength: token?.length || 0,
    headers: Object.keys(headers)
  });

  const response = await fetch(url, {
    headers,
  });

  console.log('🌐 API GET Response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API GET Error Response:', errorText);
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }
  return response.json();
}

export async function apiPost<T>(endpoint: string, data: any): Promise<T> {
  const apiBase = getApiBase();
  // Clean endpoint - remove leading /api if present to prevent duplication
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4); // Remove '/api' prefix
  }
  // Ensure no double slashes
  const url = `${apiBase}${cleanEndpoint}`.replace(/\/+/g, '/').replace('http:/', 'http://');

  // Get auth token from localStorage with fallback
  const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('🌐 API POST Debug:', {
    url,
    endpoint: cleanEndpoint,
    hasToken: !!token,
    data,
    headers: Object.keys(headers)
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  console.log('🌐 API POST Response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API POST Error Response:', errorText);
    
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    
    const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
    (error as any).response = { data: errorData, status: response.status };
    throw error;
  }

  const result = await response.json();
  console.log('✅ API POST Success:', result);
  return result;
}

export async function apiPut<T>(endpoint: string, data: any): Promise<T> {
  const apiBase = getApiBase();
  // Clean endpoint - remove leading /api if present to prevent duplication
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4); // Remove '/api' prefix
  }
  // Ensure no double slashes
  const url = `${apiBase}${cleanEndpoint}`.replace(/\/+/g, '/').replace('http:/', 'http://');

  // Get auth token from localStorage with fallback
  const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function apiDelete(endpoint: string): Promise<void> {
  const apiBase = getApiBase();
  // Clean endpoint - remove leading /api if present to prevent duplication
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4); // Remove '/api' prefix
  }
  // Ensure no double slashes
  const url = `${apiBase}${cleanEndpoint}`.replace(/\/+/g, '/').replace('http:/', 'http://');

  // Get auth token from localStorage with fallback
  const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }
}

export interface Assessment {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress?: {
    answered: number;
    total: number;
    evidence: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  standard?: {
    code: string;
    name: string;
  };
  intakeFormId?: string;
}

export interface Question {
  id: string;
  assessmentId: string;
  text: string;
  type: 'multiple_choice' | 'text' | 'boolean';
  required: boolean;
  options?: string[];
  category: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

// Helper function to get authentication token
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
}


class ApiClient {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    try {
      // Get auth token from localStorage with fallback
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Merge additional headers if provided
      if (options?.headers) {
        Object.assign(headers, options.headers);
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Debug logging for API requests
      const apiBase = getApiBase();
      console.log('🌐 API Request Debug:', {
        url: `${apiBase}${url}`,
        method: options?.method || 'GET',
        hasAuthHeader: !!headers['Authorization'],
        authHeaderPrefix: headers['Authorization']?.substring(0, 20) + '...' || 'none',
        headers: Object.keys(headers),
        apiBase: apiBase,
      });

      // Construct final options with headers
      const finalOptions: RequestInit = {
        headers,
        ...options,
      };

      console.log('🔍 Final Request Options:', {
        url: `${getApiBase()}${url}`,
        headers: finalOptions.headers,
        method: finalOptions.method || 'GET',
      });

      const response = await fetch(`${getApiBase()}${url}`, finalOptions);

      if (!response.ok) {
        const error: ApiError = {
          name: 'ApiError',
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
        // Attempt to parse error response body for more details
        try {
          const errorBody = await response.json();
          error.message = errorBody.message || error.message;
          error.code = errorBody.code || undefined;
        } catch (e) {
          // Ignore if response is not JSON or empty
        }
        throw error;
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw {
          message: error.message,
          status: 0,
        } as ApiError;
      }
      throw error;
    }
  }

  async getAssessments(): Promise<Assessment[]> {
    return this.request<Assessment[]>('/assessments');
  }

  async getAssessment(id: string): Promise<Assessment> {
    return this.request<Assessment>(`/assessments/${id}`);
  }

  async createAssessment(data: Partial<Assessment>): Promise<Assessment> {
    // Debug logging for assessment creation
    const token = getAuthToken();
    console.log('🔐 CreateAssessment Debug:', {
      tokenExists: !!token,
      tokenLength: token?.length || 0,
      tokenPrefix: token?.substring(0, 20) + '...' || 'null',
    });

    return this.request<Assessment>('/assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQuestions(assessmentId: string): Promise<Question[]> {
    return this.request<Question[]>(`/assessments/${assessmentId}/questions`);
  }
}

export const api = {
  getAssessments: async (): Promise<Assessment[]> => {
    const response = await fetch('/api/assessments', {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch assessments: HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        // If response is not JSON, use the raw text as error message
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    const data = await response.json();
    
    // Handle different response formats
    if (data?.assessments && Array.isArray(data.assessments)) {
      return data.assessments;
    } else if (data?.data && Array.isArray(data.data)) {
      return data.data;
    } else if (Array.isArray(data)) {
      return data;
    } else {
      console.warn('Unexpected assessments response format:', data);
      return [];
    }
  },

  createAssessment: async (assessmentData: any): Promise<Assessment> => {
    console.log('Creating assessment with data:', assessmentData);

    const response = await fetch('/api/assessments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(assessmentData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;

      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error('Assessment creation failed:', errorData);
      throw new Error(errorData.message || errorData.error || 'Failed to create assessment');
    }

    const result = await response.json();
    console.log('Assessment creation successful:', result);
    return result;
  },
};


export default api;