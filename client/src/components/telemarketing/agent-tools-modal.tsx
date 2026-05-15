import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Trash2,
  Webhook,
  Wrench,
  Edit,
  AlertCircle,
  Library,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Zap,
  BrainCircuit,
  Hash,
  FlaskConical,
  Copy,
  Info,
  Settings,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type SystemTool = {
  type: "system";
  name: string;
  description: string;
};

type BodyProperty = {
  _id: string;
  identifier: string;
  dataType: "string" | "number" | "boolean";
  required: boolean;
  valueType: "dynamic_variable" | "llm_prompt";
  // dynamic_variable
  variableName: string;
  // llm_prompt
  description: string;
  enumValues: string; // comma-separated
};

type ResponseMock = {
  _id: string;          // somente no frontend, não enviado à API
  response_body: string;
};

type WebhookTool = {
  type: "webhook";
  name: string;
  description: string;
  api_schema?: {
    url?: string;
    method?: string;
    content_type?: string;
    request_body_schema?: unknown;
    request_headers?: Record<string, string>;
  };
  expects_response?: boolean;
  response_timeout_secs?: number;
  mocks?: Array<{ response_body: string }>;
};

type AgentTool = SystemTool | WebhookTool;

// ElevenLabs new format: built_in_tools is a map of tool name → config (active) or null (disabled).
// Replaces the deprecated prompt.tools approach for system tools.
type BuiltInToolEntry = {
  name: string;
  description: string;
  type: string;
  disable_interruptions?: boolean;
  params?: { system_tool_type: string };
} | null;

type AgentConfig = {
  tools: AgentTool[];
  toolIds: string[];
  builtInTools?: Record<string, BuiltInToolEntry>;
};

function isWebhookTool(t: AgentTool): t is WebhookTool {
  return t.type === "webhook";
}

// ─── Ferramentas de sistema ───────────────────────────────────────────────────

const ALL_SYSTEM_TOOLS: { name: string; label: string; description: string; alpha?: boolean }[] = [
  { name: "end_call", label: "Encerrar conversa", description: "Permite que o agente encerre a chamada" },
  { name: "language_detection", label: "Detectar idioma", description: "Detecta e adapta o idioma automaticamente" },
  { name: "skip_turn", label: "Pular vez", description: "Permite que o agente pule seu turno de fala" },
  { name: "update_state", label: "Atualizar estado", description: "Atualiza o estado da conversa", alpha: true },
  { name: "transfer_to_agent", label: "Transferir para agente", description: "Transfere a conversa para outro agente" },
  { name: "transfer_to_number", label: "Transferir para número", description: "Transfere a chamada para um número de telefone" },
  { name: "play_keypad_touch_tone", label: "Reproduzir tom de toque", description: "Reproduz tons DTMF durante a chamada" },
  { name: "voicemail_detection", label: "Detecção de caixa postal", description: "Detecta quando a chamada cai em caixa postal" },
];

type WorkspaceTool = {
  tool_id: string;
  name: string;
  description?: string;
  type?: string;
  api_schema?: { url?: string; method?: string; request_body_schema?: unknown };
};

// ─── Variáveis dinâmicas disponíveis no contexto da chamada ──────────────────

const DYNAMIC_VARIABLES = [
  { value: "callSid", label: "callSid — SID da chamada Twilio" },
  { value: "conversation_id", label: "conversation_id — ID da conversa ElevenLabs" },
];

// ─── Conversão entre BodyProperty[] e request_body_schema ────────────────────

function propertiesToSchema(
  bodyDescription: string,
  props: BodyProperty[],
): Record<string, unknown> | undefined {
  if (props.length === 0) return undefined;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const p of props) {
    if (!p.identifier.trim()) continue;

    const base: Record<string, unknown> = { type: p.dataType };

    if (p.valueType === "dynamic_variable") {
      base.dynamic_variable = p.variableName || p.identifier;
    } else {
      if (p.description.trim()) base.description = p.description.trim();
      const enums = p.enumValues
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (enums.length > 0) base.enum = enums;
    }

    properties[p.identifier.trim()] = base;
    if (p.required) required.push(p.identifier.trim());
  }

  return {
    type: "object",
    ...(bodyDescription.trim() ? { description: bodyDescription.trim() } : {}),
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function schemaToProperties(schema: unknown): { bodyDesc: string; props: BodyProperty[] } {
  if (!schema || typeof schema !== "object") return { bodyDesc: "", props: [] };
  const s = schema as Record<string, unknown>;
  const bodyDesc = typeof s.description === "string" ? s.description : "";
  const rawProps = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
  const requiredSet = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : []);

  const props: BodyProperty[] = Object.entries(rawProps).map(([key, val]) => {
    const isDynamic = "dynamic_variable" in val;
    const enumRaw = Array.isArray(val.enum) ? (val.enum as string[]).join(", ") : "";
    return {
      _id: crypto.randomUUID(),
      identifier: key,
      dataType: (val.type as "string" | "number" | "boolean") ?? "string",
      required: requiredSet.has(key),
      valueType: isDynamic ? "dynamic_variable" : "llm_prompt",
      variableName: typeof val.dynamic_variable === "string" ? val.dynamic_variable : key,
      description: typeof val.description === "string" ? val.description : "",
      enumValues: enumRaw,
    };
  });

  return { bodyDesc, props };
}

// ─── Editor de parâmetro do corpo ─────────────────────────────────────────────

function PropertyRow({
  prop,
  onChange,
  onRemove,
}: {
  prop: BodyProperty;
  onChange: (p: BodyProperty) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header da propriedade */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <GripVertical className="size-3.5 text-slate-300 shrink-0" />
        {expanded ? (
          <ChevronDown className="size-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-slate-400 shrink-0" />
        )}

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
            {prop.identifier || <span className="text-slate-400 font-normal">sem nome</span>}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] shrink-0 gap-1",
              prop.valueType === "dynamic_variable"
                ? "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-400"
                : "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
            )}
          >
            {prop.valueType === "dynamic_variable" ? (
              <><Zap className="size-2.5" />Variável dinâmica</>
            ) : (
              <><BrainCircuit className="size-2.5" />Prompt LLM</>
            )}
          </Badge>
          {prop.required && (
            <Badge variant="outline" className="text-[10px] shrink-0 border-red-200 text-red-500">
              obrigatório
            </Badge>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 rounded-lg shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Corpo expandido */}
      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Tipo de dado</Label>
              <Select
                value={prop.dataType}
                onValueChange={(v) => onChange({ ...prop, dataType: v as BodyProperty["dataType"] })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Identificador</Label>
              <Input
                value={prop.identifier}
                onChange={(e) => onChange({ ...prop, identifier: e.target.value })}
                placeholder="campo_nome"
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={prop.required}
              onCheckedChange={(v) => onChange({ ...prop, required: v })}
              className="scale-90"
            />
            <Label className="text-sm font-normal cursor-pointer">Obrigatório</Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Tipo de valor</Label>
            <Select
              value={prop.valueType}
              onValueChange={(v) => onChange({ ...prop, valueType: v as BodyProperty["valueType"] })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dynamic_variable">
                  <span className="flex items-center gap-2">
                    <Zap className="size-3.5 text-violet-500" />
                    Variável Dinâmica
                  </span>
                </SelectItem>
                <SelectItem value="llm_prompt">
                  <span className="flex items-center gap-2">
                    <BrainCircuit className="size-3.5 text-blue-500" />
                    Prompt LLM
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {prop.valueType === "dynamic_variable" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Nome da Variável</Label>
              <Input
                value={prop.variableName}
                onChange={(e) => onChange({ ...prop, variableName: e.target.value })}
                placeholder="nomeVariavel"
                className="h-8 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {DYNAMIC_VARIABLES.map((dv) => (
                  <button
                    key={dv.value}
                    type="button"
                    onClick={() => onChange({ ...prop, variableName: dv.value })}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs transition-colors",
                      prop.variableName === dv.value
                        ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
                    )}
                    title={dv.label.split("—")[1]?.trim()}
                  >
                    <Zap className="size-2.5" />
                    {dv.value}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                Digite qualquer nome ou selecione uma sugestão. Variáveis pré-definidas são injetadas automaticamente via Twilio.
              </p>
            </div>
          )}

          {prop.valueType === "llm_prompt" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Descrição *</Label>
                <Textarea
                  value={prop.description}
                  onChange={(e) => onChange({ ...prop, description: e.target.value })}
                  placeholder="Descreva o que o agente deve extrair da conversa..."
                  rows={2}
                  className="text-sm"
                />
                <p className="text-xs text-slate-400">
                  Instruções para o LLM sobre como extrair este valor da conversa.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Hash className="size-3" />
                    Enum Values (opcional)
                  </span>
                </Label>
                <Input
                  value={prop.enumValues}
                  onChange={(e) => onChange({ ...prop, enumValues: e.target.value })}
                  placeholder="sim, nao, talvez"
                  className="text-sm font-mono"
                />
                <p className="text-xs text-slate-400">
                  Valores permitidos separados por vírgula. Ex: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">sim, nao</code>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mock de resposta ─────────────────────────────────────────────────────────

function MockRow({
  mock,
  index,
  bodyProps,
  onChange,
  onRemove,
}: {
  mock: ResponseMock;
  index: number;
  bodyProps: BodyProperty[];
  onChange: (m: ResponseMock) => void;
  onRemove: () => void;
}) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  function validate(value: string) {
    if (!value.trim()) { setJsonError(null); return; }
    try { JSON.parse(value); setJsonError(null); } catch { setJsonError("JSON inválido"); }
  }

  // Gera um JSON de exemplo baseado nas propriedades do corpo configuradas
  function generateExample() {
    if (bodyProps.length === 0) return;
    const example: Record<string, unknown> = {};
    for (const p of bodyProps) {
      if (!p.identifier.trim()) continue;
      if (p.valueType === "dynamic_variable") {
        example[p.identifier] = `{{${p.variableName || p.identifier}}}`;
      } else {
        const enums = p.enumValues.split(",").map((s) => s.trim()).filter(Boolean);
        if (enums.length > 0) example[p.identifier] = enums[0];
        else if (p.dataType === "number") example[p.identifier] = 0;
        else if (p.dataType === "boolean") example[p.identifier] = true;
        else example[p.identifier] = "";
      }
    }
    const json = JSON.stringify(example, null, 2);
    onChange({ ...mock, response_body: json });
    setJsonError(null);
  }

  function copyToClipboard() {
    if (!mock.response_body.trim()) return;
    navigator.clipboard.writeText(mock.response_body);
    toast({ title: "Copiado!" });
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60">
        <FlaskConical className="size-3.5 text-violet-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
          Mock {index + 1}
        </span>

        {bodyProps.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-slate-500 hover:text-violet-600 rounded-lg px-2"
            onClick={generateExample}
            title="Gerar exemplo baseado nas propriedades do corpo"
          >
            <Zap className="size-3" />
            Gerar exemplo
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-slate-400 hover:text-slate-600"
          onClick={copyToClipboard}
          title="Copiar JSON"
        >
          <Copy className="size-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Corpo */}
      <div className="p-3 space-y-1.5">
        <Textarea
          value={mock.response_body}
          onChange={(e) => {
            onChange({ ...mock, response_body: e.target.value });
            validate(e.target.value);
          }}
          placeholder={'{\n  "decisao": "sim",\n  "callSid": "{{callSid}}"\n}'}
          rows={6}
          className={cn(
            "font-mono text-xs resize-y",
            jsonError ? "border-red-400 focus-visible:ring-red-400" : "",
          )}
          spellCheck={false}
        />
        {jsonError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="size-3 shrink-0" />
            {jsonError}
          </p>
        )}
        <p className="text-xs text-slate-400">
          Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{variavel}}"}</code> para referenciar variáveis dinâmicas. Ex: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{callSid}}"}</code>
        </p>
      </div>
    </div>
  );
}

// ─── Dialog de configuração de ferramenta de sistema ─────────────────────────

function SystemToolConfigDialog({
  open,
  toolName,
  toolLabel,
  defaultDescription,
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  open: boolean;
  toolName: string;
  toolLabel: string;
  defaultDescription: string;
  initial: NonNullable<BuiltInToolEntry>;
  onSave: (description: string, disableInterruptions: boolean) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [description, setDescription] = useState(initial.description ?? "");
  const [disableInterruptions, setDisableInterruptions] = useState(
    initial.disable_interruptions ?? false,
  );
  const [showDefault, setShowDefault] = useState(false);

  // Sincroniza estado quando o dialog reabre para outra tool
  const [lastTool, setLastTool] = useState(toolName);
  if (toolName !== lastTool) {
    setLastTool(toolName);
    setDescription(initial.description ?? "");
    setDisableInterruptions(initial.disable_interruptions ?? false);
    setShowDefault(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Settings className="size-4 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <DialogTitle className="text-sm">Editar ferramenta sistema</DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configuração</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nome (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-sm">Nome</Label>
            <Input value={toolName} readOnly className="font-mono bg-slate-50 dark:bg-slate-800 text-slate-500" />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Descrição (opcional)</Label>
              <button
                type="button"
                onClick={() => setShowDefault((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2"
              >
                {showDefault ? "Ocultar Padrão" : "Mostrar Padrão"}
              </button>
            </div>
            {showDefault && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
                  {defaultDescription}
                </p>
              </div>
            )}
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deixe em branco para usar o prompt otimizado padrão do LLM."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Disable interruptions */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
            <input
              id={`disable-interruptions-${toolName}`}
              type="checkbox"
              checked={disableInterruptions}
              onChange={(e) => setDisableInterruptions(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-700 cursor-pointer"
            />
            <div>
              <Label
                htmlFor={`disable-interruptions-${toolName}`}
                className="text-sm cursor-pointer"
              >
                Disable interruptions
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select this box to disable interruptions while the tool is running.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(description, disableInterruptions)}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formulário de webhook ────────────────────────────────────────────────────

function WebhookForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: WebhookTool;
  onSave: (tool: WebhookTool) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  // Seções do formulário
  const [section, setSection] = useState<"basic" | "body" | "advanced" | "mocks">("basic");

  // Campos básicos
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.api_schema?.url ?? "");
  const [method, setMethod] = useState<"POST" | "GET">(
    (initial?.api_schema?.method as "POST" | "GET") ?? "POST",
  );

  // Parâmetros do corpo
  const parsed = schemaToProperties(initial?.api_schema?.request_body_schema);
  const [bodyDescription, setBodyDescription] = useState(parsed.bodyDesc);
  const [bodyProps, setBodyProps] = useState<BodyProperty[]>(parsed.props);

  // Cabeçalhos
  const initHeaders = Object.entries(initial?.api_schema?.request_headers ?? {}).map(
    ([k, v]) => ({ id: crypto.randomUUID(), key: k, value: v }),
  );
  const [headers, setHeaders] = useState(initHeaders);

  // Avançado
  const [expectsResponse, setExpectsResponse] = useState(initial?.expects_response ?? false);
  const [timeout, setTimeout_] = useState(initial?.response_timeout_secs ?? 20);

  // Mocks de resposta
  const [mocks, setMocks] = useState<ResponseMock[]>(
    (initial?.mocks ?? []).map((m) => ({ _id: crypto.randomUUID(), response_body: m.response_body })),
  );

  // Validação básica
  const [errors, setErrors] = useState<Record<string, string>>({});

  function addProperty() {
    setBodyProps((prev) => [
      ...prev,
      {
        _id: crypto.randomUUID(),
        identifier: "",
        dataType: "string",
        required: true,
        valueType: "llm_prompt",
        variableName: "callSid",
        description: "",
        enumValues: "",
      },
    ]);
  }

  function addHeader() {
    setHeaders((prev) => [...prev, { id: crypto.randomUUID(), key: "", value: "" }]);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      e.name = "Use apenas letras minúsculas, números e _ (sem espaços)";
    }
    if (!description.trim()) e.description = "Descrição é obrigatória";
    if (!url.trim()) {
      e.url = "URL é obrigatória";
    } else {
      try { new URL(url); } catch { e.url = "URL inválida"; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) { setSection("basic"); return; }

    const schema = propertiesToSchema(bodyDescription, bodyProps);
    const hdrs = Object.fromEntries(
      headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]),
    );

    const validMocks = mocks
      .filter((m) => m.response_body.trim())
      .map(({ response_body }) => ({ response_body }));

    onSave({
      type: "webhook",
      name,
      description,
      api_schema: {
        url,
        method,
        content_type: "application/json",
        ...(schema ? { request_body_schema: schema } : {}),
        ...(Object.keys(hdrs).length > 0 ? { request_headers: hdrs } : {}),
      },
      expects_response: expectsResponse,
      response_timeout_secs: timeout,
      ...(validMocks.length > 0 ? { mocks: validMocks } : {}),
    });
  }

  const sectionTab = (id: typeof section, label: string, hasError?: boolean) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={cn(
        "flex-1 py-2 text-sm font-medium rounded-lg transition-colors relative",
        section === id
          ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
      )}
    >
      {label}
      {hasError && (
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-red-500" />
      )}
    </button>
  );

  const hasBasicErrors = !!(errors.name || errors.description || errors.url);

  return (
    <div className="space-y-4">
      {/* Abas de seção */}
      <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 gap-1 bg-slate-50 dark:bg-slate-800/50">
        {sectionTab("basic", "Básico", hasBasicErrors)}
        {sectionTab("body", `Corpo (${bodyProps.length})`)}
        {sectionTab("advanced", "Avançado")}
        {sectionTab("mocks", `Mocks${mocks.length > 0 ? ` (${mocks.length})` : ""}`)}
      </div>

      {/* ── Básico ── */}
      {section === "basic" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="confirmar_interesse"
              disabled={!!initial}
              className="font-mono"
            />
            <p className="text-xs text-slate-400">
              Letras minúsculas, números e _ (sem espaços). Ex: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">confirmar_interesse</code>
            </p>
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Descrição *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quando o agente deve chamar esta ferramenta — seja específico para que o LLM saiba quando acioná-la."
              rows={3}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm">URL *</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://seuapp.com/api/…"
              />
              {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as "POST" | "GET")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* ── Corpo ── */}
      {section === "body" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Descrição do corpo</Label>
            <Textarea
              value={bodyDescription}
              onChange={(e) => setBodyDescription(e.target.value)}
              placeholder="Dados enviados para a API. Inclui os campos necessários para processar a resposta do cliente."
              rows={2}
            />
            <p className="text-xs text-slate-400">
              Contexto global do corpo da requisição — ajuda o LLM a entender o propósito dos campos.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Propriedades</Label>
              <span className="text-xs text-slate-400">{bodyProps.length} campo{bodyProps.length !== 1 ? "s" : ""}</span>
            </div>

            {bodyProps.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center">
                <p className="text-sm text-slate-400">Nenhum parâmetro definido</p>
                <p className="text-xs text-slate-400 mt-1">Adicione propriedades abaixo para estruturar o corpo da requisição</p>
              </div>
            )}

            {bodyProps.map((prop, idx) => (
              <PropertyRow
                key={prop._id}
                prop={prop}
                onChange={(p) => setBodyProps((prev) => prev.map((x, i) => (i === idx ? p : x)))}
                onRemove={() => setBodyProps((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-xl border-dashed"
              onClick={addProperty}
            >
              <Plus className="size-4" />
              Adicionar propriedade
            </Button>
          </div>
        </div>
      )}

      {/* ── Avançado ── */}
      {section === "advanced" && (
        <div className="space-y-5">
          {/* Cabeçalhos */}
          <div className="space-y-3">
            <Label className="text-sm">Cabeçalhos</Label>

            {headers.map((h, idx) => (
              <div key={h.id} className="flex gap-2 items-center">
                <Input
                  value={h.key}
                  onChange={(e) =>
                    setHeaders((prev) => prev.map((x, i) => i === idx ? { ...x, key: e.target.value } : x))
                  }
                  placeholder="Authorization"
                  className="flex-1 text-sm font-mono"
                />
                <Input
                  value={h.value}
                  onChange={(e) =>
                    setHeaders((prev) => prev.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))
                  }
                  placeholder="Bearer token..."
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-slate-400 hover:text-red-500"
                  onClick={() => setHeaders((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={addHeader}
            >
              <Plus className="size-3.5" />
              Adicionar cabeçalho
            </Button>
          </div>

          {/* Timeout */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Tempo limite de resposta</Label>
              <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                {timeout}s
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={timeout}
              onChange={(e) => setTimeout_(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>1s</span>
              <span>30s</span>
              <span>60s</span>
            </div>
          </div>

          {/* Aguardar resposta */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
            <Switch
              id="expectsResponse"
              checked={expectsResponse}
              onCheckedChange={setExpectsResponse}
            />
            <div>
              <Label htmlFor="expectsResponse" className="text-sm cursor-pointer">
                Aguardar resposta
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                O agente pausará e aguardará o retorno da URL antes de continuar a conversa.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Mocks de resposta ── */}
      {section === "mocks" && (
        <div className="space-y-4">
          {/* Explicação */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-3.5 py-3">
            <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">O que são mocks de resposta?</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                Durante testes do agente no ElevenLabs, em vez de chamar a URL real o sistema retorna um destes mocks aleatoriamente.
                Isso evita side-effects e permite testar o comportamento do agente com respostas pré-definidas.
              </p>
            </div>
          </div>

          {/* Lista de mocks */}
          {mocks.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-10 text-center">
              <FlaskConical className="size-7 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">Nenhum mock configurado</p>
              <p className="text-xs text-slate-400 mt-1">
                Adicione respostas simuladas para usar durante os testes do agente
              </p>
            </div>
          )}

          {mocks.map((mock, idx) => (
            <MockRow
              key={mock._id}
              mock={mock}
              index={idx}
              bodyProps={bodyProps}
              onChange={(m) => setMocks((prev) => prev.map((x, i) => (i === idx ? m : x)))}
              onRemove={() => setMocks((prev) => prev.filter((_, i) => i !== idx))}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 rounded-xl border-dashed"
            onClick={() =>
              setMocks((prev) => [
                ...prev,
                { _id: crypto.randomUUID(), response_body: "" },
              ])
            }
          >
            <Plus className="size-4" />
            Adicionar mock
          </Button>
        </div>
      )}

      <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} className="gap-2" disabled={isSaving}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Salvar ferramenta
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface AgentToolsModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  campaignName: string;
}

export function AgentToolsModal({ open, onClose, agentId, campaignName }: AgentToolsModalProps) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"library" | "new">("library");
  const [librarySearch, setLibrarySearch] = useState("");
  const [addingLibraryTool, setAddingLibraryTool] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<(WebhookTool & { tool_id: string }) | null>(null);
  const [pendingSystemTool, setPendingSystemTool] = useState<string | null>(null);
  const [configuringSystemTool, setConfiguringSystemTool] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery<AgentConfig>({
    queryKey: ["/api/elevenlabs/agents", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar agente");
      return res.json();
    },
    enabled: open && !!agentId,
  });

  const { data: workspaceData, isLoading: workspaceLoading } = useQuery<{ tools: WorkspaceTool[] }>({
    queryKey: ["/api/elevenlabs/tools"],
    queryFn: async () => {
      const res = await fetch("/api/elevenlabs/tools", { credentials: "include" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: open,
  });

  // Active tool_ids attached to this agent (new ElevenLabs format)
  const activeToolIds: string[] = config?.toolIds ?? [];

  // Workspace tools currently attached to this agent (new format: tool_ids)
  const workspaceMap = new Map((workspaceData?.tools ?? []).map((t) => [t.tool_id, t]));
  const activeWebhookTools: WorkspaceTool[] = activeToolIds
    .map((id) => workspaceMap.get(id))
    .filter((t): t is WorkspaceTool => !!t);

  // Inline webhook tools still in prompt.tools (legacy/deprecated format but still functional).
  // Exclude any whose name already appears in activeWebhookTools (workspace version takes priority).
  const tools: AgentTool[] = (config?.tools as AgentTool[] | undefined) ?? [];
  const activeWebhookNames = new Set(activeWebhookTools.map((t) => t.name));
  const inlineWebhookTools: WebhookTool[] = tools.filter(
    (t): t is WebhookTool =>
      t.type === "webhook" &&
      !!(t as WebhookTool & Record<string, unknown>).name &&
      !activeWebhookNames.has((t as WebhookTool).name),
  );

  const totalWebhooks = activeWebhookTools.length + inlineWebhookTools.length;

  // Active system tools come from built_in_tools (new API format: non-null entry = active).
  // Fall back to the deprecated tools array for agents not yet migrated.
  const builtInToolsMap: Record<string, BuiltInToolEntry> = (config?.builtInTools ?? {}) as Record<string, BuiltInToolEntry>;
  const activeSystemNames: Set<string> = (() => {
    const fromNew = new Set(
      Object.entries(builtInToolsMap)
        .filter(([, v]) => v !== null)
        .map(([k]) => k),
    );
    if (Object.keys(builtInToolsMap).length > 0) return fromNew;
    const systemFromOld = tools.filter((t) => t.type === "system") as SystemTool[];
    return new Set(systemFromOld.map((t) => t.name));
  })();

  // Mutation to update the agent's tool_ids list (new ElevenLabs format)
  const toolIdsMutation = useMutation({
    mutationFn: async (newToolIds: string[]) => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toolIds: newToolIds }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao salvar");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/agents", agentId] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  // Mutation: create workspace tool then add to agent
  const createAndAddMutation = useMutation({
    mutationFn: async (tool: WebhookTool) => {
      const createRes = await fetch("/api/elevenlabs/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: tool.name,
          description: tool.description,
          url: tool.api_schema?.url ?? "",
          method: tool.api_schema?.method ?? "POST",
          requestBodySchema: tool.api_schema?.request_body_schema,
          requestHeaders: tool.api_schema?.request_headers,
          expectsResponse: tool.expects_response,
          responseTimeoutSecs: tool.response_timeout_secs,
          mocks: tool.mocks,
        }),
      });
      if (!createRes.ok) {
        const err = (await createRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao criar ferramenta");
      }
      const { toolId } = (await createRes.json()) as { toolId: string };

      const patchRes = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toolIds: [...activeToolIds, toolId] }),
      });
      if (!patchRes.ok) {
        const err = (await patchRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao adicionar ferramenta ao agente");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/agents", agentId] });
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/tools"] });
      toast({ title: "Ferramenta criada e adicionada" });
      setAddOpen(false);
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Mutation: update existing workspace tool
  const updateToolMutation = useMutation({
    mutationFn: async ({ toolId, tool }: { toolId: string; tool: WebhookTool }) => {
      const res = await fetch(`/api/elevenlabs/tools/${toolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: tool.name,
          description: tool.description,
          url: tool.api_schema?.url ?? "",
          method: tool.api_schema?.method ?? "POST",
          requestBodySchema: tool.api_schema?.request_body_schema,
          requestHeaders: tool.api_schema?.request_headers,
          expectsResponse: tool.expects_response,
          responseTimeoutSecs: tool.response_timeout_secs,
          mocks: tool.mocks,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao atualizar ferramenta");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/tools"] });
      toast({ title: "Ferramenta atualizada" });
      setEditingTool(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  // Mutation for system tools — uses the new built_in_tools format.
  const systemToolMutation = useMutation({
    mutationFn: async (newBuiltInTools: Record<string, BuiltInToolEntry>) => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ builtInTools: newBuiltInTools }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao salvar");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/agents", agentId] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const toggleSystemTool = (name: string, enabled: boolean) => {
    setPendingSystemTool(name);

    const newBuiltInTools: Record<string, BuiltInToolEntry> = { ...builtInToolsMap };
    if (enabled) {
      const existing = builtInToolsMap[name];
      const def = ALL_SYSTEM_TOOLS.find((t) => t.name === name)!;
      newBuiltInTools[name] = {
        name,
        // Preserva descrição e disable_interruptions já configurados, se houver
        description: existing?.description ?? "",
        type: "system",
        disable_interruptions: existing?.disable_interruptions ?? false,
        params: { system_tool_type: name },
      };
    } else {
      newBuiltInTools[name] = null;
    }

    systemToolMutation.mutate(newBuiltInTools, {
      onSuccess: () => toast({ title: enabled ? "Ferramenta ativada" : "Ferramenta desativada" }),
      onSettled: () => setPendingSystemTool(null),
    });
  };

  const saveSystemToolConfig = (name: string, description: string, disableInterruptions: boolean) => {
    const existing = builtInToolsMap[name];
    const def = ALL_SYSTEM_TOOLS.find((t) => t.name === name)!;
    const newBuiltInTools: Record<string, BuiltInToolEntry> = {
      ...builtInToolsMap,
      [name]: {
        name,
        description,
        type: "system",
        disable_interruptions: disableInterruptions,
        params: existing?.params ?? { system_tool_type: name },
      },
    };
    systemToolMutation.mutate(newBuiltInTools, {
      onSuccess: () => {
        toast({ title: "Configuração salva" });
        setConfiguringSystemTool(null);
      },
    });
  };

  const handleAddWebhook = (tool: WebhookTool) => {
    createAndAddMutation.mutate(tool);
  };

  const handleAddFromLibrary = (wt: WorkspaceTool) => {
    setAddingLibraryTool(wt.tool_id);
    toolIdsMutation.mutate([...activeToolIds, wt.tool_id], {
      onSuccess: () => {
        toast({ title: "Ferramenta adicionada da biblioteca" });
        setAddingLibraryTool(null);
        setAddOpen(false);
      },
      onError: () => setAddingLibraryTool(null),
    });
  };

  // Mutation to update inline tools array (legacy format — also clears stale tool_ids)
  const inlineToolsMutation = useMutation({
    mutationFn: async (newInlineTools: WebhookTool[]) => {
      const sanitized = newInlineTools.map((t) => ({
        type: "webhook" as const,
        name: t.name,
        description: t.description ?? "",
        ...(t.api_schema ? { api_schema: t.api_schema } : {}),
        ...(t.expects_response !== undefined ? { expects_response: t.expects_response } : {}),
        ...(t.response_timeout_secs !== undefined ? { response_timeout_secs: t.response_timeout_secs } : {}),
        ...(t.mocks?.length ? { mocks: t.mocks } : {}),
      }));
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tools: sanitized }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Erro ao salvar");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/elevenlabs/agents", agentId] });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });

  const handleEditWebhook = (tool: WebhookTool) => {
    if (!editingTool) return;
    updateToolMutation.mutate({ toolId: editingTool.tool_id, tool });
  };

  const handleDeleteWebhook = (toolId: string) => {
    toolIdsMutation.mutate(
      activeToolIds.filter((id) => id !== toolId),
      { onSuccess: () => toast({ title: "Ferramenta removida do agente" }) },
    );
  };

  const handleDeleteInlineTool = (name: string) => {
    inlineToolsMutation.mutate(
      inlineWebhookTools.filter((t) => t.name !== name),
      { onSuccess: () => toast({ title: "Ferramenta removida" }) },
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg md:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">Ferramentas do Agente — {campaignName}</SheetTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{agentId}</p>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="mt-6 space-y-6">

              {/* Ferramentas do sistema */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="size-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ferramentas do sistema</h3>
                  <Badge variant="outline" className="rounded-full text-xs">{activeSystemNames.size} ativas</Badge>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                  {ALL_SYSTEM_TOOLS.map((tool) => {
                    const isActive = activeSystemNames.has(tool.name);
                    const entry = builtInToolsMap[tool.name];
                    const hasCustomConfig = isActive && (
                      (entry?.description && entry.description.trim() !== "") ||
                      entry?.disable_interruptions === true
                    );
                    return (
                      <div key={tool.name} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tool.label}</span>
                            {tool.alpha && (
                              <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">Alpha</Badge>
                            )}
                            {hasCustomConfig && (
                              <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                                configurado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{tool.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => setConfiguringSystemTool(tool.name)}
                              disabled={systemToolMutation.isPending}
                              title="Configurar ferramenta"
                            >
                              <Settings className="size-3.5" />
                            </Button>
                          )}
                          {pendingSystemTool === tool.name ? (
                            <Loader2 className="size-4 animate-spin text-slate-400" />
                          ) : (
                            <Switch checked={isActive} disabled={systemToolMutation.isPending} onCheckedChange={(v) => toggleSystemTool(tool.name, v)} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Webhooks */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Webhook className="size-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Webhooks</h3>
                  <Badge variant="outline" className="rounded-full text-xs border-violet-200 text-violet-600 dark:border-violet-700 dark:text-violet-400">
                    {totalWebhooks}
                  </Badge>
                </div>

                {totalWebhooks === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700 mb-3">
                    <AlertCircle className="mb-2 size-6 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500">Nenhum webhook configurado</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {/* Workspace tools (tool_ids — new format) */}
                    {activeWebhookTools.map((wt) => {
                      const propCount = (() => {
                        const s = wt.api_schema?.request_body_schema as Record<string, unknown> | undefined;
                        return s?.properties ? Object.keys(s.properties as object).length : 0;
                      })();
                      return (
                        <div
                          key={wt.tool_id}
                          className="flex items-start gap-3 rounded-2xl border p-4 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {wt.name}
                              </span>
                              {propCount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-500">
                                  {propCount} parâmetro{propCount > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            {wt.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{wt.description}</p>
                            )}
                            {wt.api_schema?.url && (
                              <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                                {wt.api_schema.method ?? "POST"} {wt.api_schema.url}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 w-8 rounded-xl p-0 text-slate-400 hover:text-slate-600"
                              onClick={() => setEditingTool({
                                tool_id: wt.tool_id,
                                type: "webhook",
                                name: wt.name,
                                description: wt.description ?? "",
                                api_schema: wt.api_schema ? {
                                  url: wt.api_schema.url ?? "",
                                  method: wt.api_schema.method ?? "POST",
                                  request_body_schema: wt.api_schema.request_body_schema,
                                } : undefined,
                              })}
                            >
                              <Edit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 w-8 rounded-xl p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDeleteWebhook(wt.tool_id)}
                              disabled={toolIdsMutation.isPending}
                            >
                              {toolIdsMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Inline tools (prompt.tools — legacy format) */}
                    {inlineWebhookTools.map((tool) => {
                      const propCount = (() => {
                        const s = tool.api_schema?.request_body_schema as Record<string, unknown> | undefined;
                        return s?.properties ? Object.keys(s.properties as object).length : 0;
                      })();
                      return (
                        <div
                          key={tool.name}
                          className="flex items-start gap-3 rounded-2xl border p-4 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {tool.name}
                              </span>
                              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-300">
                                inline
                              </Badge>
                              {propCount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-500">
                                  {propCount} parâmetro{propCount > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            {tool.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{tool.description}</p>
                            )}
                            {tool.api_schema?.url && (
                              <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                                {tool.api_schema.method ?? "POST"} {tool.api_schema.url}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 w-8 rounded-xl p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDeleteInlineTool(tool.name)}
                              disabled={inlineToolsMutation.isPending}
                            >
                              {inlineToolsMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button className="w-full gap-2 rounded-2xl" variant="outline" onClick={() => { setAddTab("library"); setAddOpen(true); }}>
                  <Plus className="size-4" />
                  Adicionar webhook
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog: adicionar */}
      <Dialog open={addOpen} onOpenChange={(v) => !v && setAddOpen(false)}>
        <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <DialogTitle className="text-base">Adicionar ferramenta</DialogTitle>
          </DialogHeader>

          <div className="px-6 pt-4 shrink-0">
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 gap-1 bg-slate-50 dark:bg-slate-800/50">
              {(["library", "new"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAddTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                    addTab === tab
                      ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  {tab === "library" ? <><Library className="size-3.5" />Biblioteca</> : <><Plus className="size-3.5" />Nova ferramenta</>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {addTab === "library" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} placeholder="Pesquisar ferramentas..." className="pl-9" />
                </div>

                {workspaceLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-slate-400" /></div>
                ) : (() => {
                  const activeSet = new Set(activeToolIds);
                  const filtered = (workspaceData?.tools ?? []).filter(
                    (t) =>
                      t.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
                      (t.description ?? "").toLowerCase().includes(librarySearch.toLowerCase()),
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Library className="mb-3 size-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-500">
                          {librarySearch ? `Nenhum resultado para "${librarySearch}"` : "Nenhuma ferramenta na biblioteca"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Use a aba "Nova ferramenta" para criar</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {filtered.map((wt) => {
                        const added = activeSet.has(wt.tool_id);
                        const isPending = addingLibraryTool === wt.tool_id;
                        return (
                          <div
                            key={wt.tool_id}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                              added
                                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-900/10"
                                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40 hover:border-slate-300",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{wt.name}</p>
                                {wt.type && (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 shrink-0">
                                    {wt.type === "api_integration_webhook" ? "integração" : wt.type}
                                  </Badge>
                                )}
                              </div>
                              {wt.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{wt.description}</p>}
                              {wt.api_schema?.url && (
                                <p className="font-mono text-[10px] text-slate-400 truncate mt-1">
                                  {wt.api_schema.method ?? "GET"} {wt.api_schema.url}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={added ? "outline" : "default"}
                              className={cn("shrink-0 rounded-xl gap-1.5 min-w-[90px]", added && "border-emerald-300 text-emerald-700")}
                              disabled={added || isPending || toolIdsMutation.isPending}
                              onClick={() => !added && handleAddFromLibrary(wt)}
                            >
                              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : added ? <><Check className="size-3.5" />Adicionada</> : <><Plus className="size-3.5" />Adicionar</>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <WebhookForm onSave={handleAddWebhook} onCancel={() => setAddOpen(false)} isSaving={createAndAddMutation.isPending} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar webhook */}
      <Dialog open={!!editingTool} onOpenChange={(v) => !v && setEditingTool(null)}>
        <DialogContent className="flex flex-col gap-0 p-0 w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <DialogTitle className="text-base">
              Editar webhook — <span className="font-mono text-violet-600">{editingTool?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {editingTool && (
              <WebhookForm
                key={editingTool.name}
                initial={editingTool}
                onSave={handleEditWebhook}
                onCancel={() => setEditingTool(null)}
                isSaving={updateToolMutation.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: configurar ferramenta de sistema */}
      {(() => {
        const toolDef = ALL_SYSTEM_TOOLS.find((t) => t.name === configuringSystemTool);
        const entry = configuringSystemTool ? builtInToolsMap[configuringSystemTool] : null;
        if (!toolDef || !entry) return null;
        return (
          <SystemToolConfigDialog
            open={!!configuringSystemTool}
            toolName={configuringSystemTool!}
            toolLabel={toolDef.label}
            defaultDescription={toolDef.description}
            initial={entry}
            onSave={(desc, disableInt) =>
              saveSystemToolConfig(configuringSystemTool!, desc, disableInt)
            }
            onClose={() => setConfiguringSystemTool(null)}
            isSaving={systemToolMutation.isPending}
          />
        );
      })()}
    </>
  );
}
