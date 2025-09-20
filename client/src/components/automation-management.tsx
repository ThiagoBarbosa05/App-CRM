import { useState, useMemo } from "react";
import { useMessageJobsLogs } from "../hooks/useMessageJobsLogs";
import { useFileUpload, useFileDelete } from "../hooks/useFileManagement";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  Settings,
  Clock,
  Users,
  MessageSquare,
  Upload,
  X,
  Image,
  Play,
  TestTube,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

// Hook para testar automação manualmente - Teste completo
function useTestAutomationAll() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/birthday-automation/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Falha ao testar automação completa"
        );
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Teste completo executado",
        description: `Automação completa testada com sucesso. ${
          data.message || ""
        }`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro no teste completo",
        description:
          error.message ||
          "Não foi possível executar o teste da automação completa.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });
}

// Hook para testar automação manualmente - Teste agendado
function useTestAutomationScheduled() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(
        "/api/birthday-automation/trigger-scheduled",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Falha ao testar automação agendada"
        );
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "⏰ Teste agendado executado",
        description: `Automação agendada testada com sucesso. ${
          data.message || ""
        }`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro no teste agendado",
        description:
          error.message ||
          "Não foi possível executar o teste da automação agendada.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });
}

interface MessageAutomationSetting {
  id: string;
  enabled: boolean;
  sendTime: string;
  daysBefore: number;
  externalTemplateId?: string;
  externalChannelId?: string;
  externalFileId?: string;
  externalFileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface UmblerChannel {
  id: string;
  name: string;
  phoneNumber?: string;
  channelType: string;
  state: string;
}

interface UmblerTemplate {
  _t: string;
  id: string;
  createdAtUTC: string;
  channel: {
    _t: string;
    id: string;
  };
  label: string;
  category: string;
  status: string;
  header: {
    content: string;
    variables: Array<{
      name: string;
      example: string;
    }>;
  };
  content: string;
  footer: string;
  buttons: Array<any>;
  variables: Array<{
    name: string;
    example: string;
  }>;
  templateType: string;
  approvedAtUTC: string;
  rejectErrorReason?: string;
  groupIds: string[];
  carousel: Array<any>;
}

interface AutomationFormData {
  enabled: boolean;
  sendTime: string;
  daysBefore: number;
  externalTemplateId: string;
  externalChannelId: string;
  externalFileId?: string;
  externalFileUrl?: string;
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
  { value: 5, label: "5 dias antes" },
  { value: 10, label: "10 dias antes" },
  { value: 15, label: "15 dias antes" },
];

// const DEFAULT_TEMPLATE = `🎉 Parabéns pelo seu aniversário!

// Que este novo ano de vida seja repleto de alegrias, conquistas e momentos especiais!

// Em comemoração à sua data especial, preparamos uma surpresa para você.

// Feliz aniversário! 🎂✨`;

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
      const response = await fetch("/api/umbler/whatsapp-api/channels");
      if (!response.ok) throw new Error("Failed to fetch channels");
      return response.json();
    },
  });
}

// Hook para buscar templates Umbler aprovados
function useUmblerTemplates() {
  return useQuery<UmblerTemplate[]>({
    queryKey: ["umbler-templates"],
    queryFn: async () => {
      const response = await fetch("/api/templates?approved=true");
      if (!response.ok) throw new Error("Failed to fetch templates");
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
      queryClient.invalidateQueries({
        queryKey: ["message-automation-settings"],
      });
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
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AutomationFormData>;
    }) => {
      const response = await fetch(`/api/message-automation-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update automation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["message-automation-settings"],
      });
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
  const fileDeleteMutation = useFileDelete();

  return useMutation({
    mutationFn: async (automation: MessageAutomationSetting) => {
      // Primeiro, deletar o arquivo se existir
      if (automation.externalFileId) {
        try {
          await fileDeleteMutation.mutateAsync(automation.externalFileId);
        } catch (error) {
          console.warn("Falha ao deletar arquivo associado:", error);
          // Continuar com a deleção da automação mesmo se o arquivo falhar
        }
      }

      // Deletar a automação
      const response = await fetch(
        `/api/message-automation-settings/${automation.id}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to delete automation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["message-automation-settings"],
      });
      toast({
        title: "Automação removida",
        description:
          "A automação e seus arquivos associados foram removidos com sucesso.",
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

// Componente de upload de arquivo com preview
function FileUploadComponent({
  currentFileId,
  currentFileUrl,
  onFileUpload,
  onFileRemove,
  isUploading,
}: {
  currentFileId?: string;
  currentFileUrl?: string;
  onFileUpload: (fileId: string, fileUrl: string) => void;
  onFileRemove: () => void;
  isUploading?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentFileUrl || null
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const fileUploadMutation = useFileUpload();
  const fileDeleteMutation = useFileDelete();

  const handleFileSelect = async (file: File) => {
    console.log('Arquivo selecionado:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    // Validar se o arquivo tem extensão de imagem se o tipo MIME não for detectado
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    // Validar tipo de arquivo - aceitar se tipo MIME for image/* ou se extensão for de imagem
    if (!file.type.startsWith("image/") && !hasImageExtension) {
      console.error('Tipo de arquivo rejeitado:', file.type, 'Nome:', file.name);
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione apenas arquivos de imagem (PNG, JPG, GIF, WebP, SVG).",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (50MB máximo)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB.",
        variant: "destructive",
      });
      return;
    }

    // Criar preview local
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);

    // Fazer upload com nome do arquivo explícito
    try {
      console.log('Iniciando upload do arquivo:', file.name);
      await fileUploadMutation.mutateAsync(
        { 
          file,
          filename: file.name
        },
        {
          onSuccess: (response) => {
            console.log('Upload bem-sucedido:', response);
            if (response.success && response.data) {
              onFileUpload(response.data.id, response.data.url);
              // Limpar preview local e usar URL da resposta
              URL.revokeObjectURL(localPreviewUrl);
              setPreviewUrl(response.data.url);
            }
          },
          onError: (error: any) => {
            console.error('Erro no upload:', error);
            // Limpar preview em caso de erro
            URL.revokeObjectURL(localPreviewUrl);
            setPreviewUrl(currentFileUrl || null);
          },
        }
      );
    } catch (error) {
      // Error já tratado no onError do mutation
      console.error("Erro no upload (catch):", error);
    }
  };

  const handleFileRemove = async () => {
    if (currentFileId) {
      // Deletar arquivo do servidor
      await fileDeleteMutation.mutateAsync(currentFileId, {
        onSuccess: () => {
          onFileRemove();
          setPreviewUrl(null);
        },
      });
    } else {
      // Apenas remover preview local
      onFileRemove();
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Arquivo de mídia</Label>

      {previewUrl ? (
        // Preview da imagem
        <div className="relative">
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-lg border"
                  onError={() => {
                    // Se a imagem falhar ao carregar, mostrar placeholder
                    setPreviewUrl(null);
                  }}
                />
                {(fileUploadMutation.isPending || isUploading) && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Arquivo selecionado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentFileUrl
                    ? "Arquivo já enviado"
                    : "Upload em andamento..."}
                </p>
                {currentFileId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: {currentFileId}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleFileRemove}
                disabled={
                  fileDeleteMutation.isPending || fileUploadMutation.isPending
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Área de upload
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Arraste uma imagem aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, GIF, WebP • Máximo: 50MB
              </p>
            </div>

            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={fileUploadMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                disabled={fileUploadMutation.isPending}
                className="pointer-events-none"
              >
                <Image className="h-4 w-4 mr-2" />
                Selecionar arquivo
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        O arquivo será enviado junto com as mensagens de aniversário
        automaticamente.
      </p>
    </div>
  );
}

// Componente de formulário para automação
function AutomationForm({
  automation,
  channels,
  templates,
  onSubmit,
  onCancel,
  isLoading,
}: {
  automation?: MessageAutomationSetting;
  channels: UmblerChannel[];
  templates: UmblerTemplate[];
  onSubmit: (data: AutomationFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<AutomationFormData>({
    enabled: automation?.enabled ?? true,
    sendTime: automation?.sendTime ?? "09:00",
    daysBefore: automation?.daysBefore ?? 0,
    externalTemplateId: automation?.externalTemplateId ?? "",
    externalChannelId: automation?.externalChannelId ?? "",
    externalFileId: automation?.externalFileId ?? "",
    externalFileUrl: automation?.externalFileUrl ?? "",
  });

  // Rastrear arquivo carregado durante esta sessão (para limpeza em caso de cancelamento)
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const fileDeleteMutation = useFileDelete();

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

    if (!formData.externalTemplateId) {
      toast({
        title: "Template obrigatório",
        description: "Selecione um template para as mensagens.",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);
  };

  const handleCancel = async () => {
    // Se um arquivo foi carregado durante esta sessão e não é o arquivo original, deletá-lo
    if (uploadedFileId && uploadedFileId !== automation?.externalFileId) {
      try {
        await fileDeleteMutation.mutateAsync(uploadedFileId);
      } catch (error) {
        console.error("Erro ao limpar arquivo:", error);
      }
    }
    onCancel();
  };

  const handleFileUpload = (fileId: string, fileUrl: string) => {
    setFormData({
      ...formData,
      externalFileId: fileId,
      externalFileUrl: fileUrl,
    });
    setUploadedFileId(fileId);
  };

  const handleFileRemove = () => {
    setFormData({
      ...formData,
      externalFileId: "",
      externalFileUrl: "",
    });
    // Reset uploaded file tracker
    setUploadedFileId(null);
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
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                  >
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
              onValueChange={(sendTime) =>
                setFormData({ ...formData, sendTime })
              }
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
              {channels
                .filter(
                  (channel) =>
                    channel.channelType === "WhatsappApi" &&
                    channel.state === "Live"
                )
                .map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}{" "}
                    {channel.phoneNumber && `(${channel.phoneNumber})`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="externalTemplateId">Template de Mensagem</Label>
          <Select
            value={formData.externalTemplateId}
            onValueChange={(externalTemplateId) =>
              setFormData({ ...formData, externalTemplateId })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhum template aprovado disponível
                </SelectItem>
              ) : (
                templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.category} • {template.templateType}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Template de mensagem que será usado para enviar as mensagens
            automáticas de aniversário.
          </p>
        </div>

        {/* <div className="space-y-2">
          <Label htmlFor="externalTemplateId">ID do Template Externo</Label>
          <Input
            id="externalTemplateId"
            placeholder="Digite o ID do template da API do Umbler..."
            value={formData.externalTemplateId}
            onChange={(e) =>
              setFormData({ ...formData, externalTemplateId: e.target.value })
            }
          />
          <p className="text-sm text-muted-foreground">
            Esta mensagem será enviada automaticamente para os clientes
            aniversariantes.
          </p>
        </div> */}

        <FileUploadComponent
          currentFileId={formData.externalFileId}
          currentFileUrl={formData.externalFileUrl}
          onFileUpload={handleFileUpload}
          onFileRemove={handleFileRemove}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={handleCancel}>
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
  const [editingAutomation, setEditingAutomation] =
    useState<MessageAutomationSetting | null>(null);

  const { data: automations = [], isLoading: isLoadingAutomations } =
    useMessageAutomations();
  const { data: channels = [], isLoading: isLoadingChannels } =
    useUmblerChannels();
  const { data: templates = [], isLoading: isLoadingTemplates } =
    useUmblerTemplates();

  const createMutation = useCreateAutomation();
  const updateMutation = useUpdateAutomation();
  const deleteMutation = useDeleteAutomation();
  const testAllMutation = useTestAutomationAll();
  const testScheduledMutation = useTestAutomationScheduled();

  const isLoading =
    isLoadingAutomations || isLoadingChannels || isLoadingTemplates;

  // Logs de automação (paginados)
  const [logsPage, setLogsPage] = useState(1);
  const [selectedAutomationId, setSelectedAutomationId] = useState<
    string | null
  >(null);
  const pageSize = 20;
  const {
    data: logsData,
    isLoading: isLoadingLogs,

    isFetching: isFetchingLogs,
    refetch: refetchLogs,
  } = useMessageJobsLogs({
    automationId: selectedAutomationId || undefined,
    page: logsPage,
    pageSize,
  });

  // Estatísticas das automações
  const stats = useMemo(() => {
    const activeCount = automations.filter((a) => a.enabled).length;
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

  const handleDeleteAutomation = (automation: MessageAutomationSetting) => {
    deleteMutation.mutate(automation);
  };

  const handleTestAllAutomation = () => {
    testAllMutation.mutate();
  };

  const handleTestScheduledAutomation = () => {
    testScheduledMutation.mutate();
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    return channel
      ? `${channel.name} ${
          channel.phoneNumber ? `(${channel.phoneNumber})` : ""
        }`
      : "Canal não encontrado";
  };

  const getTemplateName = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    return template
      ? `${template.label} (${template.category})`
      : "Template não encontrado";
  };

  const getDaysBeforeLabel = (days: number) => {
    const option = DAYS_BEFORE_OPTIONS.find((o) => o.value === days);
    return option?.label || `${days} dias antes`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">
            Carregando automações...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold">
            Automações de Mensagens
          </h1>
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
                Configure uma nova automação para envio de mensagens de
                aniversário.
              </DialogDescription>
            </DialogHeader>
            <AutomationForm
              channels={channels}
              templates={templates}
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
            <CardTitle className="text-sm font-medium">
              Total de Automações
            </CardTitle>
            <div className="p-2 bg-muted/50 rounded-full">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalCount === 1
                ? "automação configurada"
                : "automações configuradas"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Automações Ativas
            </CardTitle>
            <div className="p-2 bg-green-100 rounded-full">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.activeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              enviando mensagens automaticamente
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Automações Inativas
            </CardTitle>
            <div className="p-2 bg-muted/50 rounded-full">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {stats.inactiveCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              pausadas ou desabilitadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Testes - Design Aprimorado */}
      <Card className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all duration-300 bg-gradient-to-br from-background via-primary/5 to-background relative overflow-hidden">
        {/* Background decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none" />

        <CardHeader className="relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg">
                <TestTube className="h-6 w-6" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-sm" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl ">Testar Automações</CardTitle>
              <CardDescription className="text-base mt-1">
                Execute testes manuais para verificar o funcionamento das
                automações em tempo real
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-6">
          {/* Grid de Testes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Teste Completo */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-br from-background to-blue-50/50 border border-blue-200/60 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-blue-300/80">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                      <Play className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg text-blue-900">
                        Teste Completo
                      </h4>
                      <p className="text-sm text-blue-700">Execução global</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Executa{" "}
                    <span className="font-medium text-blue-600">
                      todas as automações ativas
                    </span>{" "}
                    para verificar o funcionamento geral. Ideal para validar
                    configurações após mudanças.
                  </p>

                  <div className="pt-2">
                    <Button
                      onClick={handleTestAllAutomation}
                      disabled={
                        testAllMutation.isPending || stats.activeCount === 0
                      }
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed h-11"
                      size="lg"
                    >
                      {testAllMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                          Executando teste...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-3" />
                          Executar Teste Completo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Teste Agendado */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-br from-background to-green-50/50 border border-green-200/60 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-green-300/80">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg text-green-900">
                        Teste Agendado
                      </h4>
                      <p className="text-sm text-green-700">
                        Simulação temporal
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Executa apenas automações que{" "}
                    <span className="font-medium text-green-600">
                      correspondem ao horário atual
                    </span>
                    . Simula o comportamento da execução programada.
                  </p>

                  <div className="pt-2">
                    <Button
                      onClick={handleTestScheduledAutomation}
                      disabled={
                        testScheduledMutation.isPending ||
                        stats.activeCount === 0
                      }
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed h-11"
                      size="lg"
                    >
                      {testScheduledMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                          Executando teste...
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 mr-3" />
                          Executar Teste Agendado
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status e Alertas */}
          <div className="space-y-4">
            {/* Alerta quando não há automações ativas */}
            {stats.activeCount === 0 && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl blur-lg" />
                <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-md flex-shrink-0">
                      <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-amber-900">
                          Nenhuma automação ativa
                        </h5>
                        <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                      </div>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        Para testar as automações, você precisa ter pelo menos
                        uma automação ativa.
                        <br />
                        <span className="font-medium">
                          Crie uma nova automação ou ative uma existente
                        </span>{" "}
                        para habilitar os testes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dica informativa */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl blur-lg" />
              <div className="relative bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/60 rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-blue-900">
                        💡 Dica sobre os testes
                      </h5>
                    </div>
                    <div className="text-sm text-blue-800 leading-relaxed space-y-1">
                      <p>
                        • Os testes verificam apenas{" "}
                        <span className="font-medium">
                          clientes com aniversário hoje
                        </span>
                      </p>
                      <p>
                        • Resultados aparecem na seção{" "}
                        <span className="font-medium">
                          "Resultados das Automações"
                        </span>{" "}
                        abaixo
                      </p>
                      <p>
                        • Use o{" "}
                        <span className="font-medium text-blue-600">
                          Teste Agendado
                        </span>{" "}
                        para simular execução em horário específico
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicador de status das automações ativas */}
            {stats.activeCount > 0 && (
              <div className="flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/60 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-800">
                    {stats.activeCount} automação
                    {stats.activeCount > 1 ? "ões" : ""} ativa
                    {stats.activeCount > 1 ? "s" : ""} pronta
                    {stats.activeCount > 1 ? "s" : ""} para teste
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de automações */}
      <Card>
        <CardHeader>
          <CardTitle>Automações Configuradas</CardTitle>
          <CardDescription>
            {automations.length === 0
              ? "Nenhuma automação configurada ainda."
              : `${automations.length} automação${
                  automations.length > 1 ? "ões" : ""
                } configurada${automations.length > 1 ? "s" : ""}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">
                Nenhuma automação configurada
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie sua primeira automação para começar a enviar mensagens de
                aniversário automaticamente.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Automação
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {automations.map((automation, index) => (
                <Card
                  key={automation.id}
                  className="relative hover:shadow-lg transition-all duration-200 hover:border-primary/30 bg-gradient-to-r from-background to-muted/20"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                      <div className="space-y-4 flex-1 min-w-0">
                        {/* Header com status e horário */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-muted/30">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                automation.enabled ? "default" : "secondary"
                              }
                              className={`px-3 py-1 font-medium ${
                                automation.enabled
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : "bg-gray-100 text-gray-600 border-gray-200"
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full mr-2 ${
                                  automation.enabled
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              />
                              {automation.enabled ? "Ativa" : "Inativa"}
                            </Badge>
                            <div className="text-sm text-muted-foreground">
                              Automação #{index + 1}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                              {automation.sendTime}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {getDaysBeforeLabel(automation.daysBefore)}
                            </span>
                          </div>
                        </div>

                        {/* Informações principais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Canal */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium text-muted-foreground">
                                Canal de envio
                              </span>
                            </div>
                            <div className="pl-6">
                              <p className="text-sm font-medium break-all">
                                {getChannelName(
                                  automation.externalChannelId || ""
                                )}
                              </p>
                            </div>
                          </div>

                          {automation.externalTemplateId && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-primary/10 rounded flex items-center justify-center">
                                  <span className="text-xs text-primary font-bold">
                                    T
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">
                                  Template
                                </span>
                              </div>
                              <div className="pl-6">
                                <p className="text-sm font-medium break-all">
                                  {getTemplateName(
                                    automation.externalTemplateId
                                  )}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Arquivo de mídia */}
                          {automation.externalFileUrl && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Image className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-muted-foreground">
                                  Arquivo de mídia
                                </span>
                              </div>
                              <div className="pl-6">
                                <div className="flex items-start gap-3">
                                  <div className="relative group">
                                    <img
                                      src={automation.externalFileUrl}
                                      alt="Mídia da automação"
                                      className="w-16 h-16 object-cover rounded-lg border-2 border-muted hover:border-primary/50 transition-colors shadow-sm"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors" />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <p className="text-xs text-green-600 font-medium">
                                      ✓ Arquivo configurado
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Será enviado com a mensagem
                                    </p>
                                    {automation.externalFileId && (
                                      <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                                        {automation.externalFileId}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Modelo da mensagem */}
                        {/* {automation.externalTemplateId && (
                          <div className="space-y-2 mt-4 pt-4 border-t border-muted/30">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-primary/10 rounded flex items-center justify-center">
                                <span className="text-xs text-primary font-bold">
                                  T
                                </span>
                              </div>
                              <span className="text-sm font-medium text-muted-foreground">
                                ID do Template
                              </span>
                            </div>
                            <div className="pl-6">
                              <div className="bg-muted/30 border border-muted/50 rounded-lg p-4 max-h-24 overflow-y-auto">
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                  {automation.externalTemplateId}
                                </p>
                              </div>
                            </div>
                          </div>
                        )} */}
                      </div>

                      {/* Controles laterais */}
                      <div className="flex flex-row lg:flex-col items-center gap-4 lg:gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-muted/30 lg:pl-6">
                        {/* Switch de ativação */}
                        <div className="flex flex-col items-center gap-2 order-2 lg:order-1">
                          <Switch
                            checked={automation.enabled}
                            onCheckedChange={() =>
                              handleToggleEnabled(automation)
                            }
                            disabled={updateMutation.isPending}
                            className="data-[state=checked]:bg-green-500"
                          />
                          <span className="text-xs text-muted-foreground text-center">
                            {automation.enabled ? "ativado" : "desativado"}
                          </span>
                        </div>

                        {/* Botões de ação */}
                        <div className="flex items-center gap-2 order-1 lg:order-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAutomation(automation)}
                            className="h-9 w-9 p-0 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                            title="Editar automação"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                                title="Remover automação"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remover Automação
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover esta automação?
                                  Esta ação não pode ser desfeita e todos os
                                  arquivos associados serão deletados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteAutomation(automation)
                                  }
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
          <CardTitle className="flex items- justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Resultados das Automações
            </div>

            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RefreshCcw
                className={cn(
                  "h-4 w-4",

                  isFetchingLogs && "animate-spin"
                )}
              />
              {isFetchingLogs ? "Atualizando..." : "Atualizar"}
            </Button>
          </CardTitle>
          <CardDescription>
            Veja o histórico de mensagens disparadas pelas automações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAutomations ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">
                Carregando filtros...
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <Label
                  htmlFor="automation-filter"
                  className="text-sm font-medium shrink-0"
                >
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
                      automations.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">
                              {getChannelName(a.externalChannelId || "")}
                            </span>
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
              {isLoadingLogs ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Carregando resultados...
                  </p>
                </div>
              ) : !logsData || logsData.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Nenhum resultado encontrado
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    {selectedAutomationId
                      ? "Esta automação ainda não enviou mensagens ou não há logs para exibir."
                      : "Ainda não há mensagens enviadas pelas automações."}
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
                            <th className="px-4 py-3 text-left font-medium">
                              Cliente
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Status
                            </th>
                            <th className="px-4 py-3 text-center font-medium">
                              Tentativas
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Agendado para
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Enviado em
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Erro
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {logsData.data.map((log) => (
                            <tr
                              key={log.id}
                              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium">
                                {log.client?.name || log.clientId}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    log.status === "enviado"
                                      ? "default"
                                      : log.status === "falhou"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {log.status === "enviado"
                                    ? "Enviado"
                                    : log.status === "falhou"
                                    ? "Falhou"
                                    : "Agendado"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs">
                                  {log.attempts}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {log.scheduledSendAt
                                  ? new Date(
                                      log.scheduledSendAt
                                    ).toLocaleString("pt-BR")
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {log.actualSendAt
                                  ? new Date(log.actualSendAt).toLocaleString(
                                      "pt-BR"
                                    )
                                  : "-"}
                              </td>
                              <td className="px-4 py-3">
                                {log.lastError ? (
                                  <div className="max-w-xs">
                                    <p
                                      className="text-xs text-destructive truncate"
                                      title={log.lastError}
                                    >
                                      {log.lastError}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    -
                                  </span>
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
                    {logsData.data.map((log) => (
                      <Card key={log.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">
                                {log.client?.name || log.clientId}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                Cliente ID: {log.clientId.slice(-8)}
                              </p>
                            </div>
                            <Badge
                              variant={
                                log.status === "enviado"
                                  ? "default"
                                  : log.status === "falhou"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-xs ml-2"
                            >
                              {log.status === "enviado"
                                ? "Enviado"
                                : log.status === "falhou"
                                ? "Falhou"
                                : "Agendado"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">
                                Tentativas:
                              </span>
                              <span className="ml-1 font-medium">
                                {log.attempts}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Agendado:
                              </span>
                              <div className="text-xs mt-1">
                                {log.scheduledSendAt
                                  ? new Date(
                                      log.scheduledSendAt
                                    ).toLocaleString("pt-BR")
                                  : "-"}
                              </div>
                            </div>
                          </div>

                          {log.actualSendAt && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">
                                Enviado em:
                              </span>
                              <div className="mt-1">
                                {new Date(log.actualSendAt).toLocaleString(
                                  "pt-BR"
                                )}
                              </div>
                            </div>
                          )}

                          {log.lastError && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">
                                Erro:
                              </span>
                              <p className="text-destructive mt-1 leading-relaxed">
                                {log.lastError}
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Visualização das automações com mídia - versão mobile otimizada */}
                  <div className="lg:hidden space-y-4 mt-8">
                    {automations.filter(
                      (automation) => automation.externalFileUrl
                    ).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-muted/30">
                          <Image className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-base">
                            Automações com Mídia
                          </h4>
                          <Badge variant="secondary" className="ml-auto">
                            {
                              automations.filter(
                                (automation) => automation.externalFileUrl
                              ).length
                            }
                          </Badge>
                        </div>
                        {automations
                          .filter((automation) => automation.externalFileUrl)
                          .map((automation, index) => (
                            <Card
                              key={`mobile-media-${automation.id}`}
                              className="overflow-hidden border-l-4 border-l-primary/50 hover:border-l-primary transition-colors"
                            >
                              <CardContent className="p-4">
                                <div className="space-y-4">
                                  {/* Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge
                                          variant={
                                            automation.enabled
                                              ? "default"
                                              : "secondary"
                                          }
                                          className={`text-xs ${
                                            automation.enabled
                                              ? "bg-green-100 text-green-800"
                                              : "bg-gray-100 text-gray-600"
                                          }`}
                                        >
                                          {automation.enabled
                                            ? "Ativa"
                                            : "Inativa"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          Automação #{index + 1}
                                        </span>
                                      </div>
                                      <h5 className="font-medium text-sm truncate">
                                        {getChannelName(
                                          automation.externalChannelId || ""
                                        )}
                                      </h5>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{automation.sendTime}</span>
                                        <span>•</span>
                                        <span>
                                          {getDaysBeforeLabel(
                                            automation.daysBefore
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Mídia */}
                                  <div className="bg-muted/30 rounded-lg p-3">
                                    <div className="flex items-start gap-3">
                                      <div className="relative group">
                                        <img
                                          src={automation.externalFileUrl}
                                          alt="Mídia da automação"
                                          className="w-20 h-20 object-cover rounded-lg border-2 border-muted group-hover:border-primary/50 transition-all shadow-sm"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors" />
                                      </div>
                                      <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                                          <span className="text-xs font-medium text-green-600">
                                            Arquivo configurado
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                          Este arquivo será enviado
                                          automaticamente junto com a mensagem
                                          de aniversário para os clientes.
                                        </p>
                                        {automation.externalFileId && (
                                          <div className="bg-background rounded border px-2 py-1">
                                            <p className="text-xs text-muted-foreground font-mono break-all">
                                              ID: {automation.externalFileId}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    )}
                  </div>
                  {/* Paginação */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                      Mostrando página {logsData.page} de{" "}
                      {Math.ceil(logsData.total / logsData.pageSize)}
                      <span className="hidden sm:inline">
                        {" "}
                        • {logsData.total} registro
                        {logsData.total !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                        disabled={logsData.page === 1}
                        className="px-3"
                      >
                        <span className="hidden sm:inline">Anterior</span>
                        <span className="sm:hidden">‹</span>
                      </Button>

                      <div className="flex items-center gap-1 mx-2">
                        {Array.from(
                          {
                            length: Math.min(
                              5,
                              Math.ceil(logsData.total / logsData.pageSize)
                            ),
                          },
                          (_, i) => {
                            const totalPages = Math.ceil(
                              logsData.total / logsData.pageSize
                            );
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
                                variant={
                                  logsData.page === pageNumber
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => setLogsPage(pageNumber)}
                                className="w-8 h-8 p-0 text-xs"
                              >
                                {pageNumber}
                              </Button>
                            );
                          }
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPage((p) => p + 1)}
                        disabled={
                          logsData.page >=
                          Math.ceil(logsData.total / logsData.pageSize)
                        }
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
      <Dialog
        open={!!editingAutomation}
        onOpenChange={() => setEditingAutomation(null)}
      >
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
              templates={templates}
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
