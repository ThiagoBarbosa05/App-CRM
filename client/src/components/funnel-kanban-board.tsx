import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { DealWithClient } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
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

interface SalesFunnel {
  id: string;
  name: string;
  description?: string;
  isActive: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stages: FunnelStage[];
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

import { FunnelStage } from "@shared/schema";

interface FunnelKanbanBoardProps {
  funnelId: string;
  funnel: SalesFunnel;
}

export default function FunnelKanbanBoard({ funnelId, funnel }: FunnelKanbanBoardProps) {
  const { toast } = useToast();
  const [editingDeal, setEditingDeal] = useState<DealWithClient | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<DealWithClient | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<DealWithClient | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<DealWithClient['client'] | null>(null);
  const [editingClient, setEditingClient] = useState<DealWithClient['client'] | null>(null);

  const { data: deals, isLoading } = useQuery({
    queryKey: ["/api/deals", funnelId],
    queryFn: () => fetch(`/api/deals?funnelId=${funnelId}`).then(res => res.json()),
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      await apiRequest(`/api/deals/${id}`, "PUT", { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", funnelId] });
      toast({
        title: "Deal atualizado",
        description: "O estágio do deal foi alterado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o deal.",
        variant: "destructive",
      });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", funnelId] });
      toast({
        title: "Deal excluído",
        description: "O deal foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o deal.",
        variant: "destructive",
      });
    },
  });

  const getDealsForStage = (stageId: string) => {
    if (!deals || !Array.isArray(deals)) return [];
    return deals.filter((deal: DealWithClient) => deal.stageId === stageId);
  };

  const handleDragStart = (deal: DealWithClient) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stageId !== stageId) {
      updateDealMutation.mutate({ id: draggedDeal.id, stageId });
    }
    setDraggedDeal(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando deals...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Deals no funil</h3>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Deal
          </Button>
        </div>

        <div className="grid gap-6 h-full" style={{ gridTemplateColumns: `repeat(${funnel.stages?.length || 1}, 1fr)` }}>
          {funnel.stages?.map((stage) => {
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
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
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
                      className="kanban-card bg-white border border-gray-200 rounded-lg p-4 card-shadow cursor-move hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm leading-tight">
                          {deal.title}
                        </h4>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingDeal(deal)}
                            className="h-6 w-6 p-0 hover:bg-gray-100"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingDeal(deal)}
                            className="h-6 w-6 p-0 hover:bg-red-100 text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Cliente: <button 
                            onClick={() => setSelectedClient(deal.client)}
                            className="text-wine-600 hover:text-wine-800 underline font-medium"
                          >
                            {deal.client?.name}
                          </button>
                        </p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(parseFloat(deal.value))}
                        </p>
                        {deal.notes && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {deal.notes}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDate(deal.createdAt.toString())}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Nenhum deal neste estágio</p>
                    </div>
                  )}
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
          funnelId={funnelId}
        />
      )}

      {isCreateModalOpen && (
        <DealFormModal
          open={isCreateModalOpen}
          onOpenChange={(open) => !open && setIsCreateModalOpen(false)}
          funnelId={funnelId}
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

      <AlertDialog open={!!deletingDeal} onOpenChange={() => setDeletingDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o deal "{deletingDeal?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingDeal) {
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