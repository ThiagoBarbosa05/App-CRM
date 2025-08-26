import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Company, ClientInteractionWithUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import InteractionFormModal from "@/components/interaction-form-modal";

interface CompanyInteractionsTabProps {
  company: Company;
}

const interactionTypeConfig = {
  telemarketing: {
    label: "Telemarketing",
    icon: Phone,
    color: "bg-blue-100 text-blue-800",
  },
  email: {
    label: "E-mail",
    icon: Mail,
    color: "bg-green-100 text-green-800",
  },
  meeting: {
    label: "Reunião",
    icon: User,
    color: "bg-purple-100 text-purple-800",
  },
  other: {
    label: "Outro",
    icon: MessageSquare,
    color: "bg-gray-100 text-gray-800",
  },
};

const statusConfig = {
  pending: {
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-800",
  },
  completed: {
    label: "Concluído",
    color: "bg-green-100 text-green-800",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-100 text-red-800",
  },
};

export default function CompanyInteractionsTab({ company }: CompanyInteractionsTabProps) {
  const { toast } = useToast();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<ClientInteractionWithUser | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["/api/companies", company.id, "interactions"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${company.id}/interactions`);
      if (!response.ok) throw new Error("Erro ao buscar interações");
      return response.json();
    },
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      await apiRequest(`/api/interactions/${interactionId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", company.id, "interactions"] });
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

  const formatDateTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
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
          <h3 className="text-lg font-medium">Histórico de Interações</h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe todas as interações com {company.nomeFantasia}
          </p>
        </div>
        <Button
          onClick={() => {
            // Para empresas, precisamos primeiro buscar um cliente da empresa
            // ou permitir que o usuário selecione um cliente
            const firstDeal = interactions.length > 0 ? interactions[0] : null;
            if (firstDeal) {
              setSelectedClientId(firstDeal.clientId);
              setEditingInteraction(null);
              setShowFormModal(true);
            } else {
              toast({
                title: "Atenção",
                description: "Esta empresa não possui negócios com clientes. Adicione primeiro um negócio para criar interações.",
                variant: "destructive",
              });
            }
          }}
          className="bg-black hover:bg-gray-800 text-white"
        >
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
            <Button
              onClick={() => {
                toast({
                  title: "Atenção",
                  description: "Esta empresa não possui negócios com clientes. Adicione primeiro um negócio para criar interações.",
                  variant: "destructive",
                });
              }}
              className="bg-black hover:bg-gray-800 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Interação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interactions.map((interaction: ClientInteractionWithUser) => {
            const typeConfig = interactionTypeConfig[interaction.type as keyof typeof interactionTypeConfig] || {
              label: "Outro", 
              icon: Clock, 
              color: "bg-gray-100 text-gray-800"
            };
            const statusConfig_ = statusConfig[interaction.status as keyof typeof statusConfig] || {
              label: "Desconhecido",
              color: "bg-gray-100 text-gray-800"
            };
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
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {interaction.user?.name || "Usuário não encontrado"}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClientId(interaction.clientId);
                              setEditingInteraction(interaction);
                              setShowFormModal(true);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInteractionMutation.mutate(interaction.id)}
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

      {/* Modal de formulário de interação */}
      {selectedClientId && (
        <InteractionFormModal
          open={showFormModal}
          onOpenChange={(open) => {
            setShowFormModal(open);
            if (!open) {
              setEditingInteraction(null);
              setSelectedClientId("");
            }
          }}
          clientId={selectedClientId}
          interaction={editingInteraction || undefined}
        />
      )}
    </div>
  );
}