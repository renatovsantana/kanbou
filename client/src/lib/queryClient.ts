/**
 * @module queryClient
 * Configures and exports the TanStack Query client, the default API request helper,
 * and a factory for creating typed query functions with configurable 401 handling.
 */
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Inspects a fetch `Response` and throws an `Error` if the response status is not OK (2xx).
 * The error message includes the HTTP status code and response body text.
 *
 * @param res - The fetch `Response` to inspect.
 * @throws {Error} When `res.ok` is `false`.
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Makes an authenticated API request using `fetch`.
 * Automatically serialises the body as JSON when `data` is provided and includes credentials.
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.).
 * @param url - The URL path to call (e.g. `/api/auth/login`).
 * @param data - Optional request body; will be JSON-stringified.
 * @returns The raw `Response` object (already validated to be OK).
 * @throws {Error} If the response status is not 2xx.
 */
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

/** Strategy for handling HTTP 401 responses in query functions. */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Factory that creates a TanStack Query `queryFn` with configurable 401 handling.
 *
 * - `"returnNull"`: silently returns `null` on 401 (useful for auth-check queries).
 * - `"throw"`: throws an error on 401 (default for most queries).
 *
 * The returned function derives the URL from the `queryKey` array.
 *
 * @template T - The expected response JSON type.
 * @param options.on401 - The behaviour when a 401 response is received.
 * @returns A `QueryFunction<T>` suitable for use with `useQuery`.
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Pre-configured TanStack `QueryClient` instance used throughout the application.
 * Default query behaviour: throws on 401, no automatic refetch, infinite stale time, no retry.
 */
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
