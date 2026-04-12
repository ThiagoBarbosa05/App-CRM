
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Client, ClientCashbackBalance } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Wallet, AlertTriangle } from "lucide-react";

interface CashbackUsageModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CashbackUsageModal({ client, open, onOpenChange }: CashbackUsageModalProps) {
  const { user } = useAuth();
  const [usedAmount, setUsedAmount] = useState("");
  const [description, setDescription] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Buscar saldo atual do cliente
  const { data: balance } = useQuery<ClientCashbackBalance>({
    queryKey: [`/api/cashback-balances/${client?.id}`],
    enabled: !!client?.id && open,
  });

  const useCashbackMutation = useMutation({
    mutationFn: async (usageData: {
      clientId: string;
      usedAmount: number;
      description: string;
    }) => {
      const response = await fetch("/api/cashback-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: usageData.clientId,
          usedAmount: usageData.usedAmount.toString(),
          description: usageData.description,
          authorizedBy: user?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao registrar uso do cashback");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cashback resgatado com sucesso",
        description: `R$ ${parseFloat(usedAmount).toFixed(2)} foram descontados do saldo do cliente.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cashback-balances/${client?.id}`] });
      setUsedAmount("");
      setDescription("");
      setInvoiceNumber("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao resgatar cashback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client || !usedAmount || parseFloat(usedAmount) <= 0) {
      toast({
        title: "Erro",
        description: "Valor deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    const currentBalance = balance && typeof balance === 'object' ? (balance.balance || 0) : 0;
    const requestedAmount = parseFloat(usedAmount);

    if (requestedAmount > currentBalance) {
      toast({
        title: "Saldo insuficiente",
        description: `Cliente possui apenas R$ ${currentBalance.toFixed(2)} disponível`,
        variant: "destructive",
      });
      return;
    }

    const finalDescription = invoiceNumber 
      ? `${description || 'Resgate de cashback'} - NF: ${invoiceNumber}` 
      : description || `Resgate de cashback - R$ ${requestedAmount.toFixed(2)}`;

    useCashbackMutation.mutate({
      clientId: client.id,
      usedAmount: requestedAmount,
      description: finalDescription,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!client) return null;

  const currentBalance = balance && typeof balance === 'object' ? (balance.balance || 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Resgatar Cashback - {client.name}
          </DialogTitle>
        </DialogHeader>

        {/* Saldo atual */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">Saldo Disponível:</span>
            <span className="text-lg font-bold text-blue-900">
              {formatCurrency(currentBalance)}
            </span>
          </div>
        </div>

        {currentBalance <= 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
            <p className="text-yellow-700 font-medium">Cliente não possui saldo de cashback</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usedAmount">Valor a Resgatar</Label>
              <Input
                id="usedAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={currentBalance.toString()}
                placeholder="0,00"
                value={usedAmount}
                onChange={(e) => setUsedAmount(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                Máximo disponível: {formatCurrency(currentBalance)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Número da Nota Fiscal</Label>
              <Input
                id="invoiceNumber"
                type="text"
                placeholder="Ex: 123456"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Opcional - Número da nota fiscal relacionada ao resgate
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição do Resgate</Label>
              <Textarea
                id="description"
                placeholder="Ex: Desconto em compra, troca por produto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={useCashbackMutation.isPending || !usedAmount || parseFloat(usedAmount) <= 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {useCashbackMutation.isPending ? "Processando..." : "Resgatar Cashback"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
