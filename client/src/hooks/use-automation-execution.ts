/**
 * Hooks para gerenciamento de execuções de automação
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// === TIPOS ===

export interface AutomationExecution {
  id: string;
  automationId: string;
  executionType: "scheduled" | "manual" | "catchup";
  status: "queued" | "running" | "completed" | "cancelled" | "failed";
  targetDate: string;
  scheduledTime: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  totalClients: number;
  processedClients: number;
  successfulMessages: number;
  failedMessages: number;
  errorMessage: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatchupStatus {
  isRunning: boolean;
  executionId: string | null;
}

// === HOOKS DE CONSULTA ===

/**
 * Hook para buscar todas as execuções
 */
export function useAutomationExecutions(
  page: number = 1,
  pageSize: number = 50
) {
  return useQuery({
    queryKey: ["automation-executions", page, pageSize],
    queryFn: async () => {
      const response = await fetch(
        `/api/automation/executions?page=${page}&pageSize=${pageSize}`
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar execuções");
      }

      return response.json() as Promise<{
        executions: AutomationExecution[];
        total: number;
      }>;
    },
    refetchInterval: 5000, // Atualizar a cada 5 segundos
  });
}

/**
 * Hook para buscar execuções em andamento
 */
export function useRunningExecutions() {
  return useQuery({
    queryKey: ["automation-executions-running"],
    queryFn: async () => {
      const response = await fetch("/api/automation/executions/running");

      if (!response.ok) {
        throw new Error("Erro ao buscar execuções em andamento");
      }

      return response.json() as Promise<{
        count: number;
        executions: AutomationExecution[];
      }>;
    },
    refetchInterval: 3000, // Atualizar a cada 3 segundos
  });
}

/**
 * Hook para buscar histórico de uma automação específica
 */
export function useExecutionHistory(automationId: string, limit: number = 50) {
  return useQuery({
    queryKey: ["automation-execution-history", automationId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/automation/executions/history/${automationId}?limit=${limit}`
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar histórico de execuções");
      }

      return response.json() as Promise<{
        automationId: string;
        count: number;
        executions: AutomationExecution[];
      }>;
    },
    enabled: !!automationId,
  });
}

/**
 * Hook para verificar status do catch-up
 */
export function useCatchupStatus() {
  return useQuery({
    queryKey: ["catchup-status"],
    queryFn: async () => {
      const response = await fetch("/api/automation/catchup/status");

      if (!response.ok) {
        throw new Error("Erro ao verificar status do catch-up");
      }

      return response.json() as Promise<CatchupStatus>;
    },
    refetchInterval: 3000, // Atualizar a cada 3 segundos
  });
}

// === HOOKS DE MUTAÇÃO ===

/**
 * Hook para cancelar uma execução específica
 */
export function useCancelExecution() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await fetch(
        `/api/automation/executions/${executionId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao cancelar execução");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Execução cancelada",
        description: "A execução foi cancelada com sucesso",
      });

      // Invalidar queries para atualizar lista
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
      queryClient.invalidateQueries({
        queryKey: ["automation-executions-running"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para cancelar todas as execuções
 */
export function useCancelAllExecutions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automation/executions/cancel-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao cancelar execuções");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Execuções canceladas",
        description: `${data.count} execução(ões) cancelada(s) com sucesso`,
      });

      // Invalidar queries para atualizar lista
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
      queryClient.invalidateQueries({
        queryKey: ["automation-executions-running"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para iniciar catch-up
 */
export function useStartCatchup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automation/catchup/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao iniciar catch-up");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Catch-up iniciado",
        description: "O catch-up foi iniciado em background",
      });

      // Invalidar queries para atualizar status
      queryClient.invalidateQueries({ queryKey: ["catchup-status"] });
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar catch-up",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para parar catch-up
 */
export function useStopCatchup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automation/catchup/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao parar catch-up");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Catch-up cancelado",
        description: "O catch-up foi cancelado com sucesso",
      });

      // Invalidar queries para atualizar status
      queryClient.invalidateQueries({ queryKey: ["catchup-status"] });
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao parar catch-up",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para executar catch-up completo
 */
export function useExecuteFullCatchup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automation/catchup/full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao iniciar catch-up completo");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Catch-up completo iniciado",
        description:
          "O catch-up completo (últimos 7 dias) foi iniciado em background",
      });

      // Invalidar queries para atualizar status
      queryClient.invalidateQueries({ queryKey: ["catchup-status"] });
      queryClient.invalidateQueries({ queryKey: ["automation-executions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar catch-up completo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
