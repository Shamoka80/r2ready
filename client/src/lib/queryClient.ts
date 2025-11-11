import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get auth token from localStorage (try both formats for compatibility)
  const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  
  // Get current facility from sessionStorage
  const currentFacilityId = sessionStorage.getItem('currentFacilityId');
  
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (currentFacilityId) {
    headers['X-Facility-Context'] = currentFacilityId;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get auth token from localStorage (try both formats for compatibility)
    const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
    
    // Get current facility from sessionStorage
    const currentFacilityId = sessionStorage.getItem('currentFacilityId');
    
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (currentFacilityId) {
      headers['X-Facility-Context'] = currentFacilityId;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Download a file from an authenticated endpoint
 * Uses fetch with Authorization header, converts to blob, and triggers download
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
  const currentFacilityId = sessionStorage.getItem('currentFacilityId');
  
  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (currentFacilityId) {
    headers['X-Facility-Context'] = currentFacilityId;
  }
  
  const res = await fetch(url, {
    headers,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Get the blob from the response
  const blob = await res.blob();
  
  // Create a temporary URL for the blob
  const blobUrl = window.URL.createObjectURL(blob);
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
