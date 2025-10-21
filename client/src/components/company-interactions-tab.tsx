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
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 justify-between items-start sm:items-center mb-6">
        <div className="flex-1">
          <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-1">
            Histórico de Interações
          </h3>
          <p className="text-sm lg:text-base text-muted-foreground">
            Acompanhe todas as interações com{" "}
            <span className="font-medium text-gray-700">
              {company.nomeFantasia}
            </span>
          </p>
        </div>
        <Button
          onClick={handleAddNewInteraction}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Nova Interação</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {interactions.length === 0 ? (
        <Card className="shadow-sm border-0 bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="flex flex-col items-center justify-center py-12 lg:py-16 px-6">
            <div className="bg-blue-100 p-4 rounded-full mb-6">
              <MessageSquare className="h-8 w-8 lg:h-10 lg:w-10 text-blue-600" />
            </div>
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-2 text-center">
              Nenhuma interação registrada
            </h3>
            <p className="text-sm lg:text-base text-gray-500 text-center mb-6 max-w-md">
              Comece registrando a primeira interação com esta empresa para
              acompanhar o relacionamento.
            </p>
            <Button
              onClick={handleAddNewInteraction}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Interação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 lg:space-y-4">
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
                className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:bg-gradient-to-r hover:from-white hover:to-gray-50"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className={`p-2 lg:p-3 rounded-full ${typeConfig.color} shadow-sm flex-shrink-0`}
                      >
                        <IconComponent className="h-4 w-4 lg:h-5 lg:w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm lg:text-base mb-1 truncate">
                          {interaction.subject}
                        </h4>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs lg:text-sm text-gray-600">
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Calendar className="h-3 w-3 lg:h-4 lg:w-4" />
                            <span className="font-medium">
                              {formatDateTime(interaction.date)}
                            </span>
                          </div>
                          {interaction.callResult &&
                            interaction.type === "telemarketing" && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Phone className="h-3 w-3 lg:h-4 lg:w-4" />
                                <span className="text-gray-700 font-medium">
                                  {interaction.callResult}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-700 text-sm lg:text-base mb-4 leading-relaxed">
                      {interaction.description}
                    </p>

                    {/* Mostrar informações de localização para visitas */}
                    {interaction.type === "visit" &&
                      (interaction.address ||
                        (interaction.latitude && interaction.longitude)) && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 lg:p-4 mb-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-blue-100 p-1 rounded-full">
                              <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
                            </div>
                            <span className="text-sm lg:text-base font-semibold text-blue-900">
                              Localização da Visita
                            </span>
                          </div>
                          {interaction.address && (
                            <p className="text-sm lg:text-base text-blue-800 mb-2 leading-relaxed">
                              {interaction.address}
                            </p>
                          )}
                          {interaction.latitude && interaction.longitude && (
                            <div className="bg-white bg-opacity-60 rounded px-2 py-1 inline-block">
                              <p className="text-xs lg:text-sm text-blue-700 font-mono">
                                📍 {Number(interaction.latitude).toFixed(6)},{" "}
                                {Number(interaction.longitude).toFixed(6)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`${typeConfig.color} shadow-sm font-medium text-xs lg:text-sm`}
                        >
                          {typeConfig.label}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`${statusConfig_.color} shadow-sm font-medium text-xs lg:text-sm`}
                        >
                          {statusConfig_.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-xs lg:text-sm text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                          <User className="h-3 w-3 lg:h-4 lg:w-4" />
                          <span className="font-medium">
                            {interaction.user?.name || "Usuário não encontrado"}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditInteraction(interaction)}
                            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Editar interação"
                          >
                            <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteInteractionMutation.mutate(interaction.id)
                            }
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Excluir interação"
                          >
                            <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
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
