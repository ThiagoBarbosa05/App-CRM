import { useState, useMemo } from "react";
import { useMessageJobsLogs } from "../hooks/useMessageJobsLogs";
import { useClientsMap } from "../hooks/useClientsMap";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Settings, Clock, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface MessageAutomationSetting {
  id: string;
  enabled: boolean;
  sendTime: string;
  daysBefore: number;
  template?: string;
  externalChannelId?: string;
  createdAt: string;
  updatedAt: string;
}

interface UmblerChannel {
  id: string;
  name: string;
  phoneNumber?: string;
}

interface AutomationFormData {
  enabled: boolean;
  sendTime: string;
  daysBefore: number;
  template: string;
  externalChannelId: string;
}

const TIME_OPTIONS = [
  { value: "08:00", label: "08:00" },
  { value: "09:00", label: "09:00" },
  { value: "10:00", label: "10:00" },
  { value: "11:00", label: "11:00" },
  { value: "12:00", label: "12:00" },
  { value: "13:00", label: "13:00" },
  { value: "14:00", label: "14:00" },
  { value: "15:00", label: "15:00" },
  { value: "16:00", label: "16:00" },
  { value: "17:00", label: "17:00" },
  { value: "18:00", label: "18:00" },
];

const DAYS_BEFORE_OPTIONS = [
  { value: 0, label: "No dia do aniversário" },
  { value: 1, label: "1 dia antes" },
  { value: 5, label: "2 dias antes" },
  { value: 10, label: "3 dias antes" },
  { value: 15, label: "1 semana antes" },
];

const DEFAULT_TEMPLATE = `🎉 Parabéns pelo seu aniversário! 

Que este novo ano de vida seja repleto de alegrias, conquistas e momentos especiais!

Em comemoração à sua data especial, preparamos uma surpresa para você. 

Feliz aniversário! 🎂✨`;

// Hook para buscar automações
function useMessageAutomations() {
  return useQuery<MessageAutomationSetting[]>({
    queryKey: ["message-automation-settings"],
    queryFn: async () => {
      const response = await fetch("/api/message-automation-settings");
      if (!response.ok) throw new Error("Failed to fetch automations");
      return response.json();
    },
  });
}

// Hook para buscar canais Umbler
function useUmblerChannels() {
  return useQuery<UmblerChannel[]>({
    queryKey: ["umbler-channels"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/channels");
      if (!response.ok) throw new Error("Failed to fetch channels");
      return response.json();
    },
  });
}

// Hook para criar automação
function useCreateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AutomationFormData) => {
      const response = await fetch("/api/message-automation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create automation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-automation-settings"] });
      toast({
        title: "Automação criada",
        description: "A automação foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar automação",
        description: error.message || "Não foi possível criar a automação.",
        variant: "destructive",
      });
    },
  });
}

// Hook para atualizar automação
function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AutomationFormData> }) => {
      const response = await fetch(`/api/message-automation-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update automation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-automation-settings"] });
      toast({
        title: "Automação atualizada",
        description: "A automação foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar automação",
        description: error.message || "Não foi possível atualizar a automação.",
        variant: "destructive",
      });
    },
  });
}

// Hook para deletar automação
function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/message-automation-settings/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete automation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-automation-settings"] });
      toast({
        title: "Automação removida",
        description: "A automação foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover automação",
        description: error.message || "Não foi possível remover a automação.",
        variant: "destructive",
      });
    },
  });
}

// Componente de formulário para automação
function AutomationForm({
  automation,
  channels,
  onSubmit,
  onCancel,
  isLoading,
}: {
  automation?: MessageAutomationSetting;
  channels: UmblerChannel[];
  onSubmit: (data: AutomationFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<AutomationFormData>({
    enabled: automation?.enabled ?? true,
    sendTime: automation?.sendTime ?? "09:00",
    daysBefore: automation?.daysBefore ?? 0,
    template: automation?.template ?? DEFAULT_TEMPLATE,
    externalChannelId: automation?.externalChannelId ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.externalChannelId) {
      toast({
        title: "Canal obrigatório",
        description: "Selecione um canal para envio das mensagens.",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="enabled"
            checked={formData.enabled}
            onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
          />
          <Label htmlFor="enabled">Automação ativa</Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daysBefore">Disparar</Label>
            <Select
              value={formData.daysBefore.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, daysBefore: parseInt(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_BEFORE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sendTime">Horário de envio</Label>
            <Select
              value={formData.sendTime}
              onValueChange={(sendTime) => setFormData({ ...formData, sendTime })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="channel">Canal de envio</Label>
          <Select
            value={formData.externalChannelId}
            onValueChange={(externalChannelId) =>
              setFormData({ ...formData, externalChannelId })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um canal" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name} {channel.phoneNumber && `(${channel.phoneNumber})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="template">Modelo da mensagem</Label>
          <Textarea
            id="template"
            placeholder="Digite o modelo da mensagem de aniversário..."
            value={formData.template}
            onChange={(e) => setFormData({ ...formData, template: e.target.value })}
            rows={8}
            className="resize-none"
          />
          <p className="text-sm text-muted-foreground">
            Esta mensagem será enviada automaticamente para os clientes aniversariantes.
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : automation ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}

// Componente principal
export function AutomationManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<MessageAutomationSetting | null>(null);

  const { data: automations = [], isLoading: isLoadingAutomations } = useMessageAutomations();
  const { data: channels = [], isLoading: isLoadingChannels } = useUmblerChannels();

  const createMutation = useCreateAutomation();
  const updateMutation = useUpdateAutomation();
  const deleteMutation = useDeleteAutomation();

  const isLoading = isLoadingAutomations || isLoadingChannels;

  // Logs de automação (paginados)
  const [logsPage, setLogsPage] = useState(1);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const pageSize = 20;
  const { data: logsData, isLoading: isLoadingLogs } = useMessageJobsLogs({
    automationId: selectedAutomationId || undefined,
    page: logsPage,
    pageSize,
  });
  const { data: clientsMap = {}, isLoading: isLoadingClientsMap } = useClientsMap();

  // Estatísticas das automações
  const stats = useMemo(() => {
    const activeCount = automations.filter(a => a.enabled).length;
    const totalCount = automations.length;
    return { activeCount, totalCount, inactiveCount: totalCount - activeCount };
  }, [automations]);

  const handleCreateAutomation = (data: AutomationFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => setIsCreateDialogOpen(false),
    });
  };

  const handleUpdateAutomation = (data: AutomationFormData) => {
    if (!editingAutomation) return;
    updateMutation.mutate(
      { id: editingAutomation.id, data },
      {
        onSuccess: () => setEditingAutomation(null),
      }
    );
  };

  const handleToggleEnabled = (automation: MessageAutomationSetting) => {
    updateMutation.mutate({
      id: automation.id,
      data: { enabled: !automation.enabled },
    });
  };

  const handleDeleteAutomation = (id: string) => {
    deleteMutation.mutate(id);
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? `${channel.name} ${channel.phoneNumber ? `(${channel.phoneNumber})` : ''}` : 'Canal não encontrado';
  };

  const getDaysBeforeLabel = (days: number) => {
    const option = DAYS_BEFORE_OPTIONS.find(o => o.value === days);
    return option?.label || `${days} dias antes`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando automações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold">Automações de Mensagens</h1>
          <p className="text-muted-foreground">
            Gerencie automações para envio de mensagens de aniversário
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Automação</DialogTitle>
              <DialogDescription>
                Configure uma nova automação para envio de mensagens de aniversário.
              </DialogDescription>
            </DialogHeader>
            <AutomationForm
              channels={channels}
              onSubmit={handleCreateAutomation}
              onCancel={() => setIsCreateDialogOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Automações</CardTitle>
            <div className="p-2 bg-muted/50 rounded-full">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalCount === 1 ? 'automação configurada' : 'automações configuradas'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automações Ativas</CardTitle>
            <div className="p-2 bg-green-100 rounded-full">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              enviando mensagens automaticamente
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automações Inativas</CardTitle>
            <div className="p-2 bg-muted/50 rounded-full">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.inactiveCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              pausadas ou desabilitadas
            </p>
          </CardContent>
        </Card>
      </div>

  {/* Lista de automações */}
  <Card>
        <CardHeader>
          <CardTitle>Automações Configuradas</CardTitle>
          <CardDescription>
            {automations.length === 0
              ? "Nenhuma automação configurada ainda."
              : `${automations.length} automação${automations.length > 1 ? 'ões' : ''} configurada${automations.length > 1 ? 's' : ''}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhuma automação configurada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie sua primeira automação para começar a enviar mensagens de aniversário automaticamente.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Automação
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {automations.map((automation, index) => (
                <Card key={automation.id} className="relative hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <Badge variant={automation.enabled ? "default" : "secondary"} className="w-fit">
                            {automation.enabled ? "Ativa" : "Inativa"}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {automation.sendTime} • {getDaysBeforeLabel(automation.daysBefore)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">Canal:</span>{' '}
                            <span className="text-muted-foreground break-all">
                              {getChannelName(automation.externalChannelId || '')}
                            </span>
                          </div>

                          {automation.template && (
                            <div className="text-sm">
                              <span className="font-medium">Modelo:</span>
                              <div className="mt-1 p-3 bg-muted/50 rounded-md text-xs max-h-20 overflow-y-auto border">
                                {automation.template.substring(0, 200)}
                                {automation.template.length > 200 && "..."}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 lg:flex-col lg:gap-3 shrink-0">
                        <div className="flex items-center gap-2 lg:order-2">
                          <Switch
                            checked={automation.enabled}
                            onCheckedChange={() => handleToggleEnabled(automation)}
                            disabled={updateMutation.isPending}
                          />
                          <span className="text-xs text-muted-foreground lg:hidden">
                            {automation.enabled ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 lg:order-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingAutomation(automation)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Automação</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover esta automação? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAutomation(automation.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs/resultados das automações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Resultados das Automações
          </CardTitle>
          <CardDescription>
            Veja o histórico de mensagens disparadas pelas automações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAutomations ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando filtros...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <Label htmlFor="automation-filter" className="text-sm font-medium shrink-0">
              Filtrar por automação:
            </Label>
            <Select
              value={selectedAutomationId || "all"}
              onValueChange={(value) => {
                setSelectedAutomationId(value === "all" ? null : value);
                setLogsPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[300px]">
                <SelectValue placeholder="Todas as automações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as automações</SelectItem>
                {isLoadingAutomations ? (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Carregando automações...</span>
                    </div>
                  </SelectItem>
                ) : automations.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Nenhuma automação disponível
                  </SelectItem>
                ) : (
                  automations.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{getChannelName(a.externalChannelId || "")}</span>
                        <span className="text-xs text-muted-foreground">
                          {getDaysBeforeLabel(a.daysBefore)} às {a.sendTime}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {isLoadingLogs || isLoadingClientsMap ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando resultados...</p>
            </div>
          ) : !logsData || logsData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum resultado encontrado</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {selectedAutomationId 
                  ? "Esta automação ainda não enviou mensagens ou não há logs para exibir."
                  : "Ainda não há mensagens enviadas pelas automações."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-4 py-3 text-left font-medium">Cliente</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-center font-medium">Tentativas</th>
                        <th className="px-4 py-3 text-left font-medium">Agendado para</th>
                        <th className="px-4 py-3 text-left font-medium">Enviado em</th>
                        <th className="px-4 py-3 text-left font-medium">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsData.data.map(log => (
                        <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {clientsMap[log.clientId] || log.clientId}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={
                              log.status === "enviado" ? "default" : 
                              log.status === "falhou" ? "destructive" : "secondary"
                            } className="text-xs">
                              {log.status === "enviado" ? "Enviado" : 
                               log.status === "falhou" ? "Falhou" : "Agendado"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs">
                              {log.attempts}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {log.scheduledSendAt ? new Date(log.scheduledSendAt).toLocaleString('pt-BR') : "-"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {log.actualSendAt ? new Date(log.actualSendAt).toLocaleString('pt-BR') : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {log.lastError ? (
                              <div className="max-w-xs">
                                <p className="text-xs text-destructive truncate" title={log.lastError}>
                                  {log.lastError}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {logsData.data.map(log => (
                  <Card key={log.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">
                            {clientsMap[log.clientId] || log.clientId}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cliente ID: {log.clientId.slice(-8)}
                          </p>
                        </div>
                        <Badge variant={
                          log.status === "enviado" ? "default" : 
                          log.status === "falhou" ? "destructive" : "secondary"
                        } className="text-xs ml-2">
                          {log.status === "enviado" ? "Enviado" : 
                           log.status === "falhou" ? "Falhou" : "Agendado"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Tentativas:</span>
                          <span className="ml-1 font-medium">{log.attempts}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Agendado:</span>
                          <div className="text-xs mt-1">
                            {log.scheduledSendAt ? new Date(log.scheduledSendAt).toLocaleString('pt-BR') : "-"}
                          </div>
                        </div>
                      </div>

                      {log.actualSendAt && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Enviado em:</span>
                          <div className="mt-1">
                            {new Date(log.actualSendAt).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      )}

                      {log.lastError && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Erro:</span>
                          <p className="text-destructive mt-1 leading-relaxed">
                            {log.lastError}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              {/* Paginação */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground text-center sm:text-left">
                  Mostrando página {logsData.page} de {Math.ceil(logsData.total / logsData.pageSize)}
                  <span className="hidden sm:inline"> • {logsData.total} registro{logsData.total !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                    disabled={logsData.page === 1}
                    className="px-3"
                  >
                    <span className="hidden sm:inline">Anterior</span>
                    <span className="sm:hidden">‹</span>
                  </Button>

                  <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: Math.min(5, Math.ceil(logsData.total / logsData.pageSize)) }, (_, i) => {
                      const totalPages = Math.ceil(logsData.total / logsData.pageSize);
                      let pageNumber;

                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else {
                        const current = logsData.page;
                        if (current <= 3) {
                          pageNumber = i + 1;
                        } else if (current >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = current - 2 + i;
                        }
                      }

                      return (
                        <Button
                          key={pageNumber}
                          variant={logsData.page === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogsPage(pageNumber)}
                          className="w-8 h-8 p-0 text-xs"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage(p => p + 1)}
                    disabled={logsData.page >= Math.ceil(logsData.total / logsData.pageSize)}
                    className="px-3"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <span className="sm:hidden">›</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={!!editingAutomation} onOpenChange={() => setEditingAutomation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Automação</DialogTitle>
            <DialogDescription>
              Faça as alterações necessárias na automação de mensagens.
            </DialogDescription>
          </DialogHeader>
          {editingAutomation && (
            <AutomationForm
              automation={editingAutomation}
              channels={channels}
              onSubmit={handleUpdateAutomation}
              onCancel={() => setEditingAutomation(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}