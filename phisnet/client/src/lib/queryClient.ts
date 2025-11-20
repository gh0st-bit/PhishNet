import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage: string;
    
    try {
      // Clone the response so we can read it multiple times if needed
      const clonedRes = res.clone();
      // Try to parse the response as JSON
      const errorJson = await clonedRes.json();
      // If it has a message property, use that
      errorMessage = errorJson.message || res.statusText;
    } catch (e) {
      // If parsing fails, use the text response from the original
      try {
        const text = await res.text();
        errorMessage = text || res.statusText;
      } catch (textError) {
        // If both fail, just use statusText
        errorMessage = res.statusText;
      }
    }
    
    throw new Error(errorMessage);
  }
}

// Touch the session to keep it alive
// Refresh session cookie unless on auth endpoints or explicitly skipped.
export async function refreshSession(skipForUserEndpoint: boolean = false, skipAuthRedirect: boolean = false): Promise<void> {
  try {
    // Skip session refresh if we're fetching the user endpoint to avoid infinite loops
    if (skipForUserEndpoint) {
      return;
    }
    
    // Implement a cooldown to prevent too many session pings
    const now = Date.now();
    const lastPing = sessionStorage.getItem('lastSessionPing');
    
    if (lastPing) {
      const timeSinceLastPing = now - parseInt(lastPing);
      // Don't ping more than once every 5 minutes unless it's an explicit user action
      if (timeSinceLastPing < 5 * 60 * 1000) {
        return;
      }
    }
    
    // Store this ping time
    sessionStorage.setItem('lastSessionPing', now.toString());
    
    // Use the API base URL from environment variables
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    const response = await fetch(`${baseUrl}/api/session-ping`, { 
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // 401 before authentication (e.g. on login/register) should NOT force redirect
      if (!skipAuthRedirect && response.status === 401) {
        const sessionExpiredEvent = new Event('session-expired');
        document.dispatchEvent(sessionExpiredEvent);
        window.location.href = '/auth';
      }
      return;
    } else {
      // Update the last successful ping time for better tracking
      sessionStorage.setItem('lastSuccessfulPing', now.toString());
    }
  } catch (error) {
    console.error('Failed to refresh session:', error);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Skip session refresh for the user endpoint to avoid infinite loops
  const isUserEndpoint = url === '/api/user';
  
  // Determine if this is an auth endpoint that should skip redirect-on-401 logic
  const authEndpoints = ['/api/login', '/api/register', '/api/forgot-password', '/api/reset-password'];
  const isAuthEndpoint = authEndpoints.includes(url);
  // Refresh the session before making the actual request (skip auth redirect for auth endpoints)
  await refreshSession(isUserEndpoint, isAuthEndpoint);
  
  // Use the API base URL from environment variables
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
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
    const url = queryKey[0] as string;
    // Skip refreshing session for /api/user to avoid infinite loops
    const isUserEndpoint = url === '/api/user';
    
    // Refresh the session before making the actual request
    await refreshSession(isUserEndpoint, false);
    
    // Use the API base URL from environment variables
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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
