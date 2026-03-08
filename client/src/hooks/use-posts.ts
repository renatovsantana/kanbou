/**
 * @module use-posts
 * TanStack Query hooks for CRUD operations on social-media posts.
 * Each hook wraps the shared API route definitions, validates payloads with Zod,
 * and provides toast feedback on success or failure.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreatePostRequest, type UpdatePostRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

/**
 * Fetches all posts, optionally filtered by search term, client, or status.
 * The query key includes the filters so TanStack Query automatically refetches
 * when any filter value changes. Auto-refreshes every 30 seconds.
 *
 * @param filters - Optional search/client/status filters applied as query params.
 * @returns A TanStack Query result containing the validated array of posts.
 */
export function usePosts(filters?: { search?: string; client?: string; status?: string }) {
  // Construct query key based on filters so it auto-refetches when they change
  const queryKey = filters 
    ? [api.posts.list.path, filters] 
    : [api.posts.list.path];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(api.posts.list.path, window.location.origin);
      if (filters?.search) url.searchParams.append("search", filters.search);
      if (filters?.client) url.searchParams.append("client", filters.client);
      if (filters?.status) url.searchParams.append("status", filters.status);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch posts");
      
      const data = await res.json();
      return api.posts.list.responses[200].parse(data);
    },
    refetchInterval: 30000,
  });
}

/**
 * Fetches a single post by ID. Returns `null` on 404.
 * The query is disabled when `id` is falsy.
 *
 * @param id - The post ID to fetch.
 * @returns A TanStack Query result containing the validated post or `null`.
 */
export function usePost(id: number) {
  return useQuery({
    queryKey: [api.posts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.posts.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch post");
      
      const data = await res.json();
      return api.posts.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}

/**
 * Mutation hook to create a new post.
 * Validates the payload against the shared Zod schema before sending.
 * Invalidates the posts list query and shows a toast on completion.
 *
 * @returns A TanStack `useMutation` result whose `mutationFn` accepts a `CreatePostRequest`.
 */
export function useCreatePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePostRequest) => {
      const validated = api.posts.create.input.parse(data);
      const res = await fetch(api.posts.create.path, {
        method: api.posts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.posts.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create post");
      }
      return api.posts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      toast({
        title: "Sucesso!",
        description: "O post foi criado com sucesso.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Mutation hook to update an existing post.
 * Validates the payload against the shared Zod schema before sending.
 * Invalidates the posts list query and shows a toast on completion.
 *
 * @returns A TanStack `useMutation` result whose `mutationFn` accepts `{ id, ...UpdatePostRequest }`.
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdatePostRequest) => {
      const validated = api.posts.update.input.parse(updates);
      const url = buildUrl(api.posts.update.path, { id });
      
      const res = await fetch(url, {
        method: api.posts.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.posts.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to update post");
      }
      return api.posts.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      toast({
        title: "Atualizado!",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Mutation hook to delete a post by ID.
 * Invalidates the posts list query and shows a toast on completion.
 *
 * @returns A TanStack `useMutation` result whose `mutationFn` accepts a post `id`.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.posts.delete.path, { id });
      const res = await fetch(url, { 
        method: api.posts.delete.method, 
        credentials: "include" 
      });

      if (!res.ok && res.status !== 404) {
        throw new Error("Failed to delete post");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      toast({
        title: "Excluído",
        description: "O post foi removido permanentemente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
