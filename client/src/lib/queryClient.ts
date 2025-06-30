import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText || 'Request failed';
    
    try {
      // Try to get JSON error data first
      const errorData = await res.clone().json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (jsonError) {
      // If JSON parsing fails, try to get text
      try {
        const textData = await res.clone().text();
        if (textData && textData.trim()) {
          errorMessage = textData;
        }
      } catch (textError) {
        // Keep the default status text
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
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
    const res = await fetch(queryKey[0] as string, {
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
      refetchOnWindowFocus: true, // Check for updates when user returns to tab
      staleTime: 1000 * 60 * 5, // Default 5 minutes for reference data
      gcTime: 1000 * 60 * 15, // Keep in cache 15 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Create specific query options for critical admin data
export const criticalDataQueryOptions = {
  staleTime: 0, // Always consider stale - check for updates
  gcTime: 1000 * 60, // Keep in memory cache 1 minute only
  refetchOnWindowFocus: true,
};

// Create specific query options for reference data  
export const referenceDataQueryOptions = {
  staleTime: 1000 * 60 * 5, // 5 minutes before considering stale
  gcTime: 1000 * 60 * 15, // 15 minutes in memory cache
  refetchOnWindowFocus: false,
};
