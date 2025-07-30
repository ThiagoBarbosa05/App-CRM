
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Client } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { DollarSign, Calculator } from "lucide-react";

interface SaleFormModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SaleFormModal({ client, open, onOpenChange }: SaleFormModalProps) {
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [cashbackPreview, setCashbackPreview] = useState<{
    cashbackAmount: number;
    rate: number;
  } | null>(null);

  // Query para calcular cashback em tempo real
  const { data: cashbackCalculation } = useQuery({
    queryKey: ["calculate-cashback", purchaseAmount],
    queryFn: async () => {
      if (!purchaseAmount || parseFloat(purchaseAmount) <= 0) return null;
      const response = await fetch("/api/calculate-cashback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseAmount: parseFloat(purchaseAmount) }),
      });
      if (!response.ok) throw new Error("Erro ao calcular cashback");
      return response.json();
    },
    enabled: !!purchaseAmount && parseFloat(purchaseAmount) > 0,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: {
      clientId: string;
      purchaseAmount: number;
      notes?: string;
    }) => {
      // Primeiro, calcular o cashback
      const cashbackResponse = await fetch("/api/calculate-cashback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseAmount: saleData.purchaseAmount }),
      });
      
      if (!cashbackResponse.ok) {
        throw new Error("Erro ao calcular cashback");
      }
      
      const cashbackData = await cashbackResponse.json();
      
      // Criar a transação de cashback
      const transactionResponse = await fetch("/api/cashback-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: saleData.clientId,
          purchaseAmount: saleData.purchaseAmount.toString(),
          cashbackAmount: cashbackData.cashbackAmount.toString(),
          cashbackRate: cashbackData.rate.toString(),
          status: "approved",
          settingId: cashbackData.setting?.id || null,
          notes: saleData.notes || `Venda registrada - Valor: R$ ${saleData.purchaseAmount.toFixed(2)}`,
          processedBy: "system", // Idealmente seria o ID do usuário logado
        }),
      });

      if (!transactionResponse.ok) {
        const error = await transactionResponse.json();
        throw new Error(error.message || "Erro ao registrar venda");
      }

      return await transactionResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "Venda registrada com sucesso",
        description: `Cashback de R$ ${cashbackCalculation?.cashbackAmount?.toFixed(2) || '0,00'} foi creditado.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback-balances"] });
      setPurchaseAmount("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar venda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client || !purchaseAmount || parseFloat(purchaseAmount) <= 0) {
      toast({
        title: "Erro",
        description: "Valor da compra deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    createSaleMutation.mutate({
      clientId: client.id,
      purchaseAmount: parseFloat(purchaseAmount),
      notes,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Lançar Venda - {client.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="purchaseAmount">Valor da Compra</Label>
            <Input
              id="purchaseAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              required
            />
          </div>

          {/* Preview do Cashback */}
          {cashbackCalculation && cashbackCalculation.cashbackAmount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Prévia do Cashback</span>
              </div>
              <div className="text-sm text-green-700">
                <p><strong>Taxa:</strong> {cashbackCalculation.rate}%</p>
                <p><strong>Cashback:</strong> {formatCurrency(cashbackCalculation.cashbackAmount)}</p>
              </div>
            </div>
          )}

          {cashbackCalculation && cashbackCalculation.cashbackAmount === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-700">
                Esta compra não gera cashback. Verifique as configurações do programa.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Detalhes da venda..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              disabled={createSaleMutation.isPending || !purchaseAmount || parseFloat(purchaseAmount) <= 0}
            >
              {createSaleMutation.isPending ? "Registrando..." : "Registrar Venda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
