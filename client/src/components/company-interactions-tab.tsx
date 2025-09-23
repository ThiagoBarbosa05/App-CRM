import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  User,
  Edit,
  Users,
  MapPin,
  StickyNote,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Company,
  ClientInteraction,
  ClientInteractionWithUser,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import InteractionFormModal from "@/components/interaction-form-modal";

interface CompanyInteractionsTabProps {
  company: Company;
}

const interactionTypeConfig = {
  telemarketing: {
    label: "Ligação",
    icon: Phone,
    color: "bg-blue-100 text-blue-800",
  },
  email: { label: "E-mail", icon: Mail, color: "bg-green-100 text-green-800" },
  meeting: {
    label: "Reunião",
    icon: Users,
    color: "bg-purple-100 text-purple-800",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageSquare,
    color: "bg-teal-100 text-teal-800",
  },
  visit: {
    label: "Visita",
    icon: MapPin,
    color: "bg-indigo-100 text-indigo-800",
  },
  note: {
    label: "Anotação",
    icon: StickyNote,
    color: "bg-gray-200 text-gray-800",
  },
  other: { label: "Outro", icon: Clock, color: "bg-gray-100 text-gray-800" },
  call: { label: "Chamada", icon: Phone, color: "bg-sky-100 text-sky-800" },
};

const statusConfig = {
  scheduled: { label: "Agendado", color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

export default function CompanyInteractionsTab({
  company,
}: CompanyInteractionsTabProps) {
  const { toast } = useToast();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInteraction, setEditingInteraction] =
    useState<ClientInteraction | null>(null);

  const { data: interactions = [], isLoading } = useQuery<
    ClientInteractionWithUser[]
  >({
    queryKey: ["interactions", "company", company.id],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/companies/${company.id}/interactions`
      );
      if (!response.ok) {
        throw new Error("Erro ao buscar interações da empresa");
      }
      return response.json();
    },
    enabled: !!company.id,
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      await apiRequest("DELETE", `/api/interactions/${interactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["interactions", "company", company.id],
      });
      toast({
        title: "Interação excluída",
        description: "A interação foi removida com sucesso.",
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

  const handleAddNewInteraction = () => {
    setEditingInteraction(null);
    setShowFormModal(true);
  };

  const handleEditInteraction = (interaction: ClientInteraction) => {
    setEditingInteraction(interaction);
    setShowFormModal(true);
  };

  const formatDateTime = (date: string | Date) => {
    try {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      return format(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return "Data inválida";
    }
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
          <h3 className="text-lg font-medium">Histórico de Interações</h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe todas as interações com {company.nomeFantasia}
          </p>
        </div>
        <Button onClick={handleAddNewInteraction}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Interação
        </Button>
      </div>

      {interactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma interação registrada
            </h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Comece registrando a primeira interação com esta empresa.
            </p>
            <Button onClick={handleAddNewInteraction}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Interação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interactions.map((interaction) => {
            const typeConfig =
              interactionTypeConfig[
                interaction.type as keyof typeof interactionTypeConfig
              ] || interactionTypeConfig.other;
            const statusConfig_ = statusConfig[
              interaction.status as keyof typeof statusConfig
            ] || { label: "Desconhecido", color: "bg-gray-100 text-gray-800" };
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
                        <h4 className="font-medium text-gray-900">
                          {interaction.subject}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateTime(interaction.date)}
                          </div>
                          {interaction.callResult &&
                            interaction.type === "telemarketing" && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {interaction.callResult}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-3">
                      {interaction.description}
                    </p>

                    {/* Mostrar informações de localização para visitas */}
                    {interaction.type === "visit" &&
                      (interaction.address ||
                        (interaction.latitude && interaction.longitude)) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                              Localização da Visita
                            </span>
                          </div>
                          {interaction.address && (
                            <p className="text-sm text-blue-800 mb-1">
                              {interaction.address}
                            </p>
                          )}
                          {interaction.latitude && interaction.longitude && (
                            <p className="text-xs text-blue-600">
                              Coordenadas:{" "}
                              {Number(interaction.latitude).toFixed(6)},{" "}
                              {Number(interaction.longitude).toFixed(6)}
                            </p>
                          )}
                        </div>
                      )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={typeConfig.color}>
                          {typeConfig.label}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={statusConfig_.color}
                        >
                          {statusConfig_.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {interaction.user?.name || "Usuário não encontrado"}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditInteraction(interaction)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteInteractionMutation.mutate(interaction.id)
                            }
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showFormModal && (
        <InteractionFormModal
          open={showFormModal}
          onOpenChange={(open) => {
            setShowFormModal(open);
            if (!open) {
              setEditingInteraction(null);
              // Invalidar queries para garantir que os dados sejam atualizados
              queryClient.invalidateQueries({
                queryKey: ["interactions", "company", company.id],
              });
              queryClient.invalidateQueries({
                queryKey: ["/api/companies", company.id, "interactions"],
              });
            }
          }}
          target={{ id: company.id, type: "company" }}
          interaction={editingInteraction || undefined}
        />
      )}
    </div>
  );
}
