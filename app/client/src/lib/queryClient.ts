/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   QUERYCLIENT.TS - REACT QUERY CONFIGURATION                  ║
 * ║                                                                               ║
 * ║  Configures TanStack Query (React Query) for the application, providing:     ║
 * ║                                                                               ║
 * ║    - Global query client instance with optimized defaults                     ║
 * ║    - API request helper with error handling                                   ║
 * ║    - Query function factory with 401 handling options                         ║
 * ║                                                                               ║
 * ║  React Query provides:                                                        ║
 * ║    - Automatic caching and background refetching                              ║
 * ║    - Request deduplication                                                    ║
 * ║    - Loading and error states                                                 ║
 * ║    - Optimistic updates                                                       ║
 * ║                                                                               ║
 * ║  Default Configuration:                                                       ║
 * ║    - staleTime: Infinity (data never goes stale automatically)               ║
 * ║    - refetchOnWindowFocus: false (no refetch when tab gains focus)           ║
 * ║    - refetchInterval: false (no automatic background refetching)             ║
 * ║    - retry: false (no automatic retries on failure)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * TanStack Query imports
 * - QueryClient: The client that holds the cache
 * - QueryFunction: Type for query functions
 */
import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Throw an error if response is not OK
 * 
 * Extracts error message from response body or falls back to status text.
 * Throws an Error with format "STATUS: message".
 * 
 * @param {Response} res - Fetch Response object
 * @throws {Error} If response.ok is false
 * 
 * @example
 * const res = await fetch('/api/data');
 * await throwIfResNotOk(res); // Throws if status >= 400
 * const data = await res.json();
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to get error message from response body
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ============================================================================
// API REQUEST HELPER
// ============================================================================

/**
 * Make an API request with automatic error handling
 * 
 * Wrapper around fetch() that:
 * - Sets Content-Type header for JSON data
 * - Stringifies request body
 * - Includes credentials for cookies/auth
 * - Throws on non-2xx responses
 * 
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} url - Request URL
 * @param {unknown} [data] - Request body (will be JSON stringified)
 * @returns {Promise<Response>} Fetch Response object
 * @throws {Error} If response status is not OK
 * 
 * @example
 * // GET request
 * const res = await apiRequest('GET', '/api/users');
 * const users = await res.json();
 * 
 * // POST request with data
 * const res = await apiRequest('POST', '/api/users', { name: 'John' });
 * const newUser = await res.json();
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    // Only set Content-Type if sending data
    headers: data ? { "Content-Type": "application/json" } : {},
    // Stringify body if data provided
    body: data ? JSON.stringify(data) : undefined,
    // Include cookies/credentials for authenticated requests
    credentials: "include",
  });

  // Throw error if response is not OK
  await throwIfResNotOk(res);
  return res;
}

// ============================================================================
// QUERY FUNCTION FACTORY
// ============================================================================

/**
 * Behavior options for 401 (Unauthorized) responses
 * - "returnNull": Return null instead of throwing (for optional auth)
 * - "throw": Throw an error (for required auth)
 */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Create a query function with configurable 401 handling
 * 
 * Factory function that creates query functions for React Query.
 * The query key is joined to form the URL (e.g., ["/api/users", "123"] → "/api/users/123").
 * 
 * @param {Object} options - Configuration options
 * @param {UnauthorizedBehavior} options.on401 - How to handle 401 responses
 * @returns {QueryFunction<T>} Query function for use with useQuery
 * 
 * @example
 * // Create a query function that returns null on 401
 * const queryFn = getQueryFn({ on401: "returnNull" });
 * 
 * // Use in component
 * const { data } = useQuery({
 *   queryKey: ["/api/me"],
 *   queryFn: getQueryFn({ on401: "returnNull" }),
 * });
 * // data is null if not authenticated
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Join query key parts to form URL
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    // Handle 401 based on configuration
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Throw on other errors
    await throwIfResNotOk(res);
    return await res.json();
  };

// ============================================================================
// QUERY CLIENT INSTANCE
// ============================================================================

/**
 * Global QueryClient instance
 * 
 * Configured with application-specific defaults:
 * 
 * Query defaults:
 * - queryFn: Uses getQueryFn with throw on 401
 * - refetchInterval: false (no automatic background refetch)
 * - refetchOnWindowFocus: false (no refetch when tab regains focus)
 * - staleTime: Infinity (data never automatically becomes stale)
 * - retry: false (no automatic retries on failure)
 * 
 * Mutation defaults:
 * - retry: false (no automatic retries)
 * 
 * These defaults prioritize:
 * - Predictable behavior (no surprise refetches)
 * - Manual control (developers decide when to refetch)
 * - Reduced network requests
 * 
 * @example
 * // In App.tsx
 * import { queryClient } from "./lib/queryClient";
 * 
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <YourApp />
 *     </QueryClientProvider>
 *   );
 * }
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default query function (joins queryKey as URL path)
      queryFn: getQueryFn({ on401: "throw" }),
      
      // No automatic background refetching
      refetchInterval: false,
      
      // No refetch when browser tab regains focus
      refetchOnWindowFocus: false,
      
      // Data is never considered stale automatically
      // Use queryClient.invalidateQueries() for manual invalidation
      staleTime: Infinity,
      
      // No automatic retries on failure
      retry: false,
    },
    mutations: {
      // No automatic retries for mutations
      retry: false,
    },
  },
});
