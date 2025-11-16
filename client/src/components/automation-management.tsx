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
  RotateCcw,
  Bot,
  Calendar,
  Zap,
  Activity,
  Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

// Hook para executar trigger principal (automações do dia)
function useTestAutomationAll() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automations/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Falha ao executar automações do dia"
        );
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Automações executadas",
        description: `${data.data.executed} de ${data.data.totalAutomations} automações executadas. ${data.data.messagesSent} mensagens enviadas.`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro ao executar automações",
        description:
          error.message || "Não foi possível executar as automações.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });
}

// Hook para executar catch-up (recuperar automações perdidas)
function useTestAutomationScheduled() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automations/catchup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Falha ao executar catch-up");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "⏰ Catch-up concluído",
        description: `${data.data.executed} automações recuperadas. ${data.data.messagesSent} mensagens enviadas.`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro no catch-up",
        description:
          error.message ||
          "Não foi possível executar o catch-up das automações.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });
}

// Hook para verificar health check do sistema
function useAutomationHealth() {
  return useQuery({
    queryKey: ["automation-health"],
    queryFn: async () => {
      const response = await fetch("/api/automations/health");
      if (!response.ok) throw new Error("Failed to fetch health status");
      return response.json();
    },
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });
}

interface MessageAutomationSetting {
  id: string;
  enabled: boolean;
  sendTime: string;
  daysBefore: number;
  type: "template" | "bot";
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

interface UmblerBot {
  _t: string;
  triggers: string[];
  manualTriggers: string[];
  steps: any[];
  channels: any[];
  title: string;
  order: number;
  final: boolean;
  active: boolean;
  groupIds: any[];
  updatedAtUTC: string;
  executionsCount: number;
  executionsDateUTC: string;
  id: string;
  createdAtUTC: string;
}

interface AutomationFormData {
  enabled: boolean;
  sendTime: string;
  daysBefore: number;
  type: "template" | "bot";
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

// Hook para buscar bots de aniversário do dia
function useUmblerBotsToday() {
  return useQuery<UmblerBot[]>({
    queryKey: ["umbler-bots-today"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/birthday-bots-today");
      if (!response.ok) throw new Error("Failed to fetch bots");
      const data = await response.json();
      return data.items || [];
    },
  });
}

// Hook para buscar bots de aniversário dias antes
function useUmblerBotsDaysBefore() {
  return useQuery<UmblerBot[]>({
    queryKey: ["umbler-bots-days-before"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/birthday-bots-days-before");
      if (!response.ok) throw new Error("Failed to fetch bots");
      const data = await response.json();
      return data.items || [];
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

// Hook para executar automação específica manualmente
function useExecuteAutomation() {
  return useMutation({
    mutationFn: async (automationId: string) => {
      const response = await fetch(`/api/automations/${automationId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to execute automation");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Automação executada",
        description: "A automação foi executada manualmente com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao executar automação",
        description: error.message || "Não foi possível executar a automação.",
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
    console.log("Arquivo selecionado:", {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    });

    // Validar se o arquivo tem extensão de imagem se o tipo MIME não for detectado
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const hasImageExtension = imageExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    // Bloquear SVG explicitamente por questões de segurança
    if (
      file.type === "image/svg+xml" ||
      file.name.toLowerCase().endsWith(".svg")
    ) {
      console.error(
        "SVG rejeitado por questões de segurança:",
        file.type,
        "Nome:",
        file.name
      );
      toast({
        title: "Tipo de arquivo não permitido",
        description:
          "Arquivos SVG não são aceitos por questões de segurança. Use PNG, JPG, GIF ou WebP.",
        variant: "destructive",
      });
      return;
    }

    // Validar tipo de arquivo - aceitar se tipo MIME for image/* ou se extensão for de imagem
    if (!file.type.startsWith("image/") && !hasImageExtension) {
      console.error(
        "Tipo de arquivo rejeitado:",
        file.type,
        "Nome:",
        file.name
      );
      toast({
        title: "Tipo de arquivo inválido",
        description:
          "Por favor, selecione apenas arquivos de imagem (PNG, JPG, GIF, WebP).",
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
      console.log("Iniciando upload do arquivo:", file.name);
      const response = await fileUploadMutation.mutateAsync({
        file,
        filename: file.name,
      });

      console.log("Upload bem-sucedido:", response);
      if (response.success && response.data) {
        onFileUpload(response.data.id, response.data.url);
        // Limpar preview local e usar URL da resposta
        URL.revokeObjectURL(localPreviewUrl);
        setPreviewUrl(response.data.url);
      }
    } catch (error) {
      console.error("Erro no upload:", error);
      // Limpar preview em caso de erro
      URL.revokeObjectURL(localPreviewUrl);
      setPreviewUrl(currentFileUrl || null);
    }
  };

  const handleFileRemove = async () => {
    if (currentFileId) {
      // Deletar arquivo do servidor
      try {
        await fileDeleteMutation.mutateAsync(currentFileId);
        onFileRemove();
        setPreviewUrl(null);
      } catch (error) {
        console.error("Erro ao deletar arquivo:", error);
        // Toast de erro já é exibido pelo hook useFileDelete
      }
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
                accept=".jpg,.jpeg,.png,.gif,.webp"
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
  botsToday,
  botsDaysBefore,
  onSubmit,
  onCancel,
  isLoading,
}: {
  automation?: MessageAutomationSetting;
  channels: UmblerChannel[];
  templates: UmblerTemplate[];
  botsToday: UmblerBot[];
  botsDaysBefore: UmblerBot[];
  onSubmit: (data: AutomationFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<AutomationFormData>({
    enabled: automation?.enabled ?? true,
    sendTime: automation?.sendTime ?? "09:00",
    daysBefore: automation?.daysBefore ?? 0,
    type: automation?.type ?? "template",
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

    if (formData.type === "template" && !formData.externalTemplateId) {
      toast({
        title: "Template obrigatório",
        description: "Selecione um template para as mensagens.",
        variant: "destructive",
      });
      return;
    }

    if (formData.type === "bot" && !formData.externalTemplateId) {
      toast({
        title: "Bot obrigatório",
        description: "Selecione um bot para automação.",
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
          <Label htmlFor="type">Tipo de Automação</Label>
          <Select
            value={formData.type}
            onValueChange={(type: "template" | "bot") =>
              setFormData({ ...formData, type, externalTemplateId: "" })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="template">Template de Mensagem</SelectItem>
              <SelectItem value="bot">Bot de Automação</SelectItem>
            </SelectContent>
          </Select>
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

        {formData.type === "template" && (
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
        )}

        {formData.type === "bot" && (
          <div className="space-y-2">
            <Label htmlFor="externalTemplateId">Bot de Automação</Label>
            <Select
              value={formData.externalTemplateId}
              onValueChange={(externalTemplateId) =>
                setFormData({ ...formData, externalTemplateId })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um bot" />
              </SelectTrigger>
              <SelectContent>
                {formData.daysBefore === 0 ? (
                  // Bots para o dia do aniversário
                  botsToday.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Nenhum bot de aniversário disponível
                    </SelectItem>
                  ) : (
                    botsToday.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{bot.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Execuções: {bot.executionsCount}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )
                ) : // Bots para dias antes do aniversário
                botsDaysBefore.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Nenhum bot para dias antes disponível
                  </SelectItem>
                ) : (
                  botsDaysBefore.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{bot.title}</span>
                        <span className="text-xs text-muted-foreground">
                          Execuções: {bot.executionsCount}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Bot que será executado automaticamente para aniversários.
            </p>
          </div>
        )}

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

        {formData.type === "template" && (
          <FileUploadComponent
            currentFileId={formData.externalFileId}
            currentFileUrl={formData.externalFileUrl}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
          />
        )}
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
  const { data: botsToday = [], isLoading: isLoadingBotsToday } =
    useUmblerBotsToday();
  const { data: botsDaysBefore = [], isLoading: isLoadingBotsDaysBefore } =
    useUmblerBotsDaysBefore();

  const createMutation = useCreateAutomation();
  const updateMutation = useUpdateAutomation();
  const deleteMutation = useDeleteAutomation();
  const executeAutomationMutation = useExecuteAutomation();
  const testAllMutation = useTestAutomationAll();
  const testScheduledMutation = useTestAutomationScheduled();
  const { data: healthData } = useAutomationHealth();

  const isLoading =
    isLoadingAutomations ||
    isLoadingChannels ||
    isLoadingTemplates ||
    isLoadingBotsToday ||
    isLoadingBotsDaysBefore;

  // Logs de automação (paginados)
  const [logsPage, setLogsPage] = useState(1);
  const [selectedAutomationId, setSelectedAutomationId] = useState<
    string | null
  >(null);
  const [selectedStatus, setSelectedStatus] = useState<
    "agendado" | "enviado" | "falhou" | "all"
  >("all");
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
    status: selectedStatus,
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

  const handleExecuteAutomation = (automationId: string) => {
    executeAutomationMutation.mutate(automationId);
  };

  const handleResetFilters = () => {
    setSelectedAutomationId(null);
    setSelectedStatus("all");
    setLogsPage(1);
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

  const getBotName = (botId: string) => {
    const botFromToday = botsToday.find((b) => b.id === botId);
    if (botFromToday) return botFromToday.title;

    const botFromDaysBefore = botsDaysBefore.find((b) => b.id === botId);
    if (botFromDaysBefore) return botFromDaysBefore.title;

    return "Bot não encontrado";
  };

  const getDaysBeforeLabel = (days: number) => {
    const option = DAYS_BEFORE_OPTIONS.find((o) => o.value === days);
    return option?.label || `${days} dias antes`;
  };

  const getStatusConfig = (status: "agendado" | "enviado" | "falhou") => {
    const configs = {
      enviado: {
        label: "Enviado",
        color: "bg-green-500",
        textColor: "text-green-600",
        bgColor: "bg-green-50",
        icon: "✓",
      },
      falhou: {
        label: "Falhou",
        color: "bg-red-500",
        textColor: "text-red-600",
        bgColor: "bg-red-50",
        icon: "✗",
      },
      agendado: {
        label: "Agendado",
        color: "bg-yellow-500",
        textColor: "text-yellow-600",
        bgColor: "bg-yellow-50",
        icon: "⏱",
      },
    };
    return configs[status];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-teal-50">
        <div className="p-4 lg:p-8 space-y-6">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
              <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-10 w-40" />
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>

          {/* Test Section Skeleton */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          {/* Automation Cards Skeleton */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-teal-50">
      <div className="p-4 lg:p-8 space-y-8">
        {/* Header moderno com gradiente */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-blue-600 to-teal-600 rounded-2xl shadow-xl overflow-hidden">
          {/* Padrão de fundo decorativo */}
          <div className="absolute inset-0 opacity-30">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            ></div>
          </div>

          <div className="relative p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Bot className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-white">
                      Automações de Mensagens
                    </h1>
                    <p className="text-emerald-100 text-lg">
                      Gerencie automações para envio de mensagens de aniversário
                    </p>
                  </div>
                </div>
              </div>

              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg hover:shadow-xl transition-all duration-300 font-semibold w-full sm:w-auto"
                  >
                    <Plus className="h-5 w-5 mr-2" />
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
                    botsToday={botsToday}
                    botsDaysBefore={botsDaysBefore}
                    onSubmit={handleCreateAutomation}
                    onCancel={() => setIsCreateDialogOpen(false)}
                    isLoading={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Cards de estatísticas modernos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 group hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700 group-hover:text-gray-800 transition-colors">
                  Total de Automações
                </CardTitle>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300">
                  <Settings className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {stats.totalCount}
              </div>
              <p className="text-sm text-emerald-600 font-medium">
                {stats.totalCount === 1
                  ? "automação configurada"
                  : "automações configuradas"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-green-50 group hover:scale-105">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700 group-hover:text-gray-800 transition-colors">
                  Automações Ativas
                </CardTitle>
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300">
                  <Zap className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {stats.activeCount}
              </div>
              <p className="text-sm text-green-600 font-medium">
                enviando mensagens automaticamente
              </p>
              <div className="flex items-center mt-2 gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600">Em funcionamento</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-blue-50 group hover:scale-105 sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700 group-hover:text-gray-800 transition-colors">
                  Automações Inativas
                </CardTitle>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300">
                  <Activity className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {stats.inactiveCount}
              </div>
              <p className="text-sm text-blue-600 font-medium">
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
                          Executar Automações do Dia
                        </h4>
                        <p className="text-sm text-blue-700">
                          Trigger principal
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Executa{" "}
                      <span className="font-medium text-blue-600">
                        automações agendadas para hoje
                      </span>{" "}
                      que ainda não foram executadas. Respeita horários
                      configurados e previne duplicatas.
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
                            Executando...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-3" />
                            Executar Agora
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
                          Catch-up (Recuperar Perdidas)
                        </h4>
                        <p className="text-sm text-green-700">
                          Recuperação automática
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Recupera automações dos{" "}
                      <span className="font-medium text-green-600">
                        últimos 7 dias que falharam
                      </span>
                      . Útil após períodos de inatividade do servidor.
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
                            Executando catch-up...
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4 mr-3" />
                            Executar Catch-up
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
                          💡 Sistema de Automação Serverless
                        </h5>
                      </div>
                      <div className="text-sm text-blue-800 leading-relaxed space-y-1">
                        <p>
                          • <span className="font-medium">Executar Agora:</span>{" "}
                          Dispara automações agendadas para hoje. Respeita
                          horários e previne duplicatas.
                        </p>
                        <p>
                          • <span className="font-medium">Catch-up:</span>{" "}
                          Recupera automações dos últimos 7 dias que falharam.
                          Útil após servidor inativo.
                        </p>
                        <p>
                          • Configure serviços externos (cron-job.org) para
                          garantir execução diária.{" "}
                          <span className="font-medium text-blue-600">
                            Ver AUTOMACAO_SERVERLESS.md
                          </span>
                        </p>
                        {healthData?.data?.missedExecutions > 0 && (
                          <p className="text-amber-800 font-medium">
                            ⚠️ {healthData.data.missedExecutions} automação
                            {healthData.data.missedExecutions > 1 ? "ões" : ""}{" "}
                            perdida
                            {healthData.data.missedExecutions > 1 ? "s" : ""}{" "}
                            detectada
                            {healthData.data.missedExecutions > 1 ? "s" : ""}.
                            Execute o catch-up!
                          </p>
                        )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 3xl:grid-cols-3 gap-4 sm:gap-6">
                {automations.map((automation, index) => (
                  <Card
                    key={automation.id}
                    className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white via-emerald-50/30 to-blue-50/30 hover:scale-[1.01] lg:hover:scale-[1.02] relative overflow-hidden"
                  >
                    {/* Gradiente decorativo */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-blue-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <CardContent className="relative p-4 sm:p-6">
                      <div className="space-y-5">
                        {/* Header moderno com status - Responsivo */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div
                                className={`p-2 sm:p-3 rounded-xl shadow-md ${
                                  automation.enabled
                                    ? "bg-gradient-to-br from-emerald-500 to-green-600"
                                    : "bg-gradient-to-br from-gray-400 to-gray-500"
                                }`}
                              >
                                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                              </div>
                              <div
                                className={`absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-sm ${
                                  automation.enabled
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-gray-400"
                                }`}
                              ></div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">
                                Automação #{index + 1}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  className={`px-2 sm:px-3 py-1 font-semibold border-0 shadow-sm text-xs sm:text-sm ${
                                    automation.enabled
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  }`}
                                >
                                  <span className="hidden xs:inline">
                                    {automation.enabled
                                      ? "🟢 Ativa"
                                      : "⚫ Inativa"}
                                  </span>
                                  <span className="xs:hidden">
                                    {automation.enabled ? "🟢" : "⚫"}
                                  </span>
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-teal-50 px-3 sm:px-4 py-2 rounded-xl border border-blue-200/60 self-start sm:self-auto">
                            <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <div className="text-center">
                              <div className="text-xs sm:text-sm font-semibold text-blue-700">
                                {automation.sendTime}
                              </div>
                              <div className="text-xs text-blue-600 hidden xs:block">
                                {getDaysBeforeLabel(automation.daysBefore)}
                              </div>
                              <div className="text-xs text-blue-600 xs:hidden">
                                {automation.daysBefore === 0
                                  ? "No dia"
                                  : `${automation.daysBefore}d antes`}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Informações detalhadas - Layout responsivo */}
                        <div className="space-y-3 sm:space-y-4">
                          {/* Canal de envio */}
                          <div className="bg-gradient-to-r from-blue-50/50 to-cyan-50/50 border border-blue-200/60 rounded-lg sm:rounded-xl p-3 sm:p-4">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-md flex-shrink-0">
                                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-blue-900 mb-1 text-sm sm:text-base">
                                  Canal de Envio
                                </h4>
                                <p className="text-xs sm:text-sm text-blue-700 break-all leading-relaxed">
                                  {getChannelName(
                                    automation.externalChannelId || ""
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Template */}
                          {automation.externalTemplateId && (
                            <div
                              className={`bg-gradient-to-r ${
                                automation.type === "bot"
                                  ? "from-purple-50/50 to-indigo-50/50 border-purple-200/60"
                                  : "from-emerald-50/50 to-teal-50/50 border-emerald-200/60"
                              } border rounded-lg sm:rounded-xl p-3 sm:p-4`}
                            >
                              <div className="flex items-start gap-2 sm:gap-3">
                                <div
                                  className={`p-1.5 sm:p-2 ${
                                    automation.type === "bot"
                                      ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                  } rounded-lg shadow-md flex-shrink-0`}
                                >
                                  <span className="text-white font-bold text-xs sm:text-sm">
                                    {automation.type === "bot" ? "B" : "T"}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4
                                    className={`font-semibold ${
                                      automation.type === "bot"
                                        ? "text-purple-900"
                                        : "text-emerald-900"
                                    } mb-1 text-sm sm:text-base`}
                                  >
                                    {automation.type === "bot"
                                      ? "Bot de Automação"
                                      : "Template"}
                                  </h4>
                                  <p
                                    className={`text-xs sm:text-sm ${
                                      automation.type === "bot"
                                        ? "text-purple-700"
                                        : "text-emerald-700"
                                    } break-all leading-relaxed`}
                                  >
                                    {automation.type === "bot"
                                      ? getBotName(
                                          automation.externalTemplateId || ""
                                        )
                                      : getTemplateName(
                                          automation.externalTemplateId || ""
                                        )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Arquivo de mídia - Layout otimizado para mobile */}
                          {automation.type === "template" &&
                            automation.externalFileUrl && (
                              <div className="bg-gradient-to-r from-purple-50/50 to-pink-50/50 border border-purple-200/60 rounded-lg sm:rounded-xl p-3 sm:p-4">
                                <div className="flex items-start gap-2 sm:gap-3">
                                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-md flex-shrink-0">
                                    <Image className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-purple-900 mb-2 text-sm sm:text-base">
                                      Arquivo de Mídia
                                    </h4>

                                    {/* Layout responsivo para preview da imagem */}
                                    <div className="flex flex-col xs:flex-row items-start gap-3">
                                      <div className="relative group flex-shrink-0">
                                        <img
                                          src={automation.externalFileUrl}
                                          alt="Mídia da automação"
                                          className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 object-cover rounded-lg border-2 border-white shadow-md group-hover:shadow-lg transition-all duration-300"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-colors" />
                                      </div>

                                      <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
                                          <span className="text-xs font-medium text-green-600">
                                            Arquivo configurado
                                          </span>
                                        </div>
                                        <p className="text-xs text-purple-700 leading-relaxed">
                                          <span className="hidden sm:inline">
                                            Este arquivo será enviado
                                            automaticamente junto com a mensagem
                                          </span>
                                          <span className="sm:hidden">
                                            Enviado junto com a mensagem
                                          </span>
                                        </p>
                                        {automation.externalFileId && (
                                          <div className="bg-white/60 rounded border px-2 py-1">
                                            <p className="text-xs text-purple-600 font-mono break-all">
                                              <span className="hidden sm:inline">
                                                ID:{" "}
                                              </span>
                                              {automation.externalFileId}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                        </div>

                        {/* Controles modernos - Layout responsivo */}
                        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-4 pt-4 border-t border-gray-200/60">
                          {/* Switch de controle */}
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <Switch
                                checked={automation.enabled}
                                onCheckedChange={() =>
                                  handleToggleEnabled(automation)
                                }
                                disabled={updateMutation.isPending}
                                className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-200"
                              />
                              <span className="text-xs text-gray-600 mt-1 block font-medium">
                                {automation.enabled ? "Ativado" : "Desativado"}
                              </span>
                            </div>
                          </div>

                          {/* Botões de ação - Responsivos */}
                          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full xs:w-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingAutomation(automation)}
                              className="h-9 xs:h-10 px-3 xs:px-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 hover:from-blue-100 hover:to-cyan-100 hover:border-blue-300 text-blue-700 hover:text-blue-800 transition-all duration-300 font-medium text-xs xs:text-sm"
                              title="Editar automação"
                            >
                              <Edit className="h-3 w-3 xs:h-4 xs:w-4 mr-1 xs:mr-2" />
                              <span className="hidden xs:inline">Editar</span>
                              <span className="xs:hidden">
                                Editar Automação
                              </span>
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 xs:h-10 px-3 xs:px-4 bg-gradient-to-r from-red-50 to-pink-50 border-red-200 hover:from-red-100 hover:to-pink-100 hover:border-red-300 text-red-700 hover:text-red-800 transition-all duration-300 font-medium text-xs xs:text-sm"
                                  title="Remover automação"
                                >
                                  <Trash2 className="h-3 w-3 xs:h-4 xs:w-4 mr-1 xs:mr-2" />
                                  <span className="hidden xs:inline">
                                    Remover
                                  </span>
                                  <span className="xs:hidden">
                                    Remover Automação
                                  </span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-md mx-4">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remover Automação
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover esta
                                    automação? Esta ação não pode ser desfeita e
                                    todos os arquivos associados serão
                                    deletados.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col xs:flex-row gap-2">
                                  <AlertDialogCancel className="w-full xs:w-auto">
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleDeleteAutomation(automation)
                                    }
                                    className="w-full xs:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

        {/* Logs/resultados das automações - Design minimalista */}
        <Card className="border border-gray-200/60 shadow-sm bg-white">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Resultados das Automações
                  </CardTitle>
                  <CardDescription className="text-gray-500 text-sm mt-0.5">
                    Histórico de execução e status das mensagens
                  </CardDescription>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchLogs()}
                className="border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-gray-900 w-full sm:w-auto"
              >
                <RefreshCcw
                  className={cn(
                    "h-3 w-3 mr-2",
                    isFetchingLogs && "animate-spin"
                  )}
                />
                <span className="text-sm">
                  {isFetchingLogs ? "Atualizando..." : "Atualizar"}
                </span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {isLoadingAutomations ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Carregando filtros...</p>
              </div>
            ) : (
              <>
                {/* Filtros minimalistas */}
                <div className="mb-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-gray-700">
                      Filtros
                    </h3>
                    {(selectedAutomationId || selectedStatus !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-2 h-auto"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Filtro por automação */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Automação
                      </Label>
                      <Select
                        value={selectedAutomationId || "all"}
                        onValueChange={(value) => {
                          setSelectedAutomationId(
                            value === "all" ? null : value
                          );
                          setLogsPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9 border-gray-200 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400">
                          <SelectValue placeholder="Todas as automações" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-sm">
                            Todas as automações
                          </SelectItem>
                          {isLoadingAutomations ? (
                            <SelectItem
                              value="loading"
                              disabled
                              className="text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                <span>Carregando...</span>
                              </div>
                            </SelectItem>
                          ) : automations.length === 0 ? (
                            <SelectItem
                              value="empty"
                              disabled
                              className="text-sm text-gray-400"
                            >
                              Nenhuma automação disponível
                            </SelectItem>
                          ) : (
                            automations.map((a) => (
                              <SelectItem
                                key={a.id}
                                value={a.id}
                                className="text-sm"
                              >
                                <div className="flex flex-col items-start py-1">
                                  <span className="font-medium text-gray-900">
                                    {getChannelName(a.externalChannelId || "")}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {getDaysBeforeLabel(a.daysBefore)} às{" "}
                                    {a.sendTime}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filtro por status */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Status
                      </Label>
                      <Select
                        value={selectedStatus}
                        onValueChange={(
                          value: "agendado" | "enviado" | "falhou" | "all"
                        ) => {
                          setSelectedStatus(value);
                          setLogsPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9 border-gray-200 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              <span>Todos</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="enviado" className="text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span>Enviado</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="falhou" className="text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span>Falhou</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="agendado" className="text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>Agendado</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Resumo minimalista dos resultados */}
                {!isLoadingLogs && logsData && (
                  <div className="border border-gray-100 rounded-lg bg-gray-50/50 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-sm text-gray-600">
                          <span className="font-semibold text-gray-900">
                            {logsData.data.length}
                          </span>{" "}
                          {logsData.data.length === 1
                            ? "resultado"
                            : "resultados"}
                        </div>

                        {/* Contadores minimalistas por status */}
                        {logsData.data.length > 0 && (
                          <div className="flex flex-wrap items-center gap-3">
                            {(() => {
                              const statusCounts = logsData.data.reduce(
                                (acc, log) => {
                                  acc[log.status] = (acc[log.status] || 0) + 1;
                                  return acc;
                                },
                                {} as Record<string, number>
                              );

                              return Object.entries(statusCounts).map(
                                ([status, count]) => {
                                  const config = getStatusConfig(
                                    status as "agendado" | "enviado" | "falhou"
                                  );
                                  return (
                                    <div
                                      key={status}
                                      className="flex items-center gap-1.5 px-2 py-1 bg-white rounded text-xs border border-gray-200"
                                    >
                                      <div
                                        className={`w-1.5 h-1.5 rounded-full ${config.color}`}
                                      />
                                      <span className="text-gray-600">
                                        {config.label}:{" "}
                                        <span className="font-medium text-gray-900">
                                          {count}
                                        </span>
                                      </span>
                                    </div>
                                  );
                                }
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Botão de reset minimalista */}
                      {(selectedAutomationId || selectedStatus !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetFilters}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1.5" />
                          Resetar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {isLoadingLogs ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-3" />
                    <p className="text-sm text-gray-500">
                      Carregando resultados...
                    </p>
                  </div>
                ) : !logsData || logsData.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <MessageSquare className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">
                      Nenhum resultado encontrado
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm">
                      {selectedAutomationId
                        ? "Esta automação ainda não enviou mensagens."
                        : "Ainda não há mensagens enviadas pelas automações."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Tabela desktop minimalista */}
                    <div className="hidden lg:block">
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Cliente
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Status
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Tentativas
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Agendado
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Enviado
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Erro
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {logsData.data.map((log, index) => (
                              <tr
                                key={log.id}
                                className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                                  index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">
                                    {log.client?.name || log.clientId}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {(() => {
                                    const config = getStatusConfig(log.status);
                                    return (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border">
                                        <div
                                          className={`w-1.5 h-1.5 rounded-full ${config.color}`}
                                        />
                                        <span className="font-medium">
                                          {config.label}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-xs font-medium text-gray-700">
                                    {log.attempts}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-600 text-xs">
                                  {log.scheduledSendAt
                                    ? new Date(
                                        log.scheduledSendAt
                                      ).toLocaleString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-gray-600 text-xs">
                                  {log.actualSendAt
                                    ? new Date(log.actualSendAt).toLocaleString(
                                        "pt-BR",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {log.lastError ? (
                                    <div className="max-w-xs">
                                      <p
                                        className="text-xs text-red-600 truncate font-mono"
                                        title={log.lastError}
                                      >
                                        {log.lastError}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Cards móveis minimalistas */}
                    <div className="lg:hidden space-y-3">
                      {logsData.data.map((log) => (
                        <div
                          key={log.id}
                          className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate text-sm">
                                  {log.client?.name || log.clientId}
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  ID: {log.clientId.slice(-8)}
                                </p>
                              </div>
                              {(() => {
                                const config = getStatusConfig(log.status);
                                return (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border">
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${config.color}`}
                                    />
                                    <span className="font-medium">
                                      {config.label}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <div className="text-gray-500 mb-1">
                                  Tentativas
                                </div>
                                <div className="font-semibold text-gray-900">
                                  {log.attempts}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500 mb-1">
                                  Agendado
                                </div>
                                <div className="text-gray-700">
                                  {log.scheduledSendAt
                                    ? new Date(
                                        log.scheduledSendAt
                                      ).toLocaleString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </div>
                              </div>
                            </div>

                            {log.actualSendAt && (
                              <div className="text-xs pt-2 border-t border-gray-100">
                                <div className="text-gray-500 mb-1">
                                  Enviado em
                                </div>
                                <div className="text-gray-700">
                                  {new Date(log.actualSendAt).toLocaleString(
                                    "pt-BR",
                                    {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </div>
                              </div>
                            )}

                            {log.lastError && (
                              <div className="text-xs pt-2 border-t border-red-100 bg-red-50/50 -mx-4 -mb-4 px-4 pb-4 mt-3">
                                <div className="text-red-700 font-medium mb-1">
                                  Erro
                                </div>
                                <p className="text-red-600 leading-relaxed font-mono">
                                  {log.lastError}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Visualização das automações com mídia - versão mobile otimizada */}
                    <div className="lg:hidden space-y-4 mt-8">
                      {automations.filter(
                        (automation) =>
                          automation.type === "template" &&
                          automation.externalFileUrl
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
                                  (automation) =>
                                    automation.type === "template" &&
                                    automation.externalFileUrl
                                ).length
                              }
                            </Badge>
                          </div>
                          {automations
                            .filter(
                              (automation) =>
                                automation.type === "template" &&
                                automation.externalFileUrl
                            )
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
                    {/* Paginação minimalista */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
                      <div className="text-xs text-gray-500 text-center sm:text-left">
                        Página{" "}
                        <span className="font-medium text-gray-900">
                          {logsData.page}
                        </span>{" "}
                        de{" "}
                        <span className="font-medium text-gray-900">
                          {Math.ceil(logsData.total / logsData.pageSize)}
                        </span>
                        <span className="hidden sm:inline text-gray-400">
                          {" "}
                          • {logsData.total} resultado
                          {logsData.total !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                          disabled={logsData.page === 1}
                          className="px-3 h-8 text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent border border-gray-200 disabled:border-gray-100"
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
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLogsPage(pageNumber)}
                                  className={`w-8 h-8 p-0 text-xs border ${
                                    logsData.page === pageNumber
                                      ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                                      : "border-gray-200 text-gray-700 hover:bg-gray-100"
                                  }`}
                                >
                                  {pageNumber}
                                </Button>
                              );
                            }
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogsPage((p) => p + 1)}
                          disabled={
                            logsData.page >=
                            Math.ceil(logsData.total / logsData.pageSize)
                          }
                          className="px-3 h-8 text-gray-600 hover:bg-gray-100 disabled:hover:bg-transparent border border-gray-200 disabled:border-gray-100"
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
                botsToday={botsToday}
                botsDaysBefore={botsDaysBefore}
                onSubmit={handleUpdateAutomation}
                onCancel={() => setEditingAutomation(null)}
                isLoading={updateMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
