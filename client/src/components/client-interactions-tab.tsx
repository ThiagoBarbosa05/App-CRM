import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Client, type ClientInteractionWithUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  Phone, 
  Mail, 
  MessageSquare, 
  Users, 
  MapPin, 
  StickyNote,
  Plus,
  Edit,
  Trash2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import InteractionFormModal from "./interaction-form-modal";
import { useToast } from "@/hooks/use-toast";

interface ClientInteractionsTabProps {
  client: Client;
}

const interactionTypeConfig = {
  telemarketing: { label: "Telemarketing", icon: Phone, color: "bg-cyan-100 text-cyan-800" },
  email: { label: "E-mail", icon: Mail, color: "bg-green-100 text-green-800" },
  meeting: { label: "Reunião", icon: Users, color: "bg-purple-100 text-purple-800" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "bg-emerald-100 text-emerald-800" },
  visit: { label: "Visita", icon: MapPin, color: "bg-orange-100 text-orange-800" },
  note: { label: "Anotação", icon: StickyNote, color: "bg-gray-100 text-gray-800" },
  other: { label: "Outro", icon: Clock, color: "bg-indigo-100 text-indigo-800" },
};

const statusConfig = {
  completed: { label: "Concluído", color: "bg-green-100 text-green-800" },
  scheduled: { label: "Agendado", color: "bg-yellow-100 text-yellow-800" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

export default function ClientInteractionsTab({ client }: ClientInteractionsTabProps) {
  const { toast } = useToast();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<ClientInteractionWithUser | null>(null);

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["/api/clients", client.id, "interactions"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${client.id}/interactions`);
      if (!response.ok) throw new Error("Erro ao buscar interações");
      return response.json();
    },
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      await apiRequest(`/api/interactions/${interactionId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", client.id, "interactions"] });
      toast({
        title: "Interação excluída",
        description: "Interação foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a interação.",
        variant: "destructive",
      });
    },
  });

  const formatDateTime = (date: string) => {
    const dateObj = new Date(date);
    return format(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatCallResult = (result: string | null) => {
    return result || "";
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Interações</h3>
          <p className="text-sm text-gray-600">
            {interactions.length} {interactions.length === 1 ? 'interação registrada' : 'interações registradas'}
          </p>
        </div>
        <Button
          onClick={() => setShowFormModal(true)}
          className="bg-primary hover:bg-primary-dark text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Interação
        </Button>
      </div>

      {interactions.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma interação registrada</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comece adicionando uma nova interação com este cliente.
          </p>
          <div className="mt-6">
            <Button
              onClick={() => setShowFormModal(true)}
              className="bg-primary hover:bg-primary-dark text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Primeira Interação
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {interactions.map((interaction: ClientInteractionWithUser) => {
            const typeConfig = interactionTypeConfig[interaction.type as keyof typeof interactionTypeConfig];
            const statusConfig_ = statusConfig[interaction.status as keyof typeof statusConfig];
            const IconComponent = typeConfig.icon;

            return (
              <div
                key={interaction.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-full ${typeConfig.color}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{interaction.subject}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(interaction.date)}
                          </div>
                          {interaction.callResult && interaction.type === "telemarketing" && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatCallResult(interaction.callResult)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-3">{interaction.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={typeConfig.color}>
                          {typeConfig.label}
                        </Badge>
                        <Badge variant="secondary" className={statusConfig_.color}>
                          {statusConfig_.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        por {interaction.user.name} • {formatDistanceToNow(new Date(interaction.createdAt.toString()), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingInteraction(interaction)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteInteractionMutation.mutate(interaction.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InteractionFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        clientId={client.id}
      />

      {editingInteraction && (
        <InteractionFormModal
          open={!!editingInteraction}
          onOpenChange={(open) => !open && setEditingInteraction(null)}
          clientId={client.id}
          interaction={editingInteraction}
        />
      )}
    </div>
  );
}