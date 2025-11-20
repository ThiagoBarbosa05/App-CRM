import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

interface ConfirmClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export default function ConfirmClientModal({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ConfirmClientModalProps) {
  const { toast } = useToast();
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmClientMutation = useMutation({
    mutationFn: async (code: string) => {
      const url = `/api/clients/${clientId}/confirm`;
      const response = await apiRequest("POST", url, {
        confirmationCode: code,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Cadastro confirmado",
        description: "O cadastro do cliente foi confirmado com sucesso!",
      });
      onOpenChange(false);
      setConfirmationCode("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar",
        description:
          error.message || "Não foi possível confirmar o cadastro do cliente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmationCode || confirmationCode.trim().length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código de confirmação deve ter 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmClientMutation.mutateAsync(confirmationCode.trim());
    } catch (error) {
      console.error("Erro ao confirmar cliente:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Confirmar Cadastro
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Cliente: <strong>{clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">
                  Como obter o código?
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  1. Acesse o Umbler e localize o contato do cliente
                  <br />
                  2. Verifique as notas do contato
                  <br />
                  3. Copie o código de confirmação de 6 dígitos enviado após a
                  criação do cliente
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Código de Confirmação
              </label>
              <Input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={confirmationCode}
                onChange={(e) => {
                  // Apenas números
                  const value = e.target.value.replace(/\D/g, "");
                  setConfirmationCode(value);
                }}
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Digite o código de 6 dígitos enviado para o Umbler
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setConfirmationCode("");
              }}
              className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || confirmationCode.length !== 6}
              className="bg-purple-700 hover:bg-purple-800 text-white border-0"
              style={{ backgroundColor: "#7c3aed", color: "white" }}
            >
              {isSubmitting ? "Confirmando..." : "Confirmar Cadastro"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
