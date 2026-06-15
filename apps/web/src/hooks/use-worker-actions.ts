import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

export function useStartWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => client.startWorker(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus });
    },
  });
}

export function useStopWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => client.stopWorker(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus });
    },
  });
}

export function useRestartWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => client.restartWorker(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus });
    },
  });
}
