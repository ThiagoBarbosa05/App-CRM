import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useToggleWhatsappOptOut() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ clientId, optedOut }: { clientId: string; optedOut: boolean }) => {
      const res = await apiRequest("PATCH", `/api/clients/${clientId}/whatsapp-opt-out`, { optedOut });
      return res.json();
    },
    onSuccess: (_, { optedOut }) => {
      toast({
        title: optedOut ? "Cliente marcado como opt-out" : "Opt-out revertido",
        description: optedOut
          ? "O cliente não receberá mais campanhas nem bots de marketing por WhatsApp."
          : "O cliente voltou a ser elegível para campanhas e bots de marketing por WhatsApp.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar opt-out",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
