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
  Save,
  MessageCircle,
  HelpCircle,
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
  Brain,
  RefreshCw,
  Paperclip,
  FileText,
  X,
  Loader2,
  Hourglass,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useWhatsappBotFlow, useSaveFlow } from "@/hooks/use-whatsapp-bots";
import { useWhatsappMetaTemplates } from "@/hooks/use-whatsapp";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  parseTemplateVars,
  getParamValue,
  setParamValue,
} from "@/lib/whatsapp-template";
import {
  StartNode,
  SendMessageNode,
  QuestionNode,
  ConditionNode,
  ActionNode,
  EndNode,
  FlowFormNode,
  WaitNode,
} from "@/components/whatsapp-bot/nodes";
import type {
  BotNodeData,
  SendMessageNodeData,
  SendMessageAttachment,
  TemplateHeaderMedia,
  QuestionNodeData,
  ConditionNodeData,
  ConditionBranch,
  ActionNodeData,
  FlowFormNodeData,
  WaitNodeData,
  WhatsappFlow,
} from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowNode = Node<BotNodeData & { label: string }>;
type FlowEdge = Edge;

const NODE_TYPES = {
  start: StartNode,
  send_message: SendMessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  flow_form: FlowFormNode,
  wait: WaitNode,
  end: EndNode,
};

// ─── Palette config ───────────────────────────────────────────────────────────

const PALETTE = [
  { type: "send_message", label: "Enviar Mensagem", icon: MessageCircle, color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
  { type: "question", label: "Pergunta", icon: HelpCircle, color: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100" },
  { type: "condition", label: "Condição", icon: GitBranch, color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" },
  { type: "action", label: "Ação", icon: Zap, color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
  { type: "wait", label: "Aguardar", icon: Hourglass, color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" },
  { type: "flow_form", label: "Formulário WA", icon: LayoutTemplate, color: "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100" },
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
type TagOption = { id: string; name: string; color?: string };

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
    queryKey: ["/api/sectors"],
    queryFn: () => authFetch("/api/sectors"),
  });
}

function useMarkerTags() {
  return useQuery<TagOption[]>({
    queryKey: ["/api/tags/markers"],
    queryFn: () => authFetch("/api/tags/markers"),
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
  { value: "edit_tags", label: "Editar etiquetas" },
  { value: "assign_agent", label: "Transferir p/ atendente" },
  { value: "transfer_sector", label: "Transferir p/ setor" },
  { value: "notify_agent", label: "Notificar atendente" },
  { value: "create_note", label: "Criar nota interna" },
  { value: "set_waiting", label: "Status esperando" },
  { value: "set_contact_field", label: "Campo do contato" },
  { value: "end_conversation", label: "Encerrar conversa" },
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

      {node.type === "question" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Texto da pergunta</Label>
            <Textarea
              value={(d as QuestionNodeData).messageText ?? ""}
              onChange={(e) => update({ messageText: e.target.value })}
              placeholder="Digite a pergunta..."
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground">
              Deixe em branco para apenas <strong>aguardar a resposta</strong> sem
              enviar texto (ideal após um template de abertura, fora da janela de 24h).
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Salvar resposta em (opcional)</Label>
            <Input
              value={(d as QuestionNodeData).captureVariable ?? ""}
              onChange={(e) =>
                update({
                  captureVariable: e.target.value
                    .trim()
                    .replace(/[^a-zA-Z0-9_]/g, "_"),
                })
              }
              placeholder="ex: nome_cliente"
            />
            <p className="text-[11px] text-muted-foreground">
              A resposta do contato fica disponível como{" "}
              <code className="font-mono">{`{{${(d as QuestionNodeData).captureVariable || "variavel"}}}`}</code>{" "}
              em nós seguintes.
            </p>
          </div>
        </>
      )}

      {node.type === "condition" && (
        <ConditionEditor
          data={d as ConditionNodeData}
          onChange={(patch) => update(patch)}
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

function ConditionEditor({
  data,
  onChange,
}: {
  data: Partial<ConditionNodeData>;
  onChange: (patch: Partial<ConditionNodeData>) => void;
}) {
  const branches: ConditionBranch[] = data.branches ?? [];

  function addBranch() {
    const handle = `branch-${nanoid(4)}`;
    onChange({
      branches: [...branches, { handle, label: "", keywords: [] }],
      defaultHandle: data.defaultHandle ?? "default",
    });
  }

  function removeBranch(handle: string) {
    onChange({
      branches: branches.filter((b) => b.handle !== handle),
    });
  }

  function updateBranch(handle: string, patch: Partial<ConditionBranch>) {
    onChange({
      branches: branches.map((b) =>
        b.handle === handle ? { ...b, ...patch } : b,
      ),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border p-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-purple-600" />
          <div>
            <p className="text-xs font-medium">Classificação por IA</p>
            <p className="text-[10px] text-muted-foreground">Usa OpenAI para entender intenção</p>
          </div>
        </div>
        <Switch
          checked={!!data.useAI}
          onCheckedChange={(v) => onChange({ useAI: v })}
        />
      </div>
      {branches.map((branch, i) => (
        <div
          key={branch.handle}
          className="border rounded-md p-3 space-y-2 bg-muted/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Ramo {i + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeBranch(branch.handle)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rótulo</Label>
            <Input
              value={branch.label}
              onChange={(e) =>
                updateBranch(branch.handle, { label: e.target.value })
              }
              placeholder='Ex: Contém "sim"'
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
            <Input
              value={branch.keywords.join(", ")}
              onChange={(e) =>
                updateBranch(branch.handle, {
                  keywords: e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean),
                })
              }
              placeholder="sim, yes, s"
            />
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addBranch}
      >
        <Plus className="h-3 w-3 mr-1" />
        Adicionar ramo
      </Button>
      <p className="text-xs text-muted-foreground">
        Uma saída "Padrão" é sempre adicionada automaticamente.
      </p>
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
  if (node.type === "question") {
    return (node.data as QuestionNodeData).messageText ?? "(pergunta vazia)";
  }
  if (node.type === "flow_form") {
    const d = node.data as FlowFormNodeData;
    return `[Formulário: ${d.flowName || d.flowId || "—"}] ${d.ctaText ? `— "${d.ctaText}"` : ""}`;
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
        } else if (current.type === "question" || current.type === "flow_form") {
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
    const afterQuestion = nextNode(waitingNodeId);
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
      question: "Pergunta",
      condition: "Condição",
      action: "Ação",
      wait: "Aguardar",
      flow_form: "Formulário WA",
      end: "Fim",
    };
    const defaultData: Partial<BotNodeData & { label: string }> = {
      label: labelMap[type] ?? type,
    };
    if (type === "condition") {
      (defaultData as Partial<ConditionNodeData>).branches = [];
      (defaultData as Partial<ConditionNodeData>).defaultHandle = "default";
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

    // Condições: cada ramo precisa de uma aresta saindo do seu handle.
    for (const n of nodes) {
      if (n.type !== "condition") continue;
      const branches = (n.data as ConditionNodeData).branches ?? [];
      for (const b of branches) {
        const hasEdge = edges.some(
          (e) => e.source === n.id && e.sourceHandle === b.handle,
        );
        if (!hasEdge) {
          problems.push(
            `No nó "${n.data.label}", o ramo "${b.label || b.handle}" não está conectado.`,
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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/whatsapp/bots")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Bots
          </Button>
          <span className="text-sm font-semibold">{botName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSimulator(true)}
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveFlowMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveFlowMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <BotSimulator
        open={showSimulator}
        onOpenChange={setShowSimulator}
        nodes={nodes}
        edges={edges}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className="w-48 border-r p-3 space-y-2 overflow-y-auto shrink-0 bg-muted/20">
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
              onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
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
                className="!bg-muted"
                nodeColor="hsl(var(--muted-foreground))"
                maskColor="hsl(var(--background) / 0.6)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Right properties panel */}
        <div className="w-72 border-l shrink-0 overflow-y-auto bg-background">
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
