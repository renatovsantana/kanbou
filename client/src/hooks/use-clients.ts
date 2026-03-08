/**
 * @module use-clients
 * TanStack Query hooks for CRUD operations on clients.
 * Each hook wraps the shared API route definitions and provides toast feedback.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CreateClientRequest, UpdateClientRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

/**
 * Fetches the full list of clients from the API.
 *
 * @returns A TanStack Query result containing the array of clients.
 */
export function useClients() {
  return useQuery({
    queryKey: [api.clients.list.path],
    queryFn: async () => {
      const res = await fetch(api.clients.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao buscar clientes");
      return res.json();
    },
  });
}

/**
 * Fetches a single client by ID. Returns `null` when the client is not found (404).
 *
 * @param id - The client ID to fetch.
 * @returns A TanStack Query result containing the client or `null`.
 */
export function useClient(id: number) {
  return useQuery({
    queryKey: [api.clients.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.clients.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Falha ao buscar cliente");
      return res.json();
    },
    enabled: !!id,
  });
}

/**
 * Mutation hook to create a new client.
 * Invalidates the client list query and shows a success/error toast on completion.
 *
 * @returns A TanStack `useMutation` result whose `mutationFn` accepts a `CreateClientRequest`.
 */
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateClientRequest) => {
      const res = await fetch(api.clients.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Falha ao criar cliente");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
      toast({ title: "Sucesso!", description: "Cliente cadastrado com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Mutation hook to update an existing client.
 * Invalidates the client list query and shows a success/error toast on completion.
 *
 * @returns A TanStack `useMutation` result whose `mutationFn` accepts `{ id, ...UpdateClientRequest }`.
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateClientRequest) => {
      const url = buildUrl(api.clients.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Falha ao atualizar cliente");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
      toast({ title: "Atualizado!", description: "Dados do cliente atualizados." });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Mutation hook to delete a client by ID.
 * Invalidates the client list query and shows a success/error toast on completion.
 *
 * @returns A TanStack `useMutation` result whose `mutationFn` accepts a client `id`.
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.clients.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        if (res.status === 400) {
          const err = await res.json();
          throw new Error(err.message);
        }
        throw new Error("Falha ao excluir cliente");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
      toast({ title: "Excluído", description: "Cliente removido com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
}
