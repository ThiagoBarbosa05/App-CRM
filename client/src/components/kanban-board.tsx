import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { DealWithClient } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "./deal-form-modal";
import ClientDetailsCard from "./client-details-card";
import ClientFormModal from "./client-form-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const stages = [
  {
    id: "prospeccao" as const,
    title: "Prospecção",
    color: "bg-blue-500",
  },
  {
    id: "negociacao" as const,
    title: "Negociação", 
    color: "bg-yellow-500",
  },
  {
    id: "fechamento" as const,
    title: "Fechamento",
    color: "bg-green-500",
  },
];

export default function KanbanBoard() {
  const { toast } = useToast();
  const [editingDeal, setEditingDeal] = useState<DealWithClient | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<DealWithClient | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<DealWithClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<DealWithClient['client'] | null>(null);
  const [editingClient, setEditingClient] = useState<DealWithClient['client'] | null>(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["/api/deals"],
    queryFn: () => {
      // Get user data from localStorage for the query
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        return apiRequest(`/api/deals?userId=${user.id}&userRole=${user.role}`);
      }
      return apiRequest("/api/deals");
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      await apiRequest("PUT", `/api/deals/${id}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Negócio atualizado",
        description: "O estágio do negócio foi alterado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o negócio.",
        variant: "destructive",
      });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Negócio excluído",
        description: "Negócio foi removido com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o negócio.",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (deal: DealWithClient) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stageId !== targetStage) {
      updateDealMutation.mutate({
        id: draggedDeal.id,
        stage: targetStage,
      });
    }
    setDraggedDeal(null);
  };

  // Provide default empty array if deals is undefined
  const dealsList = deals || [];

  const getDealsForStage = (stageId: string) => {
    return Array.isArray(dealsList) ? dealsList.filter((deal: DealWithClient) => deal.stageId === stageId) : [];
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Carregando negócios...</div>
      </div>
    );
  }

  if (!Array.isArray(dealsList) || dealsList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum negócio cadastrado
          </h3>
          <p className="text-gray-500">
            Comece adicionando seu primeiro negócio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          {stages.map((stage) => {
            const stageDeals = getDealsForStage(stage.id);

            return (
              <div
                key={stage.id}
                className="bg-white rounded-lg card-shadow p-4 kanban-column"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <div className={cn("w-3 h-3 rounded-full mr-2", stage.color)} />
                    {stage.title}
                  </h3>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {stageDeals.map((deal: DealWithClient) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                      className="kanban-card bg-white border border-gray-200 rounded-lg p-4 card-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-green-600 font-semibold text-sm">
                          {formatCurrency(parseFloat(deal.value))}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {deal.client ? (
                          <>Cliente: <button 
                            onClick={() => setSelectedClient(deal.client)}
                            className="text-wine-600 hover:text-wine-800 underline font-medium"
                          >
                            {deal.client.name}
                          </button></>
                        ) : deal.companyId ? (
                          <>Empresa: <span className="text-wine-600 font-medium">
                            ID: {deal.companyId}
                          </span></>
                        ) : (
                          "Sem cliente/empresa"
                        )}
                      </p>
                      {deal.notes && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                          {deal.notes}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Criado em {formatDate(deal.createdAt.toString())}
                        </span>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingDeal(deal)}
                            className="text-gray-400 hover:text-gray-600 h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              console.log("Clicou para excluir negócio:", deal.id, deal.title);
                              setDeletingDeal(deal);
                            }}
                            className="text-gray-400 hover:text-red-600 h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingDeal && (
        <DealFormModal
          open={!!editingDeal}
          onOpenChange={(open) => !open && setEditingDeal(null)}
          deal={editingDeal}
          funnelId={editingDeal?.funnelId}
        />
      )}

      <ClientDetailsCard
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
        onEdit={(client) => {
          setSelectedClient(null);
          setEditingClient(client);
        }}
      />

      {editingClient && (
        <ClientFormModal
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          client={editingClient}
        />
      )}

      <AlertDialog open={!!deletingDeal} onOpenChange={(open) => !open && setDeletingDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o negócio "{deletingDeal?.title}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingDeal) {
                  console.log("Confirmou exclusão do negócio:", deletingDeal.id);
                  deleteDealMutation.mutate(deletingDeal.id);
                  setDeletingDeal(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}