import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nanoid } from "nanoid";
import {
  ArrowLeft,
  ArrowRightLeft,
  Save,
  MessageCircle,
  GitBranch,
  Zap,
  PlayCircle,
  StopCircle,
  Plus,
  Trash2,
  Search,
  Send,
  RotateCcw,
  LayoutTemplate,
  RefreshCw,
  Paperclip,
  FileText,
  X,
  Loader2,
  Hourglass,
  ListChecks,
  CheckCircle2,
  UserRoundCog,
  Shuffle,
  Lock,
  Unlock,
  Tag,
  SendHorizonal,
  ImageIcon,
  FileVideo,
  FileText as FileTextIcon,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useWhatsappBotFlow, useWhatsappBots, useSaveFlow } from "@/hooks/use-whatsapp-bots";
import { useWhatsappMetaTemplates } from "@/hooks/use-whatsapp";
import { AttachFileDialog } from "@/components/media-library/attach-file-dialog";
import type { MediaLibraryItem } from "@/hooks/use-media-library";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  parseTemplateVars,
  getParamValue,
  setParamValue,
} from "@/lib/whatsapp-template";
import {
  StartNode,
  SendMessageNode,
  ConditionNode,
  MenuNode,
  ActionNode,
  EndNode,
  FlowFormNode,
  WaitNode,
  EndConversationNode,
  TransferAgentNode,
  DistributeFlowNode,
  EditTagsNode,
  SendTemplateNode,
  TriggerFlowNode,
} from "@/components/whatsapp-bot/nodes";
import type {
  BotNodeData,
  SendMessageNodeData,
  SendMessageAttachment,
  TemplateHeaderMedia,
  ConditionNodeData,
  ConditionBranch,
  ConditionRule,
  MenuNodeData,
  MenuOption,
  ActionNodeData,
  FlowFormNodeData,
  WaitNodeData,
  EndConversationNodeData,
  TransferAgentNodeData,
  DistributeFlowNodeData,
  DistributeFlowOutput,
  EditTagsNodeData,
  SendTemplateNodeData,
  SendTemplateButtonHandle,
  TriggerFlowNodeData,
  WhatsappFlow,
} from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowNode = Node<BotNodeData & { label: string }>;
type FlowEdge = Edge;

const NODE_TYPES = {
  start: StartNode,
  send_message: SendMessageNode,
  condition: ConditionNode,
  menu: MenuNode,
  action: ActionNode,
  flow_form: FlowFormNode,
  wait: WaitNode,
  end: EndNode,
  end_conversation: EndConversationNode,
  transfer_agent: TransferAgentNode,
  distribute_flow: DistributeFlowNode,
  edit_tags: EditTagsNode,
  send_template: SendTemplateNode,
  trigger_flow: TriggerFlowNode,
};

// ─── Palette config ───────────────────────────────────────────────────────────

const PALETTE = [
  { type: "send_message", label: "Enviar Mensagem", icon: MessageCircle, color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
  { type: "menu", label: "Menu (opções)", icon: ListChecks, color: "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100" },
  { type: "condition", label: "Condição", icon: GitBranch, color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" },
  { type: "action", label: "Ação", icon: Zap, color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
  { type: "wait", label: "Aguardar", icon: Hourglass, color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" },
  { type: "flow_form", label: "Formulário WA", icon: LayoutTemplate, color: "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100" },
  { type: "transfer_agent", label: "Transferir p/ atendente", icon: UserRoundCog, color: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" },
  { type: "distribute_flow", label: "Distribuir fluxo", icon: Shuffle, color: "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100" },
  { type: "edit_tags", label: "Editar etiquetas", icon: Tag, color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" },
  { type: "send_template", label: "Enviar template", icon: SendHorizonal, color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
  { type: "trigger_flow", label: "Acionar outro fluxo", icon: ArrowRightLeft, color: "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100" },
  { type: "end_conversation", label: "Finalizar conversa", icon: CheckCircle2, color: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" },
  { type: "end", label: "Fim", icon: StopCircle, color: "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100" },
];

// ─── Attachment Preview ───────────────────────────────────────────────────────

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: SendMessageAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-md border bg-muted/30 overflow-hidden">
      {attachment.type === "image" ? (
        <div className="relative">
          <img
            src={`/api/whatsapp/bots/attachments/${attachment.storageKey}`}
            alt={attachment.name ?? "imagem"}
            className="w-full max-h-40 object-cover rounded-md"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{attachment.name ?? "documento"}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

function useWhatsappFlows() {
  return useQuery<WhatsappFlow[]>({
    queryKey: ["/api/whatsapp/flows"],
    queryFn: () => fetch("/api/whatsapp/flows").then((r) => r.json()),
  });
}

function useSyncFlows() {
  return useMutation({
    mutationFn: () =>
      fetch("/api/whatsapp/flows/sync", { method: "POST" }).then((r) => r.json()),
  });
}

type AgentOption = { id: string; name: string };
type SectorOption = { id: string; name: string; color?: string };
type TagOption = { id: string; name: string; color?: string | null; emoji?: string | null };
type ChannelOption = { id: string; name: string; phoneNumber?: string | null };
type BotOption = { id: string; name: string };

function authFetch(url: string) {
  return fetch(url, {
    headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
  }).then((r) => (r.ok ? r.json() : []));
}

function useAgents() {
  return useQuery<AgentOption[]>({
    queryKey: ["/api/users"],
    queryFn: () => authFetch("/api/users"),
  });
}

function useSectors() {
  return useQuery<SectorOption[]>({
    queryKey: ["/api/whatsapp/sectors"],
    queryFn: () => authFetch("/api/whatsapp/sectors"),
  });
}

function useBots() {
  return useQuery<BotOption[]>({
    queryKey: ["/api/whatsapp/bots"],
    queryFn: () => authFetch("/api/whatsapp/bots"),
  });
}

function useChannels() {
  return useQuery<ChannelOption[]>({
    queryKey: ["/api/whatsapp/channels"],
    queryFn: () => authFetch("/api/whatsapp/channels"),
  });
}

function useMarkerTags() {
  return useQuery<TagOption[]>({
    queryKey: ["/api/whatsapp/tags"],
    queryFn: () => authFetch("/api/whatsapp/tags"),
  });
}

// Campos de `clients` que o nó "Campo do contato" pode gravar (deve refletir
// CONTACT_FIELD_WHITELIST no schema).
const CONTACT_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "email", label: "E-mail" },
  { value: "fixedPhone", label: "Telefone fixo" },
  { value: "cpf", label: "CPF" },
  { value: "birthday", label: "Aniversário" },
  { value: "cep", label: "CEP" },
  { value: "address", label: "Endereço" },
  { value: "number", label: "Número" },
  { value: "complement", label: "Complemento" },
  { value: "neighborhood", label: "Bairro" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "Estado" },
  { value: "categoria", label: "Categoria" },
  { value: "origem", label: "Origem" },
  { value: "nomeFantasia", label: "Nome fantasia" },
  { value: "inscricaoEstadual", label: "Inscrição estadual" },
];

const ACTION_TYPE_OPTIONS: { value: ActionNodeData["actionType"]; label: string }[] = [
  { value: "assign_agent", label: "Transferir p/ atendente" },
  { value: "transfer_sector", label: "Transferir p/ setor" },
  { value: "notify_agent", label: "Notificar atendente" },
  { value: "create_note", label: "Criar nota interna" },
  { value: "set_waiting", label: "Status esperando" },
  { value: "set_contact_field", label: "Campo do contato" },
];

function PropertiesPanel({
  node,
  onChange,
  onDelete,
}: {
  node: FlowNode | null;
  onChange: (id: string, data: Partial<BotNodeData & { label: string }>) => void;
  onDelete: (id: string) => void;
}) {
  const { data: metaTemplates = [], isLoading: loadingMeta } = useWhatsappMetaTemplates();
  const { data: waFlows = [], refetch: refetchFlows } = useWhatsappFlows();
  const { data: agents = [] } = useAgents();
  const { data: sectors = [] } = useSectors();
  const { data: channels = [] } = useChannels();
  const { data: bots = [] } = useBots();
  const { data: markerTags = [] } = useMarkerTags();
  const syncFlowsMutation = useSyncFlows();
  const [templateSearch, setTemplateSearch] = useState("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerMediaInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);

  if (!node) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center pt-8">
        Selecione um nó para editar suas propriedades
      </div>
    );
  }

  const d = node.data;

  function update(patch: Partial<BotNodeData & { label: string }>) {
    onChange(node!.id, patch);
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="space-y-1">
        <Label className="text-xs">Rótulo do nó</Label>
        <Input
          value={d.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="Rótulo"
        />
      </div>

      {node.type === "send_message" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de mensagem</Label>
            <Select
              value={(d as SendMessageNodeData).messageType ?? "text"}
              onValueChange={(v) =>
                update({ messageType: v as "text" | "template" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="template">Template</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(d as SendMessageNodeData).messageType === "text" && (
            <p className="text-[11px] text-muted-foreground">
              Use <code className="font-mono">{"{{variavel}}"}</code> para inserir valores capturados em nós de Pergunta.
            </p>
          )}
          {(d as SendMessageNodeData).messageType === "template" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Template (Meta)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-7 h-7 text-sm"
                    placeholder="Buscar..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-40 border rounded-md">
                  {loadingMeta ? (
                    <div className="p-3 text-xs text-muted-foreground">Carregando...</div>
                  ) : (
                    <div className="p-1">
                      {metaTemplates
                        .filter((t) =>
                          t.name.toLowerCase().includes(templateSearch.toLowerCase()),
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              update({
                                metaTemplateName: t.name,
                                metaTemplateLanguage: t.language,
                                templateParams: [],
                                templateHeaderMedia: undefined,
                              })
                            }
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded-sm text-xs hover:bg-accent transition-colors",
                              (d as SendMessageNodeData).metaTemplateName === t.name &&
                                "bg-accent font-medium",
                            )}
                          >
                            <div className="font-mono truncate">{t.name}</div>
                            <span className="text-muted-foreground">
                              {t.category} · {t.language}
                            </span>
                          </button>
                        ))}
                      {metaTemplates.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">
                          Nenhum template aprovado. Atualize na aba Meta.
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {(() => {
                const selected = metaTemplates.find(
                  (t) => t.name === (d as SendMessageNodeData).metaTemplateName,
                );
                if (!selected) return null;
                const varGroups = parseTemplateVars(selected);
                if (!varGroups.length) return null;
                const params = (d as SendMessageNodeData).templateParams ?? [];
                const headerMedia = (d as SendMessageNodeData).templateHeaderMedia;
                const mediaGroup = varGroups.find((g) => g.format !== "text");
                const textGroups = varGroups.filter((g) => g.format === "text");
                const mediaLabel =
                  mediaGroup?.format === "video"
                    ? "Vídeo do header"
                    : mediaGroup?.format === "document"
                      ? "Documento do header"
                      : "Imagem do header";
                const mediaAccept =
                  mediaGroup?.format === "video"
                    ? "video/*"
                    : mediaGroup?.format === "document"
                      ? "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      : "image/*";
                return (
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    <Label className="text-xs text-muted-foreground">Parâmetros</Label>

                    {mediaGroup && (
                      <div className="space-y-1">
                        <Label className="text-xs">{mediaLabel}</Label>
                        {headerMedia?.storageKey ? (
                          headerMedia.type === "image" ? (
                            <div className="relative rounded-md border bg-muted/30 overflow-hidden">
                              <img
                                src={`/api/whatsapp/bots/attachments/${headerMedia.storageKey}`}
                                alt={headerMedia.name ?? "imagem"}
                                className="w-full max-h-40 object-cover rounded-md"
                              />
                              <button
                                type="button"
                                onClick={() => update({ templateHeaderMedia: undefined })}
                                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border bg-muted/30">
                              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                              <span className="text-xs truncate flex-1">
                                {headerMedia.name ?? "arquivo"}
                              </span>
                              <button
                                type="button"
                                onClick={() => update({ templateHeaderMedia: undefined })}
                                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        ) : (
                          <>
                            <input
                              ref={headerMediaInputRef}
                              type="file"
                              accept={mediaAccept}
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setIsUploadingHeader(true);
                                try {
                                  const formData = new FormData();
                                  formData.append("file", file);
                                  const res = await fetch("/api/whatsapp/bots/attachments", {
                                    method: "POST",
                                    body: formData,
                                  });
                                  if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    throw new Error((err as { message?: string }).message ?? "Erro no upload");
                                  }
                                  const data = (await res.json()) as {
                                    storageKey: string;
                                    name: string;
                                    mimeType: string;
                                  };
                                  const media: TemplateHeaderMedia = {
                                    storageKey: data.storageKey,
                                    type: mediaGroup.format as TemplateHeaderMedia["type"],
                                    name: data.name,
                                    mimeType: data.mimeType,
                                  };
                                  update({ templateHeaderMedia: media });
                                } catch (err) {
                                  toast({ title: "Erro ao fazer upload", description: (err as Error).message, variant: "destructive" });
                                } finally {
                                  setIsUploadingHeader(false);
                                  e.target.value = "";
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              disabled={isUploadingHeader}
                              onClick={() => headerMediaInputRef.current?.click()}
                            >
                              {isUploadingHeader ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Paperclip className="h-3.5 w-3.5" />
                              )}
                              {isUploadingHeader ? "Enviando..." : "Enviar mídia do header"}
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {textGroups.map((group) =>
                      group.vars.map((varName, i) => (
                        <div key={`${group.componentType}-${i}`} className="space-y-0.5">
                          <Label className="text-xs font-mono">{`{{${varName}}}`}</Label>
                          <Input
                            className="h-7 text-sm"
                            placeholder="Valor fixo"
                            value={getParamValue(params, group.componentType, i)}
                            onChange={(e) =>
                              update({
                                templateParams: setParamValue(
                                  params,
                                  group.componentType,
                                  i,
                                  e.target.value,
                                  "text",
                                ),
                              })
                            }
                          />
                        </div>
                      )),
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={(d as SendMessageNodeData).text ?? ""}
                  onChange={(e) => update({ text: e.target.value })}
                  placeholder="Digite a mensagem..."
                  rows={4}
                />
              </div>

              {/* Attachment section */}
              <div className="space-y-2">
                <Label className="text-xs">Anexo (opcional)</Label>
                {(d as SendMessageNodeData).attachment ? (
                  <AttachmentPreview
                    attachment={(d as SendMessageNodeData).attachment!}
                    onRemove={() => update({ attachment: undefined })}
                  />
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const res = await fetch("/api/whatsapp/bots/attachments", {
                            method: "POST",
                            body: formData,
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error((err as { message?: string }).message ?? "Erro no upload");
                          }
                          const data = await res.json() as { storageKey: string; name: string; mimeType: string; type: "image" | "document" };
                          const attachment: SendMessageAttachment = {
                            storageKey: data.storageKey,
                            type: data.type,
                            name: data.name,
                            mimeType: data.mimeType,
                          };
                          update({ attachment });
                        } catch (err) {
                          toast({ title: "Erro ao fazer upload", description: (err as Error).message, variant: "destructive" });
                        } finally {
                          setIsUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5" />
                      )}
                      {isUploading ? "Enviando..." : "Adicionar arquivo"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {node.type === "menu" && (
        <MenuEditor data={d as Partial<MenuNodeData>} onChange={update} />
      )}

      {node.type === "condition" && (
        <ConditionEditor
          data={d as ConditionNodeData}
          onChange={(patch) => update(patch)}
          markerTags={markerTags}
          agents={agents}
          sectors={sectors}
          channels={channels}
          bots={bots}
        />
      )}

      {node.type === "flow_form" && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">WhatsApp Flow</Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={async () => {
                  await syncFlowsMutation.mutateAsync();
                  refetchFlows();
                }}
                title="Sincronizar flows da Meta"
              >
                <RefreshCw className={cn("h-3 w-3", syncFlowsMutation.isPending && "animate-spin")} />
              </Button>
            </div>
            <Select
              value={(d as FlowFormNodeData).flowId ?? ""}
              onValueChange={(v) => {
                const selected = waFlows.find((f) => f.metaFlowId === v);
                update({ flowId: v, flowName: selected?.name ?? v });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um Flow publicado..." />
              </SelectTrigger>
              <SelectContent>
                {waFlows.filter((f) => f.status === "PUBLISHED").map((f) => (
                  <SelectItem key={f.metaFlowId} value={f.metaFlowId}>
                    {f.name}
                  </SelectItem>
                ))}
                {waFlows.filter((f) => f.status === "PUBLISHED").length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhum flow publicado. Clique em ↺ para sincronizar.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texto do botão CTA</Label>
            <Input
              value={(d as FlowFormNodeData).ctaText ?? ""}
              onChange={(e) => update({ ctaText: e.target.value })}
              placeholder="Ex: Preencher formulário"
              maxLength={30}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corpo da mensagem (opcional)</Label>
            <Textarea
              value={(d as FlowFormNodeData).bodyText ?? ""}
              onChange={(e) => update({ bodyText: e.target.value })}
              placeholder="Texto exibido acima do botão..."
              rows={3}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            As respostas do formulário ficam disponíveis como variáveis{" "}
            <code className="font-mono">{"{{campo}}"}</code> nos nós seguintes.
          </p>
        </>
      )}

      {node.type === "action" && (
        <ActionEditor
          data={d as Partial<ActionNodeData>}
          onChange={update}
          agents={agents}
          sectors={sectors}
          markerTags={markerTags}
        />
      )}

      {node.type === "wait" && (
        <WaitEditor data={d as Partial<WaitNodeData>} onChange={update} />
      )}

      {node.type === "send_template" && (
        <SendTemplateEditor
          data={d as Partial<SendTemplateNodeData>}
          onChange={update}
          metaTemplates={metaTemplates}
        />
      )}

      {node.type === "trigger_flow" && (
        <TriggerFlowEditor
          data={d as Partial<TriggerFlowNodeData>}
          onChange={update}
        />
      )}

      {node.type === "edit_tags" && (
        <EditTagsEditor
          data={d as Partial<EditTagsNodeData>}
          onChange={update}
          markerTags={markerTags}
        />
      )}

      {node.type === "distribute_flow" && (
        <DistributeFlowEditor
          data={d as Partial<DistributeFlowNodeData>}
          onChange={update}
        />
      )}

      {node.type === "transfer_agent" && (
        <TransferAgentEditor
          data={d as Partial<TransferAgentNodeData>}
          onChange={update}
          agents={agents}
        />
      )}

      {node.type === "end_conversation" && (
        <EndConversationEditor
          data={d as Partial<EndConversationNodeData>}
          onChange={update}
          agents={agents}
        />
      )}

      {(node.type === "start" || node.type === "end") && (
        <p className="text-xs text-muted-foreground">
          Este nó não possui propriedades configuráveis.
        </p>
      )}


      {node.type !== "start" && (
        <div className="pt-4 mt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(node.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir nó
          </Button>
        </div>
      )}
    </div>
  );
}

function toggleInList(list: string[] | undefined, id: string): string[] {
  const arr = list ?? [];
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function TagChips({
  tags,
  selected,
  onToggle,
  emptyHint,
}: {
  tags: TagOption[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyHint: string;
}) {
  if (tags.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{emptyHint}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const active = selected.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

function ActionEditor({
  data,
  onChange,
  agents,
  sectors,
  markerTags,
}: {
  data: Partial<ActionNodeData>;
  onChange: (patch: Partial<ActionNodeData>) => void;
  agents: AgentOption[];
  sectors: SectorOption[];
  markerTags: TagOption[];
}) {
  const actionType = data.actionType ?? "edit_tags";

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Tipo de ação</Label>
        <Select
          value={actionType}
          onValueChange={(v) =>
            onChange({ actionType: v as ActionNodeData["actionType"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {actionType === "edit_tags" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Adicionar etiquetas</Label>
            <TagChips
              tags={markerTags}
              selected={data.addTagIds ?? []}
              onToggle={(id) =>
                onChange({ addTagIds: toggleInList(data.addTagIds, id) })
              }
              emptyHint="Nenhuma etiqueta (marcador) cadastrada."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Remover etiquetas</Label>
            <TagChips
              tags={markerTags}
              selected={data.removeTagIds ?? []}
              onToggle={(id) =>
                onChange({ removeTagIds: toggleInList(data.removeTagIds, id) })
              }
              emptyHint="Nenhuma etiqueta (marcador) cadastrada."
            />
          </div>
        </>
      )}

      {actionType === "assign_agent" && (
        <div className="space-y-1">
          <Label className="text-xs">Atendente</Label>
          <Select
            value={data.agentId ?? ""}
            onValueChange={(v) => onChange({ agentId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um atendente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {actionType === "transfer_sector" && (
        <div className="space-y-1">
          <Label className="text-xs">Setor</Label>
          <Select
            value={data.sectorId ?? ""}
            onValueChange={(v) => onChange({ sectorId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um setor" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {actionType === "notify_agent" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Atendente (opcional)</Label>
            <Select
              value={data.notifyAgentId ?? "__assigned__"}
              onValueChange={(v) =>
                onChange({ notifyAgentId: v === "__assigned__" ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__assigned__">
                  Atendente atribuído à conversa
                </SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mensagem da notificação</Label>
            <Textarea
              value={data.notifyMessage ?? ""}
              onChange={(e) => onChange({ notifyMessage: e.target.value })}
              placeholder="Ex: Cliente {{nome}} aguardando atendimento"
              rows={3}
            />
          </div>
        </>
      )}

      {actionType === "create_note" && (
        <div className="space-y-1">
          <Label className="text-xs">Texto da nota (interno)</Label>
          <Textarea
            value={data.noteText ?? ""}
            onChange={(e) => onChange({ noteText: e.target.value })}
            placeholder="Anotação visível apenas para atendentes..."
            rows={3}
          />
        </div>
      )}

      {actionType === "set_waiting" && (
        <div className="space-y-1">
          <Label className="text-xs">Status da conversa</Label>
          <Select
            value={data.waitingStatus ?? "waiting"}
            onValueChange={(v) => onChange({ waitingStatus: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="waiting">Esperando</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {actionType === "set_contact_field" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Campo do contato</Label>
            <Select
              value={data.contactField ?? ""}
              onValueChange={(v) =>
                onChange({ contactField: v as ActionNodeData["contactField"] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_FIELD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              value={data.contactFieldValue ?? ""}
              onChange={(e) => onChange({ contactFieldValue: e.target.value })}
              placeholder="Texto ou {{variavel}}"
            />
          </div>
        </>
      )}

      {actionType === "end_conversation" && (
        <p className="text-[11px] text-muted-foreground">
          Encerra a sessão do bot e finaliza o fluxo.
        </p>
      )}
    </div>
  );
}

function WaitEditor({
  data,
  onChange,
}: {
  data: Partial<WaitNodeData>;
  onChange: (patch: Partial<WaitNodeData>) => void;
}) {
  const mode = data.mode ?? "interval";
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Modo de espera</Label>
        <Select
          value={mode}
          onValueChange={(v) => onChange({ mode: v as WaitNodeData["mode"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interval">Aguardar intervalo</SelectItem>
            <SelectItem value="until">Aguardar até</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "interval" ? (
        <div className="space-y-1">
          <Label className="text-xs">Tempo de espera (segundos)</Label>
          <Input
            type="number"
            min={1}
            value={data.seconds ?? ""}
            onChange={(e) =>
              onChange({ seconds: Number(e.target.value) || undefined })
            }
            placeholder="Ex: 3600 (1 hora)"
          />
          <p className="text-[11px] text-muted-foreground">
            O fluxo é retomado automaticamente após esse tempo.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Retomar em (data e hora)</Label>
          <Input
            type="datetime-local"
            value={data.untilAt ?? ""}
            onChange={(e) => onChange({ untilAt: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            Horário de Brasília (America/Sao_Paulo).
          </p>
        </div>
      )}
    </div>
  );
}

function MenuEditor({
  data,
  onChange,
}: {
  data: Partial<MenuNodeData>;
  onChange: (patch: Partial<MenuNodeData>) => void;
}) {
  const options: MenuOption[] = data.options ?? [];
  const renderAs = data.renderAs ?? "auto";
  const asList = renderAs === "list" || (renderAs === "auto" && options.length > 3);

  function addOption() {
    if (options.length >= 10) return;
    const handle = `opt-${nanoid(4)}`;
    onChange({ options: [...options, { handle, label: "" }] });
  }

  function removeOption(handle: string) {
    onChange({ options: options.filter((o) => o.handle !== handle) });
  }

  function updateOption(handle: string, patch: Partial<MenuOption>) {
    onChange({
      options: options.map((o) => (o.handle === handle ? { ...o, ...patch } : o)),
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Texto da mensagem</Label>
        <Textarea
          value={data.bodyText ?? ""}
          onChange={(e) => onChange({ bodyText: e.target.value })}
          placeholder="Ex: Como posso ajudar?"
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground">
          Use <code className="font-mono">{"{{variavel}}"}</code> para inserir valores capturados.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Exibir como</Label>
        <Select
          value={renderAs}
          onValueChange={(v) => onChange({ renderAs: v as MenuNodeData["renderAs"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (≤3 botões, &gt;3 lista)</SelectItem>
            <SelectItem value="buttons">Botões (máx. 3)</SelectItem>
            <SelectItem value="list">Lista (máx. 10)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {asList && (
        <div className="space-y-1">
          <Label className="text-xs">Texto do botão da lista</Label>
          <Input
            value={data.listButtonText ?? ""}
            onChange={(e) => onChange({ listButtonText: e.target.value })}
            placeholder="Ex: Escolher"
            maxLength={20}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Opções</Label>
        {options.map((opt, i) => (
          <div key={opt.handle} className="border rounded-md p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Opção {i + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeOption(opt.handle)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Input
              value={opt.label}
              onChange={(e) => updateOption(opt.handle, { label: e.target.value })}
              placeholder="Texto da opção"
              maxLength={asList ? 24 : 20}
            />
            {asList && (
              <Input
                value={opt.description ?? ""}
                onChange={(e) => updateOption(opt.handle, { description: e.target.value })}
                placeholder="Descrição (opcional)"
                maxLength={72}
                className="h-7 text-xs"
              />
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addOption}
          disabled={options.length >= 10}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar opção
        </Button>
        {!asList && options.length > 3 && (
          <p className="text-[11px] text-amber-600">
            Botões aceitam no máximo 3 opções. Mude para "Lista" ou remova opções.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Salvar opção escolhida em (opcional)</Label>
        <Input
          value={data.captureVariable ?? ""}
          onChange={(e) =>
            onChange({
              captureVariable: e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, "_"),
            })
          }
          placeholder="ex: opcao"
        />
        <p className="text-[11px] text-muted-foreground">
          Guarda o texto da opção; o índice fica em{" "}
          <code className="font-mono">{`{{${(data.captureVariable || "opcao")}_index}}`}</code>.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Conecte cada opção a um nó. Cada opção tem sua própria saída no fluxo.
      </p>
    </div>
  );
}

// ─── Tag color/emoji helpers (mesma lógica do conversations.tsx) ──────────────

const UMBLER_COLOR_MAP_BOT: Record<string, string> = {
  Aquamarine: "#14b8a6", Chocolate: "#92400e", Cyan: "#06b6d4",
  Gold: "#d97706", Grape: "#7c3aed", Gray: "#6b7280", Green: "#16a34a",
  Kiwi: "#84cc16", Magenta: "#ec4899", Pink: "#f472b6", Rose: "#e11d48",
  Salmon: "#f87171", Skyblue: "#38bdf8", Tangerine: "#f97316",
  Tomato: "#ef4444", Umblerito: "#5046e5",
};
const TAG_PALETTE_BOT = [
  "#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c","#3498db",
  "#9b59b6","#e91e63","#00bcd4","#8bc34a","#ff5722","#795548","#607d8b",
];

function resolveTagColorBot(color: string | null | undefined, id: string): string {
  if (color) {
    const mapped = UMBLER_COLOR_MAP_BOT[color];
    if (mapped) return mapped;
    if (color.startsWith("#")) return color;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TAG_PALETTE_BOT[hash % TAG_PALETTE_BOT.length];
}

function resolveTagEmojiBot(emoji: string | null | undefined): string | null {
  if (!emoji || emoji === "🐨") return null;
  return emoji;
}

// ─── Tag multi-select ─────────────────────────────────────────────────────────

function TagPill({ tag, onRemove }: { tag: TagOption; onRemove?: () => void }) {
  const bg = resolveTagColorBot(tag.color, tag.id);
  const emoji = resolveTagEmojiBot(tag.emoji);
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold text-white max-w-[160px]"
      style={{ backgroundColor: bg }}
      title={tag.name}
    >
      {emoji && <span className="shrink-0 leading-none">{emoji}</span>}
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          className="shrink-0 ml-0.5 opacity-70 hover:opacity-100 leading-none"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          ×
        </button>
      )}
    </span>
  );
}

function TagMultiSelect({
  tags,
  selectedIds,
  onToggle,
  label,
}: {
  tags: TagOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-h-8 px-3 py-1.5 rounded-md border border-input bg-background text-left hover:bg-accent transition-colors flex flex-wrap gap-1"
        >
          {selectedTags.length === 0 ? (
            <span className="text-xs text-muted-foreground">Selecionar etiquetas</span>
          ) : (
            selectedTags.map((t) => <TagPill key={t.id} tag={t} onRemove={() => onToggle(t.id)} />)
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-7 h-7 text-xs"
              placeholder="Pesquisar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-56">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">Nenhuma etiqueta encontrada.</p>
          ) : (
            <div className="p-1">
              {filtered.map((t) => {
                const checked = selectedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onToggle(t.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-sm hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(t.id)}
                      className="h-3.5 w-3.5 pointer-events-none shrink-0"
                    />
                    <TagPill tag={t} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="border-t p-2 text-[11px] text-muted-foreground">
            {selectedIds.length} selecionada(s)
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Condition field options (field selector dropdown) ────────────────────────

const CONDITION_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "contact_field",      label: "Campo do contato" },
  { value: "contact_active",     label: "O contato está ativo?" },
  { value: "contact_is_group",   label: "O contato é um grupo?" },
  { value: "tag",                label: "Etiquetas" },
  { value: "channel",            label: "Canal da conversa" },
  { value: "agent",              label: "Atendente da conversa" },
  { value: "agent_online",       label: "Presença do atendente" },
  { value: "first_conversation", label: "Primeira conversa?" },
  { value: "message_contains",   label: "Mensagem contém" },
  { value: "value",              label: "Valor" },
  { value: "parallel_bot",       label: "Bot paralelo em execução" },
];

const BOOLEAN_FIELDS = new Set([
  "contact_active",
  "contact_is_group",
  "first_conversation",
]);

function defaultOperatorFor(field: string): ConditionRule["operator"] {
  if (field === "tag") return "has_all";
  if (field === "agent_online") return "is_true";
  if (BOOLEAN_FIELDS.has(field)) return "is_true";
  if (field === "message_contains") return "contains";
  if (field === "channel") return "is_one_of";
  if (field === "agent") return "is_one_of";
  if (field === "value") return "contains";
  return "equals";
}

function ConditionRuleRow({
  rule,
  index,
  markerTags,
  agents,
  sectors,
  channels,
  bots,
  onChange,
  onRemove,
}: {
  rule: ConditionRule;
  index: number;
  markerTags: TagOption[];
  agents: AgentOption[];
  sectors: SectorOption[];
  channels: ChannelOption[];
  bots: BotOption[];
  onChange: (patch: Partial<ConditionRule>) => void;
  onRemove: () => void;
}) {
  const field = rule.field;

  function fieldSelector() {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">
          {index === 0 ? "Se:" : "E se:"}
        </span>
        <Select
          value={field}
          onValueChange={(v) =>
            onChange({ field: v as ConditionRule["field"], operator: defaultOperatorFor(v), value: undefined, subField: undefined })
          }
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_FIELD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {index > 0 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // ── Boolean fields ──────────────────────────────────────────────────────────
  if (BOOLEAN_FIELDS.has(field)) {
    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10">
          <Select
            value={rule.operator ?? "is_true"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="is_true" className="text-xs">É verdadeiro (sim)</SelectItem>
              <SelectItem value="is_false" className="text-xs">É falso (não)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // ── Presença do atendente ───────────────────────────────────────────────────
  if (field === "agent_online") {
    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10">
          <Select
            value={rule.operator ?? "is_true"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="is_true" className="text-xs">Online</SelectItem>
              <SelectItem value="is_false" className="text-xs">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // ── Etiquetas ───────────────────────────────────────────────────────────────
  if (field === "tag") {
    const selectedIds: string[] = rule.values ?? (rule.value ? [rule.value] : []);

    const toggleTag = (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange({ values: next, value: undefined });
    };

    const selectedLabels = selectedIds
      .map((id) => markerTags.find((t) => t.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <Select
            value={rule.operator ?? "has_all"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="has_all" className="text-xs">Existe todas e pode haver outras</SelectItem>
              <SelectItem value="has_none" className="text-xs">Não existe nenhuma destas</SelectItem>
              <SelectItem value="has_any" className="text-xs">Existe alguma</SelectItem>
              <SelectItem value="has_exactly" className="text-xs">Existem exatamente estas</SelectItem>
              <SelectItem value="not_has_exactly" className="text-xs">Não existem exatamente estas</SelectItem>
            </SelectContent>
          </Select>

          <TagMultiSelect
            tags={markerTags}
            selectedIds={selectedIds}
            onToggle={toggleTag}
            label={selectedLabels || "Selecionar etiquetas"}
          />
        </div>
      </div>
    );
  }

  // ── Setor da conversa ───────────────────────────────────────────────────────
  if (field === "sector") {
    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <Select
            value={rule.operator ?? "equals"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals" className="text-xs">É</SelectItem>
              <SelectItem value="not_equals" className="text-xs">Não é</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={rule.value ?? ""}
            onValueChange={(v) => onChange({ value: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // ── Atendente da conversa ───────────────────────────────────────────────────
  if (field === "agent") {
    const needsAgents = rule.operator === "is_one_of" || rule.operator === "is_none_of";
    const selectedIds: string[] = rule.values ?? (rule.value ? [rule.value] : []);

    const toggleAgent = (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange({ values: next });
    };

    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <Select
            value={rule.operator ?? "is_one_of"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"], values: [], value: undefined })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="is_one_of" className="text-xs">É um destes:</SelectItem>
              <SelectItem value="is_none_of" className="text-xs">Não é nenhum destes:</SelectItem>
              <SelectItem value="no_agent" className="text-xs">Conversa não está com atendente</SelectItem>
              <SelectItem value="is_online" className="text-xs">Está online</SelectItem>
              <SelectItem value="not_online" className="text-xs">Não está online</SelectItem>
            </SelectContent>
          </Select>
          {needsAgents && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full min-h-[32px] flex flex-wrap gap-1 items-center px-2 py-1 rounded-md border border-input bg-background text-left"
                >
                  {selectedIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Selecionar atendentes</span>
                  ) : (
                    agents
                      .filter((a) => selectedIds.includes(a.id))
                      .map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-violet-500 text-white"
                        >
                          {a.name}
                          <button
                            type="button"
                            className="ml-0.5 opacity-70 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); toggleAgent(a.id); }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="overflow-y-auto max-h-48 p-1">
                  {agents.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Nenhum atendente disponível.</p>
                  ) : (
                    agents.map((a) => {
                      const checked = selectedIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAgent(a.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleAgent(a.id)}
                            className="h-3.5 w-3.5 pointer-events-none shrink-0"
                          />
                          <span className="text-xs truncate">{a.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    );
  }

  // ── Bot paralelo em execução ─────────────────────────────────────────────────
  if (field === "parallel_bot") {
    const filterSpecific = rule.value !== undefined;
    const [search, setSearch] = useState("");
    const filtered = bots.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={filterSpecific}
              onClick={() => onChange({ value: filterSpecific ? undefined : "" })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${filterSpecific ? "bg-primary" : "bg-input"}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${filterSpecific ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
            <span className="text-xs">Filtrar por bot específico</span>
          </div>
          {filterSpecific && (
            <div className="space-y-1">
              <p className="text-xs font-medium">Bot monitorado</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-8 flex items-center px-3 rounded-md border border-input bg-background text-left text-xs"
                  >
                    {rule.value
                      ? (bots.find((b) => b.id === rule.value)?.name ?? "Selecione")
                      : "Selecione"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Pesquisar"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="overflow-y-auto max-h-48 p-1">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Nenhum bot encontrado.</p>
                    ) : (
                      filtered.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onChange({ value: b.id })}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent ${rule.value === b.id ? "bg-accent font-semibold" : ""}`}
                        >
                          {b.name}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Mensagem contém ─────────────────────────────────────────────────────────
  if (field === "message_contains") {
    const keywords: string[] = rule.values ?? (rule.value ? [rule.value] : []);
    const [kw, setKw] = useState("");

    const addKeyword = () => {
      const trimmed = kw.trim();
      if (!trimmed || keywords.includes(trimmed)) return;
      onChange({ values: [...keywords, trimmed], value: undefined, operator: "contains" });
      setKw("");
    };

    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <div className="flex gap-1">
            <Input
              className="h-8 text-xs flex-1"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              placeholder="Digite uma palavra-chave"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent text-sm font-semibold"
            >
              +
            </button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground border border-border"
                >
                  {k}
                  <button
                    type="button"
                    className="opacity-60 hover:opacity-100 leading-none"
                    onClick={() => onChange({ values: keywords.filter((x) => x !== k) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Campo do contato ────────────────────────────────────────────────────────
  if (field === "contact_field") {
    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <Select
            value={rule.subField ?? ""}
            onValueChange={(v) => onChange({ subField: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Qual campo?" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_FIELD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={rule.operator ?? "equals"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starts_with" className="text-xs">Começa com</SelectItem>
              <SelectItem value="ends_with" className="text-xs">Termina com</SelectItem>
              <SelectItem value="contains" className="text-xs">Contém</SelectItem>
              <SelectItem value="not_contains" className="text-xs">Não contém</SelectItem>
              <SelectItem value="equals" className="text-xs">Igual</SelectItem>
              <SelectItem value="not_equals" className="text-xs">Diferente</SelectItem>
              <SelectItem value="exists" className="text-xs">Existe</SelectItem>
              <SelectItem value="matches_regex" className="text-xs">Corresponde ao Regex</SelectItem>
            </SelectContent>
          </Select>
          {rule.operator !== "exists" && (
            <Input
              className="h-8 text-xs"
              value={rule.value ?? ""}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={rule.operator === "matches_regex" ? "Ex: ^[0-9]+$" : "Valor"}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Canal da conversa ────────────────────────────────────────────────────────
  if (field === "channel") {
    const needsChannels = rule.operator === "is_one_of" || rule.operator === "is_none_of";
    const selectedIds: string[] = rule.values ?? (rule.value ? [rule.value] : []);

    const toggleChannel = (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange({ values: next });
    };

    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <Select
            value={rule.operator ?? "is_one_of"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"], values: [], value: undefined })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="is_one_of" className="text-xs">É um destes:</SelectItem>
              <SelectItem value="is_none_of" className="text-xs">Não é nenhum destes:</SelectItem>
              <SelectItem value="is_attending" className="text-xs">Está atendendo</SelectItem>
              <SelectItem value="not_attending" className="text-xs">Não está atendendo</SelectItem>
            </SelectContent>
          </Select>
          {needsChannels && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full min-h-[32px] flex flex-wrap gap-1 items-center px-2 py-1 rounded-md border border-input bg-background text-left"
                >
                  {selectedIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Selecionar canais</span>
                  ) : (
                    channels
                      .filter((c) => selectedIds.includes(c.id))
                      .map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-500 text-white"
                        >
                          {c.name || c.phoneNumber || c.id}
                          <button
                            type="button"
                            className="ml-0.5 opacity-70 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); toggleChannel(c.id); }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="overflow-y-auto max-h-48 p-1">
                  {channels.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Nenhum canal disponível.</p>
                  ) : (
                    channels.map((c) => {
                      const checked = selectedIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleChannel(c.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleChannel(c.id)}
                            className="h-3.5 w-3.5 pointer-events-none shrink-0"
                          />
                          <span className="text-xs truncate">{c.name || c.phoneNumber || c.id}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    );
  }

  // ── Valor ────────────────────────────────────────────────────────────────────
  if (field === "value") {
    const noValueOps = new Set(["exists", "is_empty"]);
    return (
      <div className="space-y-2">
        {fieldSelector()}
        <div className="ml-10 space-y-1.5">
          <Input
            className="h-8 text-xs"
            value={rule.subField ?? ""}
            onChange={(e) => onChange({ subField: e.target.value })}
            placeholder="Nome do campo"
          />
          <Select
            value={rule.operator ?? "contains"}
            onValueChange={(v) => onChange({ operator: v as ConditionRule["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals" className="text-xs">Igual</SelectItem>
              <SelectItem value="not_equals" className="text-xs">Diferente</SelectItem>
              <SelectItem value="contains" className="text-xs">Contém</SelectItem>
              <SelectItem value="not_contains" className="text-xs">Não contém</SelectItem>
              <SelectItem value="starts_with" className="text-xs">Começa com</SelectItem>
              <SelectItem value="ends_with" className="text-xs">Termina com</SelectItem>
              <SelectItem value="matches_regex" className="text-xs">Corresponde ao Regex</SelectItem>
              <SelectItem value="exists" className="text-xs">Não está vazio</SelectItem>
              <SelectItem value="is_empty" className="text-xs">Está vazio</SelectItem>
            </SelectContent>
          </Select>
          {!noValueOps.has(rule.operator ?? "") && (
            <Input
              className="h-8 text-xs"
              value={rule.value ?? ""}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={rule.operator === "matches_regex" ? "Ex: ^[0-9]+$" : "Valor do campo"}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {fieldSelector()}
      <div className="ml-10 space-y-1.5">
        <Input
          className="h-8 text-xs"
          value={rule.value ?? ""}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Valor"
        />
      </div>
    </div>
  );
}

function TriggerFlowEditor({
  data,
  onChange,
}: {
  data: Partial<TriggerFlowNodeData>;
  onChange: (patch: Partial<TriggerFlowNodeData>) => void;
}) {
  const { data: bots = [] } = useWhatsappBots();
  const { data: targetFlow } = useWhatsappBotFlow(data.targetBotId ?? "");

  const targetNodes = (targetFlow?.nodes ?? []).filter(
    (n) => n.type === "start" || (n.data as { label?: string })?.label,
  );

  const selectedBot = bots.find((b) => b.id === data.targetBotId);
  const selectedNode = targetNodes.find((n) => n.id === data.targetNodeId);

  const pathLabel = selectedBot
    ? `${selectedBot.name}${selectedNode ? ` → ${(selectedNode.data as { label?: string })?.label ?? "Início"}` : ""}`
    : null;

  const toggles: { key: keyof TriggerFlowNodeData; label: string }[] = [
    { key: "scheduleExecution", label: "Agendar acionamento" },
    { key: "executeOnCurrentChannel", label: "Executar chatbot no canal atual" },
    { key: "executeParallel", label: "Executar fluxo de forma paralela" },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Caminho</Label>
        {/* Bot selector */}
        <Select
          value={data.targetBotId ?? ""}
          onValueChange={(v) => onChange({ targetBotId: v, targetNodeId: undefined })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar fluxo..." />
          </SelectTrigger>
          <SelectContent>
            {bots.map((b) => (
              <SelectItem key={b.id} value={b.id} className="text-xs">
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Node selector — só aparece quando bot selecionado */}
        {data.targetBotId && targetNodes.length > 0 && (
          <Select
            value={data.targetNodeId ?? ""}
            onValueChange={(v) => onChange({ targetNodeId: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Nó de entrada (opcional)..." />
            </SelectTrigger>
            <SelectContent>
              {targetNodes.map((n) => (
                <SelectItem key={n.id} value={n.id} className="text-xs">
                  {(n.data as { label?: string })?.label ?? "Início"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Preview do caminho */}
        {pathLabel && (
          <div className="flex items-center gap-1.5 rounded-md border border-input bg-muted px-3 py-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{pathLabel}</span>
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        {toggles.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={!!data[key]}
              onClick={() => onChange({ [key]: !data[key] })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                data[key] ? "bg-blue-500" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                  data[key] ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: { text?: string; type?: string }[];
  example?: { header_handle?: string[]; header_text?: string[] };
};

function extractTemplateHeader(
  template: import("@/hooks/use-whatsapp").MetaTemplate,
): { format: string; url?: string } | null {
  const comp = template.components as TemplateComponent[];
  const header = comp?.find((c) => c.type === "HEADER");
  if (!header || !header.format || header.format === "TEXT") return null;
  const url = header.example?.header_handle?.[0];
  return { format: header.format, url };
}

function extractTemplateBody(template: import("@/hooks/use-whatsapp").MetaTemplate): string | null {
  const comp = template.components as TemplateComponent[];
  const body = comp?.find((c) => c.type === "BODY");
  return body?.text ?? null;
}

const CLIENT_VARIABLES = [
  { label: "Nome", value: "{{nome}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Telefone", value: "{{telefone}}" },
  { label: "CPF", value: "{{cpf}}" },
  { label: "Cidade", value: "{{cidade}}" },
  { label: "Estado", value: "{{estado}}" },
  { label: "Aniversário", value: "{{aniversario}}" },
];

function countTemplateVars(text: string | null | undefined): number {
  if (!text) return 0;
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) ?? [];
  let max = 0;
  for (const m of matches) {
    const n = parseInt(m.replace(/\D/g, ""), 10);
    if (n > max) max = n;
  }
  return max;
}

function applyTemplateVars(text: string, params: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, d: string) => {
    const value = params[parseInt(d, 10) - 1];
    return value && value.length > 0 ? value : `{{${d}}}`;
  });
}

function TemplatePreview({ template }: { template: import("@/hooks/use-whatsapp").MetaTemplate }) {
  const header = extractTemplateHeader(template);
  const body = extractTemplateBody(template);
  const comp = template.components as TemplateComponent[];
  const btnComp = comp?.find((c) => c.type === "BUTTONS");
  const buttons = btnComp?.buttons?.filter((b) => b.type === "QUICK_REPLY") ?? [];

  return (
    <div className="rounded-lg border bg-[#e5ddd5] overflow-hidden text-[11px]">
      {/* Header media */}
      {header && (
        <div className="bg-[#d1c4b2] flex items-center justify-center" style={{ minHeight: 100 }}>
          {header.format === "IMAGE" && header.url ? (
            <img
              src={header.url}
              alt="Header"
              className="w-full object-cover max-h-40"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextSibling as HTMLElement)?.removeAttribute("style");
              }}
            />
          ) : null}
          {header.format === "IMAGE" && !header.url && (
            <div className="flex flex-col items-center gap-1 py-4 text-[#5a5a5a]">
              <ImageIcon className="h-8 w-8 opacity-50" />
              <span className="text-[10px] opacity-60">Imagem</span>
            </div>
          )}
          {header.format === "VIDEO" && (
            <div className="flex flex-col items-center gap-1 py-4 text-[#5a5a5a]">
              <FileVideo className="h-8 w-8 opacity-50" />
              <span className="text-[10px] opacity-60">Vídeo</span>
            </div>
          )}
          {header.format === "DOCUMENT" && (
            <div className="flex flex-col items-center gap-1 py-4 text-[#5a5a5a]">
              <FileTextIcon className="h-8 w-8 opacity-50" />
              <span className="text-[10px] opacity-60">Documento</span>
            </div>
          )}
        </div>
      )}
      {/* Bubble */}
      <div className="bg-white rounded-br-lg rounded-bl-lg mx-1 mb-1 mt-1 p-2 shadow-sm">
        {body && (
          <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed">{body}</p>
        )}
        {buttons.length > 0 && (
          <div className="border-t border-gray-200 mt-2 pt-1.5 space-y-1">
            {buttons.map((b, i) => (
              <div key={i} className="text-center text-blue-500 font-medium py-0.5 border-t border-gray-100 first:border-t-0">
                {b.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendTemplateEditor({
  data,
  onChange,
  metaTemplates,
}: {
  data: Partial<SendTemplateNodeData>;
  onChange: (patch: Partial<SendTemplateNodeData>) => void;
  metaTemplates: import("@/hooks/use-whatsapp").MetaTemplate[];
}) {
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const { toast } = useToast();

  const selected = metaTemplates.find((t) => t.name === data.metaTemplateName);

  function extractButtons(template: import("@/hooks/use-whatsapp").MetaTemplate): SendTemplateButtonHandle[] {
    const comp = template.components as TemplateComponent[];
    const btnComp = comp?.find((c) => c.type === "BUTTONS");
    if (!btnComp?.buttons) return [];
    return btnComp.buttons
      .filter((b) => b.type === "QUICK_REPLY")
      .map((b, i) => ({ handle: `btn-${i}`, label: b.text ?? `Botão ${i + 1}` }));
  }

  function pickTemplate(t: import("@/hooks/use-whatsapp").MetaTemplate) {
    const buttons = extractButtons(t);
    const bodyText = extractTemplateBody(t);
    const varCount = countTemplateVars(bodyText);
    const header = extractTemplateHeader(t);
    const headerType = header?.format?.toLowerCase() as "image" | "video" | "document" | undefined;
    onChange({
      metaTemplateName: t.name,
      metaTemplateLanguage: t.language,
      templateParams: Array(varCount).fill(""),
      templateHeaderMedia: undefined,
      headerMediaType: headerType && ["image", "video", "document"].includes(headerType) ? headerType : undefined,
      buttonHandles: buttons,
    });
    setShowPicker(false);
  }

  const buttons = data.buttonHandles ?? [];

  return (
    <div className="space-y-4 p-4">
      {/* Preview do template selecionado */}
      {selected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{selected.name}</p>
              <p className="text-[11px] text-muted-foreground">{selected.language}</p>
            </div>
          </div>
          <TemplatePreview template={selected} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum template selecionado</p>
      )}

      {/* Picker */}
      {showPicker ? (
        <div className="space-y-1.5 border rounded-md overflow-hidden">
          <div className="p-2 border-b">
            <Input
              className="h-7 text-xs"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48 p-1">
            {metaTemplates
              .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-sm text-xs hover:bg-accent transition-colors",
                    data.metaTemplateName === t.name && "bg-accent font-medium",
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-1.5 text-[10px] text-muted-foreground">{t.language}</span>
                </button>
              ))}
            {metaTemplates.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Nenhum template aprovado.</p>
            )}
          </div>
          <div className="border-t p-2">
            <button type="button" onClick={() => setShowPicker(false)} className="text-xs text-muted-foreground hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowPicker(true)}>
          {data.metaTemplateName ? "Alterar template" : "Selecionar template"}
        </Button>
      )}

      {/* Header de mídia */}
      {data.headerMediaType && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">
            {data.headerMediaType === "image" ? "Imagem" : data.headerMediaType === "video" ? "Vídeo" : "Documento"} do header
          </p>
          {data.templateHeaderMedia?.storageKey ? (
            data.templateHeaderMedia.type === "image" ? (
              <div className="relative rounded-md border bg-muted/30 overflow-hidden">
                <img
                  src={`https://eventos.grandcrub2b.com/${data.templateHeaderMedia.storageKey}`}
                  alt={data.templateHeaderMedia.name ?? "imagem"}
                  className="w-full max-h-40 object-cover rounded-md"
                />
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAttachOpen(true)}
                    className="bg-black/60 hover:bg-black/80 text-white rounded-full px-2 py-0.5 text-[10px] transition-colors"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ templateHeaderMedia: undefined })}
                    className="bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border bg-muted/30">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{data.templateHeaderMedia.name ?? "arquivo"}</span>
                <button
                  type="button"
                  onClick={() => setAttachOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ templateHeaderMedia: undefined })}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setAttachOpen(true)}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Escolher arquivo
            </Button>
          )}

          <AttachFileDialog
            open={attachOpen}
            onOpenChange={setAttachOpen}
            lockedType={data.headerMediaType}
            accept={
              data.headerMediaType === "video"
                ? "video/*"
                : data.headerMediaType === "document"
                  ? "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  : "image/*"
            }
            onAttach={(item: MediaLibraryItem) => {
              onChange({
                templateHeaderMedia: {
                  storageKey: item.storageKey,
                  type: data.headerMediaType!,
                  name: item.name,
                  mimeType: item.mimeType,
                },
              });
              setAttachOpen(false);
            }}
          />
        </div>
      )}

      {/* Variáveis do template */}
      {selected && (data.templateParams ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Variáveis do template:</p>
          {(data.templateParams ?? []).map((value, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-muted-foreground font-mono">
                  {"{{"}
                  {i + 1}
                  {"}}"}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <User className="h-3 w-3" />
                      Inserir dado
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
                    {CLIENT_VARIABLES.map((v) => (
                      <DropdownMenuItem
                        key={v.value}
                        onClick={() => {
                          const next = [...(data.templateParams ?? [])];
                          next[i] = v.value;
                          onChange({ templateParams: next });
                        }}
                      >
                        <span className="text-xs">{v.label}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                          {v.value}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Input
                className="h-7 text-xs"
                value={value}
                onChange={(e) => {
                  const next = [...(data.templateParams ?? [])];
                  next[i] = e.target.value;
                  onChange({ templateParams: next });
                }}
                placeholder="Texto fixo ou {{nome}}, {{email}}..."
              />
            </div>
          ))}
          {(() => {
            const bodyText = extractTemplateBody(selected);
            const preview = applyTemplateVars(bodyText ?? "", data.templateParams ?? []);
            return bodyText !== preview ? (
              <div className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                {preview}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Ações dos botões */}
      {buttons.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Ações dos botões:</p>
          <div className="space-y-1">
            {buttons.map((btn) => (
              <div key={btn.handle} className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                <span className="truncate">{btn.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-blue-400">→ saída</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opções extras */}
      <div className="space-y-2">
        <p className="text-xs font-medium">Ativar fluxo se:</p>
        {[
          { key: "invalidResponseHandle" as const, label: "Resposta inválida" },
          { key: "noResponseHandle" as const, label: "Contato não responder" },
          { key: "notDeliveredHandle" as const, label: "Mensagem não for entregue" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 cursor-pointer"
              checked={!!data[key]}
              onChange={(e) => onChange({ [key]: e.target.checked })}
            />
            <span className="text-xs">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditTagsEditor({
  data,
  onChange,
  markerTags,
}: {
  data: Partial<EditTagsNodeData>;
  onChange: (patch: Partial<EditTagsNodeData>) => void;
  markerTags: TagOption[];
}) {
  const mode = data.mode ?? "add";
  const tagIds = data.tagIds ?? [];

  return (
    <div className="space-y-3 p-4">
      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-input">
        <button
          type="button"
          onClick={() => onChange({ mode: "add" })}
          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${mode === "add" ? "bg-blue-500 text-white" : "bg-background text-muted-foreground hover:bg-accent"}`}
        >
          Adicionar
        </button>
        <button
          type="button"
          onClick={() => onChange({ mode: "remove" })}
          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${mode === "remove" ? "bg-gray-700 text-white" : "bg-background text-muted-foreground hover:bg-accent"}`}
        >
          Remover
        </button>
      </div>

      {/* Tag selector */}
      <TagMultiSelect
        tags={markerTags}
        selectedIds={tagIds}
        onToggle={(id) => {
          const next = tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id];
          onChange({ tagIds: next });
        }}
        label="Selecionar etiquetas"
      />

      {/* Selected pills */}
      {tagIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {markerTags
            .filter((t) => tagIds.includes(t.id))
            .map((t) => (
              <TagPill
                key={t.id}
                tag={t}
                onRemove={() => onChange({ tagIds: tagIds.filter((x) => x !== t.id) })}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function DistributeFlowEditor({
  data,
  onChange,
}: {
  data: Partial<DistributeFlowNodeData>;
  onChange: (patch: Partial<DistributeFlowNodeData>) => void;
}) {
  const outputs: DistributeFlowOutput[] = data.outputs ?? [];

  function redistribute(outputs: DistributeFlowOutput[], changedIndex: number, newPct: number): DistributeFlowOutput[] {
    const clamped = Math.max(0, Math.min(100, newPct));
    const next = outputs.map((o, i) => i === changedIndex ? { ...o, percentage: clamped } : o);
    const lockedTotal = next.filter((o, i) => o.locked || i === changedIndex).reduce((s, o) => s + o.percentage, 0);
    const unlocked = next.filter((o, i) => !o.locked && i !== changedIndex);
    const remaining = Math.max(0, 100 - lockedTotal);
    if (unlocked.length === 0) return next;
    const each = Math.floor(remaining / unlocked.length);
    let leftover = remaining - each * unlocked.length;
    let ui = 0;
    return next.map((o, i) => {
      if (o.locked || i === changedIndex) return o;
      const bonus = leftover > 0 ? 1 : 0;
      leftover -= bonus;
      ui++;
      return { ...o, percentage: each + bonus };
    });
  }

  function addOutput() {
    const newOut: DistributeFlowOutput = { handle: `out-${nanoid(4)}`, percentage: 0, locked: false };
    const withNew = [...outputs, newOut];
    // distribute equally among unlocked
    const unlocked = withNew.filter((o) => !o.locked);
    const lockedTotal = withNew.filter((o) => o.locked).reduce((s, o) => s + o.percentage, 0);
    const each = Math.floor(Math.max(0, 100 - lockedTotal) / unlocked.length);
    let leftover = Math.max(0, 100 - lockedTotal) - each * unlocked.length;
    const result = withNew.map((o) => {
      if (o.locked) return o;
      const bonus = leftover > 0 ? 1 : 0;
      leftover -= bonus;
      return { ...o, percentage: each + bonus };
    });
    onChange({ outputs: result });
  }

  function removeOutput(index: number) {
    const next = outputs.filter((_, i) => i !== index);
    if (next.length === 0) { onChange({ outputs: next }); return; }
    // redistribute removed percentage among unlocked
    const removed = outputs[index].percentage;
    const unlocked = next.filter((o) => !o.locked);
    if (unlocked.length === 0) { onChange({ outputs: next }); return; }
    const each = Math.floor(removed / unlocked.length);
    let leftover = removed - each * unlocked.length;
    const result = next.map((o) => {
      if (o.locked) return o;
      const bonus = leftover > 0 ? 1 : 0;
      leftover -= bonus;
      return { ...o, percentage: o.percentage + each + bonus };
    });
    onChange({ outputs: result });
  }

  function toggleLock(index: number) {
    onChange({ outputs: outputs.map((o, i) => i === index ? { ...o, locked: !o.locked } : o) });
  }

  return (
    <div className="space-y-3 p-4">
      <div className="space-y-3">
        {outputs.map((out, i) => (
          <div key={out.handle} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleLock(i)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title={out.locked ? "Desbloquear" : "Bloquear"}
            >
              {out.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={out.percentage}
              onChange={(e) => onChange({ outputs: redistribute(outputs, i, Number(e.target.value)) })}
              className="flex-1 accent-violet-500 cursor-pointer"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={out.percentage}
              onChange={(e) => onChange({ outputs: redistribute(outputs, i, Number(e.target.value)) })}
              className="w-14 h-7 text-xs text-center rounded-md border border-input bg-background font-semibold"
            />
            <span className="text-xs text-muted-foreground shrink-0">%</span>
            {outputs.length > 2 && (
              <button
                type="button"
                onClick={() => removeOutput(i)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addOutput}
        className="text-xs text-primary hover:underline"
      >
        + Saída
      </button>

      <p className="text-[11px] text-muted-foreground">
        Total: {outputs.reduce((s, o) => s + o.percentage, 0)}%
        {outputs.reduce((s, o) => s + o.percentage, 0) !== 100 && (
          <span className="text-destructive ml-1">(deve somar 100%)</span>
        )}
      </p>
    </div>
  );
}

function TransferAgentEditor({
  data,
  onChange,
  agents,
}: {
  data: Partial<TransferAgentNodeData>;
  onChange: (patch: Partial<TransferAgentNodeData>) => void;
  agents: AgentOption[];
}) {
  const rule = data.rule ?? "specific";

  return (
    <div className="space-y-3 p-4">
      {/* Regra */}
      <div className="space-y-1.5">
        <Label className="text-xs">Regra</Label>
        <Select
          value={rule}
          onValueChange={(v) => onChange({ rule: v as TransferAgentNodeData["rule"], agentId: undefined })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="specific" className="text-xs">Específico</SelectItem>
            <SelectItem value="previous_conversation" className="text-xs">Atendente da conversa anterior</SelectItem>
            <SelectItem value="previous_same_conversation" className="text-xs">Atendente anterior na mesma conversa</SelectItem>
            <SelectItem value="any_available" className="text-xs">Qualquer disponível</SelectItem>
            <SelectItem value="random" className="text-xs">Aleatório</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Atendente específico */}
      {rule === "specific" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Atendente</Label>
          <Select
            value={data.agentId ?? ""}
            onValueChange={(v) => onChange({ agentId: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione o atendente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Toggle: somente se tem permissão */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={!!data.onlyIfCurrentHasPermission}
          onClick={() => onChange({ onlyIfCurrentHasPermission: !data.onlyIfCurrentHasPermission })}
          className={`relative inline-flex h-5 w-9 shrink-0 mt-0.5 cursor-pointer rounded-full border-2 border-transparent transition-colors ${data.onlyIfCurrentHasPermission ? "bg-primary" : "bg-input"}`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${data.onlyIfCurrentHasPermission ? "translate-x-4" : "translate-x-0"}`} />
        </button>
        <span className="text-xs leading-snug">Transferir somente se atendente atual tem permissão</span>
      </div>

      {/* Checkbox: ativar fluxo se falhar */}
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
          checked={!!data.activateFlowIfFailed}
          onChange={(e) => onChange({ activateFlowIfFailed: e.target.checked })}
        />
        <span className="text-xs leading-snug">Ativar fluxo se não for possível transferir para o atendente</span>
      </div>
    </div>
  );
}

function EndConversationEditor({
  data,
  onChange,
  agents,
}: {
  data: Partial<EndConversationNodeData>;
  onChange: (patch: Partial<EndConversationNodeData>) => void;
  agents: AgentOption[];
}) {
  const CLOSED_BY_OPTIONS = [
    { value: "owner", label: "Dono do chat" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  const selected = CLOSED_BY_OPTIONS.find((o) => o.value === data.closedBy);

  return (
    <div className="space-y-3 p-4">
      <div className="space-y-1.5">
        <p className="text-xs font-medium">É fechado por:</p>
        <div className="flex flex-wrap gap-1.5">
          {selected && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-semibold">
              {selected.label}
              <button
                type="button"
                className="ml-0.5 opacity-70 hover:opacity-100"
                onClick={() => onChange({ closedBy: undefined })}
              >
                ×
              </button>
            </span>
          )}
        </div>
        <Select
          value={data.closedBy ?? ""}
          onValueChange={(v) => onChange({ closedBy: v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione quem encerra" />
          </SelectTrigger>
          <SelectContent>
            {CLOSED_BY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ConditionEditor({
  data,
  onChange,
  markerTags,
  agents,
  sectors,
  channels,
  bots,
}: {
  data: Partial<ConditionNodeData>;
  onChange: (patch: Partial<ConditionNodeData>) => void;
  markerTags: TagOption[];
  agents: AgentOption[];
  sectors: SectorOption[];
  channels: ChannelOption[];
  bots: BotOption[];
}) {
  const rules: ConditionRule[] = data.rules ?? [];
  const hasEmptyField = rules.some((r) => !r.field);

  function addRule() {
    onChange({ rules: [...rules, { field: "tag", operator: "has_all" }] });
  }

  function removeRule(index: number) {
    onChange({ rules: rules.filter((_, i) => i !== index) });
  }

  function updateRule(index: number, patch: Partial<ConditionRule>) {
    onChange({
      rules: rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }

  return (
    <div className="space-y-4">
      {/* Group name */}
      <Input
        value={data.groupLabel ?? ""}
        onChange={(e) => onChange({ groupLabel: e.target.value })}
        placeholder="Nome do grupo de condições"
        className="text-sm"
      />

      {/* Condition rows */}
      <div className="space-y-4">
        {rules.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma condição adicionada. Clique em "+ Adicionar condição" para começar.
          </p>
        )}
        {rules.map((rule, i) => (
          <ConditionRuleRow
            key={i}
            rule={rule}
            index={i}
            markerTags={markerTags}
            agents={agents}
            sectors={sectors}
            channels={channels}
            bots={bots}
            onChange={(patch) => updateRule(i, patch)}
            onRemove={() => removeRule(i)}
          />
        ))}
      </div>

      {/* Add condition link */}
      <button
        type="button"
        onClick={addRule}
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
        Adicionar condição
      </button>

      {/* Senão block */}
      <div className="rounded-md border border-dashed border-muted-foreground/30 px-3 py-2.5 text-center">
        <p className="text-xs text-muted-foreground">
          Senão → saída <span className="text-red-500 font-medium">Não atende nenhuma</span>
        </p>
      </div>

      {/* Validation hint */}
      {hasEmptyField && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          É necessário definir um tipo de condição para cada uma das condições.
        </p>
      )}
    </div>
  );
}

// ─── Bot Simulator ────────────────────────────────────────────────────────────

type SimMessage = { role: "bot" | "user" | "system"; text: string };

function nodePreview(node: FlowNode): string {
  if (node.type === "send_message") {
    const d = node.data as SendMessageNodeData;
    if (d.messageType === "template") return `[Template: ${d.metaTemplateName ?? "—"}]`;
    const attachLabel = d.attachment
      ? `[${d.attachment.type === "image" ? "Imagem" : "Documento"}: ${d.attachment.name ?? ""}]`
      : "";
    if (attachLabel && !d.text) return attachLabel;
    if (attachLabel && d.text) return `${d.text}\n${attachLabel}`;
    return d.text ?? "(mensagem vazia)";
  }
  if (node.type === "flow_form") {
    const d = node.data as FlowFormNodeData;
    return `[Formulário: ${d.flowName || d.flowId || "—"}] ${d.ctaText ? `— "${d.ctaText}"` : ""}`;
  }
  if (node.type === "menu") {
    const d = node.data as MenuNodeData;
    const opts = (d.options ?? [])
      .map((o, i) => `${i + 1}. ${o.label || `Opção ${i + 1}`}`)
      .join("\n");
    return `${d.bodyText ?? ""}${opts ? `\n${opts}` : ""}`.trim() || "(menu vazio)";
  }
  return "";
}

function resolveSimHandle(node: FlowNode, text: string): string {
  const d = node.data as ConditionNodeData;
  const t = text.toLowerCase().trim();
  for (const branch of d.branches ?? []) {
    for (const kw of branch.keywords ?? []) {
      if (kw && t.includes(kw.toLowerCase().trim())) return branch.handle;
    }
  }
  return d.defaultHandle ?? "default";
}

function resolveMenuSimHandle(node: FlowNode, text: string): string | null {
  const d = node.data as MenuNodeData;
  const t = text.toLowerCase().trim();
  const byLabel = (d.options ?? []).find(
    (o) => o.label.toLowerCase().trim() === t,
  );
  return byLabel?.handle ?? null;
}

const ACTION_SIM_LABELS: Record<string, string> = {
  add_tag: "Adicionar tag",
  edit_tags: "Editar etiquetas",
  assign_agent: "Transferir p/ atendente",
  transfer_sector: "Transferir p/ setor",
  notify_agent: "Notificar atendente",
  create_note: "Criar nota interna",
  set_waiting: "Status esperando",
  set_contact_field: "Gravar campo do contato",
  end_conversation: "Encerrar conversa",
};

function BotSimulator({
  open,
  onOpenChange,
  nodes,
  edges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FlowNode[];
  edges: FlowEdge[];
}) {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState("");
  const [waitingNodeId, setWaitingNodeId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const nextNode = useCallback(
    (nodeId: string, handle?: string): FlowNode | null => {
      const outgoing = edges.filter((e) => e.source === nodeId);
      const edge =
        (handle && outgoing.find((e) => e.sourceHandle === handle)) ||
        outgoing[0];
      if (!edge) return null;
      return nodeById.get(edge.target) ?? null;
    },
    [edges, nodeById],
  );

  // Avança o fluxo a partir de um nó até parar numa pergunta ou no fim.
  const runFrom = useCallback(
    (start: FlowNode | null, userText: string | undefined, acc: SimMessage[]) => {
      let current = start;
      let guard = 0;
      while (current && guard++ < 100) {
        if (current.type === "start") {
          current = nextNode(current.id);
        } else if (current.type === "send_message") {
          acc.push({ role: "bot", text: nodePreview(current) });
          current = nextNode(current.id);
        } else if (
          current.type === "flow_form" ||
          current.type === "menu"
        ) {
          acc.push({ role: "bot", text: nodePreview(current) });
          setMessages([...acc]);
          setWaitingNodeId(current.id);
          return;
        } else if (current.type === "condition") {
          const handle = resolveSimHandle(current, userText ?? "");
          current = nextNode(current.id, handle);
        } else if (current.type === "action") {
          const at = (current.data as ActionNodeData).actionType;
          acc.push({ role: "system", text: `Ação: ${ACTION_SIM_LABELS[at] ?? at}` });
          if (at === "end_conversation") {
            setMessages([...acc]);
            setWaitingNodeId(null);
            setDone(true);
            return;
          }
          current = nextNode(current.id);
        } else if (current.type === "wait") {
          const w = current.data as WaitNodeData;
          const desc =
            w.mode === "until"
              ? `até ${w.untilAt ?? "(data não definida)"}`
              : `${w.seconds ?? 0}s`;
          acc.push({ role: "system", text: `⏳ Aguardando ${desc}` });
          current = nextNode(current.id);
        } else if (current.type === "end") {
          acc.push({ role: "system", text: "— Conversa encerrada —" });
          setMessages([...acc]);
          setWaitingNodeId(null);
          setDone(true);
          return;
        } else {
          current = nextNode(current.id);
        }
      }
      // Sem mais nós conectados.
      setMessages([...acc]);
      setWaitingNodeId(null);
      setDone(true);
    },
    [nextNode],
  );

  const restart = useCallback(() => {
    setInput("");
    setDone(false);
    setWaitingNodeId(null);
    const startNode = nodes.find((n) => n.type === "start");
    if (!startNode) {
      setMessages([{ role: "system", text: "Nenhum nó de início encontrado." }]);
      setDone(true);
      return;
    }
    runFrom(startNode, undefined, []);
  }, [nodes, runFrom]);

  // Reinicia a simulação sempre que o diálogo abre.
  useEffect(() => {
    if (open) restart();
  }, [open, restart]);

  function handleSend() {
    const text = input.trim();
    if (!text || !waitingNodeId) return;
    const acc = [...messages, { role: "user" as const, text }];
    setMessages(acc);
    setInput("");
    const waitingNode = nodeById.get(waitingNodeId);
    const handle =
      waitingNode?.type === "menu"
        ? resolveMenuSimHandle(waitingNode, text) ?? undefined
        : undefined;
    const afterQuestion = nextNode(waitingNodeId, handle);
    setWaitingNodeId(null);
    runFrom(afterQuestion, text, acc);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-green-500" />
            Testar fluxo
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[420px] rounded-lg border bg-muted/30">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : m.role === "system" ? "justify-center" : "justify-start",
                )}
              >
                {m.role === "system" ? (
                  <span className="text-[11px] text-muted-foreground italic px-2 py-1">
                    {m.text}
                  </span>
                ) : (
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-white dark:bg-slate-800 border rounded-bl-sm",
                    )}
                  >
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            {done && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={restart}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reiniciar
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                waitingNodeId ? "Digite a resposta do contato..." : done ? "Conversa encerrada" : "Aguardando..."
              }
              disabled={!waitingNodeId}
            />
            <Button size="icon" onClick={handleSend} disabled={!waitingNodeId || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Simulação local — nenhuma mensagem é enviada de verdade. Reflete o fluxo atual (salvo ou não).
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function BotEditor() {
  const params = useParams<{ id: string }>();
  const botId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: flow, isLoading } = useWhatsappBotFlow(botId);
  const saveFlowMutation = useSaveFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [showMobileProps, setShowMobileProps] = useState(false);

  useEffect(() => {
    if (flow && !initialized) {
      const initialNodes = flow.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.positionX, y: n.positionY },
        data: { ...(n.data as BotNodeData), label: n.label },
        deletable: n.type !== "start", // o nó de início não pode ser removido
      })) as FlowNode[];

      const initialEdges: FlowEdge[] = flow.edges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        sourceHandle: e.sourceHandle ?? undefined,
        label: e.label ?? undefined,
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);
      setInitialized(true);
    }
  }, [flow, initialized, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, id: `edge-${nanoid(6)}` }, eds),
      ),
    [setEdges],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  function addNode(type: string) {
    const id = `${type}-${nanoid(6)}`;
    const labelMap: Record<string, string> = {
      send_message: "Enviar Mensagem",
      menu: "Menu (opções)",
      condition: "Condição",
      action: "Ação",
      wait: "Aguardar",
      flow_form: "Formulário WA",
      transfer_agent: "Transferir p/ atendente",
      distribute_flow: "Distribuir fluxo",
      edit_tags: "Editar etiquetas",
      send_template: "Enviar template",
      trigger_flow: "Acionar outro fluxo",
      end_conversation: "Finalizar conversa",
      end: "Fim",
    };
    const defaultData: Partial<BotNodeData & { label: string }> = {
      label: labelMap[type] ?? type,
    };
    if (type === "condition") {
      (defaultData as Partial<ConditionNodeData>).mode = "reply";
      (defaultData as Partial<ConditionNodeData>).branches = [];
      (defaultData as Partial<ConditionNodeData>).defaultHandle = "no_match";
    }
    if (type === "menu") {
      (defaultData as Partial<MenuNodeData>).bodyText = "";
      (defaultData as Partial<MenuNodeData>).options = [];
      (defaultData as Partial<MenuNodeData>).renderAs = "auto";
    }
    if (type === "send_message") {
      (defaultData as Partial<SendMessageNodeData>).messageType = "text";
    }
    if (type === "action") {
      (defaultData as Partial<ActionNodeData>).actionType = "edit_tags";
    }
    if (type === "wait") {
      (defaultData as Partial<WaitNodeData>).mode = "interval";
      (defaultData as Partial<WaitNodeData>).seconds = 3600;
    }
    if (type === "flow_form") {
      (defaultData as Partial<FlowFormNodeData>).ctaText = "Preencher formulário";
    }
    if (type === "transfer_agent") {
      (defaultData as Partial<TransferAgentNodeData>).rule = "specific";
    }
    if (type === "send_template") {
      (defaultData as Partial<SendTemplateNodeData>).buttonHandles = [];
    }
    if (type === "trigger_flow") {
      const d = defaultData as Partial<TriggerFlowNodeData>;
      d.executeOnCurrentChannel = true;
    }
    if (type === "edit_tags") {
      (defaultData as Partial<EditTagsNodeData>).mode = "add";
      (defaultData as Partial<EditTagsNodeData>).tagIds = [];
    }
    if (type === "distribute_flow") {
      (defaultData as Partial<DistributeFlowNodeData>).outputs = [
        { handle: `out-${nanoid(4)}`, percentage: 50, locked: false },
        { handle: `out-${nanoid(4)}`, percentage: 50, locked: false },
      ];
    }

    // Posiciona em cascata para não sobrepor nós existentes.
    const offset = nodes.length;
    const newNode: FlowNode = {
      id,
      type,
      position: {
        x: 200 + (offset % 3) * 260,
        y: 140 + Math.floor(offset / 3) * 160 + (offset % 3) * 24,
      },
      data: defaultData as BotNodeData & { label: string },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((cur) => (cur === id ? null : cur));
  }

  /** Valida o fluxo antes de salvar. Retorna lista de problemas (vazia = ok). */
  function validateFlow(): string[] {
    const problems: string[] = [];
    const startNode = nodes.find((n) => n.type === "start");
    if (!startNode) {
      problems.push("O fluxo precisa de um nó de início.");
    } else if (!edges.some((e) => e.source === startNode.id)) {
      problems.push("O nó de início não está conectado a nenhum nó.");
    }

    const connectedIds = new Set<string>();
    edges.forEach((e) => {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    });
    const orphans = nodes.filter(
      (n) => n.type !== "start" && !connectedIds.has(n.id),
    );
    if (orphans.length > 0) {
      problems.push(
        `Existem nós desconectados: ${orphans
          .map((n) => n.data.label)
          .join(", ")}.`,
      );
    }

    // Condições: os handles fixos "match" e "no_match" precisam estar conectados.
    for (const n of nodes) {
      if (n.type !== "condition") continue;
      const hasMatch = edges.some(
        (e) => e.source === n.id && e.sourceHandle === "match",
      );
      const hasNoMatch = edges.some(
        (e) => e.source === n.id && e.sourceHandle === "no_match",
      );
      if (!hasMatch) {
        problems.push(
          `No nó "${n.data.label}", a saída "Atende as condições" não está conectada.`,
        );
      }
      if (!hasNoMatch) {
        problems.push(
          `No nó "${n.data.label}", a saída "Não atende nenhuma" não está conectada.`,
        );
      }
    }

    // Menus: precisam de pelo menos uma opção, e cada opção precisa de uma aresta.
    for (const n of nodes) {
      if (n.type !== "menu") continue;
      const options = (n.data as MenuNodeData).options ?? [];
      if (options.length === 0) {
        problems.push(`O menu "${n.data.label}" não tem nenhuma opção.`);
        continue;
      }
      for (const o of options) {
        const hasEdge = edges.some(
          (e) => e.source === n.id && e.sourceHandle === o.handle,
        );
        if (!hasEdge) {
          problems.push(
            `No menu "${n.data.label}", a opção "${o.label || o.handle}" não está conectada.`,
          );
        }
      }
    }
    return problems;
  }

  function updateNodeData(
    id: string,
    patch: Partial<BotNodeData & { label: string }>,
  ) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? ({ ...n, data: { ...n.data, ...patch } } as FlowNode)
          : n,
      ),
    );
  }

  async function handleSave() {
    const problems = validateFlow();
    if (problems.length > 0) {
      toast({
        title: "Não foi possível salvar o fluxo",
        description: problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} problema(s))` : ""),
        variant: "destructive",
      });
      return;
    }

    const dbNodes = nodes.map((n) => ({
      id: n.id,
      botId,
      type: n.type ?? "send_message",
      label: n.data.label,
      positionX: Math.round(n.position.x),
      positionY: Math.round(n.position.y),
      data: n.data as Record<string, unknown>,
    }));

    const dbEdges = edges.map((e) => ({
      id: e.id,
      botId,
      sourceNodeId: e.source,
      targetNodeId: e.target,
      sourceHandle: e.sourceHandle ?? null,
      label: (e.label as string | null) ?? null,
    }));

    try {
      await saveFlowMutation.mutateAsync({ botId, nodes: dbNodes, edges: dbEdges });
      toast({ title: "Fluxo salvo com sucesso" });
    } catch {
      toast({ title: "Erro ao salvar fluxo", variant: "destructive" });
    }
  }

  const botName = flow?.bot.name ?? "Editor de Bot";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-background shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => navigate("/whatsapp/bots")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Bots</span>
          </Button>
          <span className="text-sm font-semibold truncate">{botName}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile: add node button */}
          <Button
            size="sm"
            variant="outline"
            className="sm:hidden gap-1.5"
            onClick={() => setShowMobilePalette(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSimulator(true)}
          >
            <PlayCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Testar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveFlowMutation.isPending}
          >
            <Save className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">
              {saveFlowMutation.isPending ? "Salvando..." : "Salvar"}
            </span>
          </Button>
        </div>
      </div>

      <BotSimulator
        open={showSimulator}
        onOpenChange={setShowSimulator}
        nodes={nodes}
        edges={edges}
      />

      {/* Mobile palette dialog */}
      <Dialog open={showMobilePalette} onOpenChange={setShowMobilePalette}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xs sm:hidden">
          <DialogHeader>
            <DialogTitle>Adicionar nó</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {PALETTE.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => { addNode(type); setShowMobilePalette(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${color}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile properties dialog */}
      <Dialog open={showMobileProps && !!selectedNode} onOpenChange={(open) => !open && setShowMobileProps(false)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:hidden max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-3 border-b shrink-0">
            <DialogTitle className="text-sm">
              {selectedNode?.data.label ?? "Propriedades"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <PropertiesPanel
              key={selectedNode?.id ?? "none"}
              node={selectedNode}
              onChange={updateNodeData}
              onDelete={(id) => { deleteNode(id); setShowMobileProps(false); }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette — desktop only */}
        <div className="hidden sm:flex sm:flex-col w-48 border-r p-3 space-y-2 overflow-y-auto shrink-0 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Nós
          </p>
          {PALETTE.map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${color}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Carregando fluxo...
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={NODE_TYPES}
              onNodeClick={(_e, node) => {
                setSelectedNodeId(node.id);
                if (window.innerWidth < 640) setShowMobileProps(true);
              }}
              onNodesDelete={(deleted) =>
                setSelectedNodeId((cur) =>
                  deleted.some((n) => n.id === cur) ? null : cur,
                )
              }
              onPaneClick={() => setSelectedNodeId(null)}
              deleteKeyCode={["Backspace", "Delete"]}
              fitView
            >
              <Background className="bg-muted/20" />
              <Controls className="!shadow-md [&_button]:!bg-background [&_button]:!border-border [&_button]:!text-foreground" />
              <MiniMap
                className="!bg-muted hidden sm:block"
                nodeColor="hsl(var(--muted-foreground))"
                maskColor="hsl(var(--background) / 0.6)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Right properties panel — desktop only */}
        <div className="hidden sm:block w-72 border-l shrink-0 overflow-y-auto bg-background">
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Propriedades
            </p>
          </div>
          <PropertiesPanel
            key={selectedNode?.id ?? "none"}
            node={selectedNode}
            onChange={updateNodeData}
            onDelete={deleteNode}
          />
        </div>
      </div>
    </div>
  );
}
