import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { useWhatsappBotFlow, useSaveFlow } from "@/hooks/use-whatsapp-bots";
import { useWhatsappTemplates } from "@/hooks/use-whatsapp";
import {
  StartNode,
  SendMessageNode,
  QuestionNode,
  ConditionNode,
  ActionNode,
  EndNode,
} from "@/components/whatsapp-bot/nodes";
import type {
  BotNodeData,
  SendMessageNodeData,
  QuestionNodeData,
  ConditionNodeData,
  ConditionBranch,
  ActionNodeData,
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
  end: EndNode,
};

// ─── Palette config ───────────────────────────────────────────────────────────

const PALETTE = [
  { type: "send_message", label: "Enviar Mensagem", icon: MessageCircle, color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
  { type: "question", label: "Pergunta", icon: HelpCircle, color: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100" },
  { type: "condition", label: "Condição", icon: GitBranch, color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" },
  { type: "action", label: "Ação", icon: Zap, color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
  { type: "end", label: "Fim", icon: StopCircle, color: "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100" },
];

// ─── Properties Panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  node,
  onChange,
}: {
  node: FlowNode | null;
  onChange: (id: string, data: Partial<BotNodeData & { label: string }>) => void;
}) {
  const { data: templates = [] } = useWhatsappTemplates();

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
          {(d as SendMessageNodeData).messageType === "template" ? (
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select
                value={(d as SendMessageNodeData).templateId ?? ""}
                onValueChange={(v) => update({ templateId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={(d as SendMessageNodeData).text ?? ""}
                onChange={(e) => update({ text: e.target.value })}
                placeholder="Digite a mensagem..."
                rows={4}
              />
            </div>
          )}
        </>
      )}

      {node.type === "question" && (
        <div className="space-y-1">
          <Label className="text-xs">Texto da pergunta</Label>
          <Textarea
            value={(d as QuestionNodeData).messageText ?? ""}
            onChange={(e) => update({ messageText: e.target.value })}
            placeholder="Digite a pergunta..."
            rows={4}
          />
        </div>
      )}

      {node.type === "condition" && (
        <ConditionEditor
          data={d as ConditionNodeData}
          onChange={(patch) => update(patch)}
        />
      )}

      {node.type === "action" && (
        <div className="space-y-1">
          <Label className="text-xs">Tipo de ação</Label>
          <Select
            value={(d as ActionNodeData).actionType ?? "end_conversation"}
            onValueChange={(v) =>
              update({ actionType: v as ActionNodeData["actionType"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add_tag">Adicionar Tag</SelectItem>
              <SelectItem value="assign_agent">Atribuir Agente</SelectItem>
              <SelectItem value="end_conversation">Encerrar Conversa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(node.type === "start" || node.type === "end") && (
        <p className="text-xs text-muted-foreground">
          Este nó não possui propriedades configuráveis.
        </p>
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

  useEffect(() => {
    if (flow && !initialized) {
      const initialNodes = flow.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.positionX, y: n.positionY },
        data: { ...(n.data as BotNodeData), label: n.label },
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

    const newNode: FlowNode = {
      id,
      type,
      position: { x: 250, y: 200 + nodes.length * 20 },
      data: defaultData as BotNodeData & { label: string },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
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
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveFlowMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveFlowMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

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
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
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
            node={selectedNode}
            onChange={updateNodeData}
          />
        </div>
      </div>
    </div>
  );
}
