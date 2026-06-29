import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageCircle, GitBranch, Zap, PlayCircle, StopCircle, LayoutTemplate, FileText, Hourglass, ListChecks, CheckCircle2, UserRoundCog, Shuffle, Tag, SendHorizonal, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotNodeData, SendMessageNodeData, SendMessageAttachment, ConditionNodeData, ConditionRule, MenuNodeData, ActionNodeData, FlowFormNodeData, WaitNodeData, EndConversationNodeData, TransferAgentNodeData, DistributeFlowNodeData, EditTagsNodeData, SendTemplateNodeData, SendTemplateButtonHandle, TriggerFlowNodeData } from "@shared/schema";

interface NodeData extends Record<string, unknown> {
  label: string;
}

function NodeCard({
  color,
  icon: Icon,
  title,
  preview,
  attachment,
  selected,
}: {
  color: string;
  icon: React.ElementType;
  title: string;
  preview?: string;
  attachment?: SendMessageAttachment;
  selected?: boolean;
}) {
  const hasBody = preview || attachment;
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-white shadow-sm min-w-[160px] max-w-[220px]",
        selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
      )}
    >
      <div className={cn("flex items-center gap-2 rounded-t-md px-3 py-2", color)}>
        <Icon className="h-4 w-4 text-white" />
        <span className="text-xs font-semibold text-white truncate">{title}</span>
      </div>
      {hasBody && (
        <div className="px-3 py-2 space-y-1.5">
          {attachment && attachment.type === "image" && (
            <img
              src={`/api/whatsapp/bots/attachments/${attachment.storageKey}`}
              alt={attachment.name ?? "imagem"}
              className="w-full rounded object-cover"
              style={{ maxHeight: 80 }}
            />
          )}
          {attachment && attachment.type === "document" && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="text-[11px] text-gray-600 truncate">{attachment.name ?? "documento"}</span>
            </div>
          )}
          {preview && (
            <p className="text-xs text-gray-500 line-clamp-2">{preview}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function StartNode({ data, selected }: NodeProps) {
  return (
    <>
      <NodeCard
        color="bg-green-500"
        icon={PlayCircle}
        title={(data as NodeData).label || "Início"}
        selected={selected}
      />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function SendMessageNode({ data, selected }: NodeProps) {
  const d = data as NodeData & SendMessageNodeData;
  const isTemplate = d.messageType === "template";
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-blue-500"
        icon={MessageCircle}
        title={d.label || "Enviar Mensagem"}
        preview={
          isTemplate
            ? (d.metaTemplateName ? `Template: ${d.metaTemplateName}` : d.templateId ? "Template: (legado)" : undefined)
            : d.text || undefined
        }
        attachment={!isTemplate ? d.attachment : undefined}
        selected={selected}
      />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData & ConditionNodeData;
  const branches = d.branches ?? [];

  const rules = (d as ConditionNodeData).rules ?? [];
  const conditionPreview =
    d.groupLabel ||
    (rules.length > 0 ? rules.map((r) => r.field).join(" e ") : null) ||
    (branches.length > 0
      ? branches.map((b) => b.label || (b.keywords ?? []).join(", ") || "...").join(" / ")
      : null);

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[220px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-orange-500">
          <GitBranch className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Condição"}
          </span>
        </div>

        {/* Condition preview */}
        <div className="px-3 py-2">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">Se: </span>
            <span className="line-clamp-2">{conditionPreview ?? "SE FOR..."}</span>
          </div>
        </div>

        {/* Output handles */}
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          <div className="relative flex items-center px-3 py-2">
            <span className="text-xs text-emerald-600 font-medium flex-1 select-none">
              ✓ Atende as condições
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="match"
              className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
              style={{ right: -6 }}
            />
          </div>
          <div className="relative flex items-center px-3 py-2 rounded-b-lg">
            <span className="text-xs text-red-500 font-medium flex-1 select-none">
              ✕ Não atende nenhuma
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="no_match"
              className="!bg-red-400 !w-3 !h-3 !border-2 !border-white"
              style={{ right: -6 }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function MenuNode({ data, selected }: NodeProps) {
  const d = data as NodeData & MenuNodeData;
  const options = d.options ?? [];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm min-w-[180px] max-w-[240px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-indigo-500">
          <ListChecks className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Menu"}
          </span>
        </div>
        {d.bodyText && (
          <p className="px-3 pt-2 text-xs text-gray-500 line-clamp-2">{d.bodyText}</p>
        )}
        {options.length > 0 ? (
          <div className="px-3 py-2 space-y-1 relative">
            {options.map((opt, i) => (
              <div key={opt.handle} className="relative flex items-center">
                <span className="text-xs text-gray-600 truncate flex-1">
                  {opt.label || `Opção ${i + 1}`}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={opt.handle}
                  style={{ top: "auto", right: -8, position: "relative" }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2">
            <p className="text-xs text-gray-400">Nenhuma opção</p>
          </div>
        )}
      </div>
    </>
  );
}

const ACTION_NODE_LABELS: Record<string, string> = {
  add_tag: "Adicionar Tag",
  edit_tags: "Editar etiquetas",
  assign_agent: "Transferir p/ atendente",
  transfer_sector: "Transferir p/ setor",
  notify_agent: "Notificar atendente",
  create_note: "Criar nota interna",
  set_waiting: "Status esperando",
  set_contact_field: "Campo do contato",
  end_conversation: "Encerrar Conversa",
};

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as NodeData & ActionNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-red-500"
        icon={Zap}
        title={d.label || "Ação"}
        preview={d.actionType ? ACTION_NODE_LABELS[d.actionType] : undefined}
        selected={selected}
      />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function WaitNode({ data, selected }: NodeProps) {
  const d = data as NodeData & WaitNodeData;
  const preview =
    d.mode === "until"
      ? d.untilAt
        ? `Até ${d.untilAt}`
        : "Aguardar até..."
      : d.seconds
        ? `Aguardar ${d.seconds}s`
        : "Aguardar intervalo";
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-amber-500"
        icon={Hourglass}
        title={d.label || "Aguardar"}
        preview={preview}
        selected={selected}
      />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function EndNode({ data, selected }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-gray-500"
        icon={StopCircle}
        title={(data as NodeData).label || "Fim"}
        selected={selected}
      />
    </>
  );
}

export function EndConversationNode({ data, selected }: NodeProps) {
  const d = data as NodeData & EndConversationNodeData;
  const closedByLabel =
    d.closedBy === "owner" ? "Dono do chat"
    : d.closedBy ? d.closedBy
    : null;

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[200px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-emerald-600">
          <CheckCircle2 className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Finalizar conversa"}
          </span>
        </div>
        {closedByLabel && (
          <div className="px-3 py-2">
            <p className="text-[11px] text-muted-foreground mb-1">É fechado por:</p>
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-semibold">
              {closedByLabel}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export function FlowFormNode({ data, selected }: NodeProps) {
  const d = data as NodeData & FlowFormNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-teal-600"
        icon={LayoutTemplate}
        title={d.label || "Formulário"}
        preview={d.flowName || d.flowId || "Selecione um Flow"}
        selected={selected}
      />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const TRANSFER_RULE_LABELS: Record<string, string> = {
  specific: "Específico",
  previous_conversation: "Atendente da conversa anterior",
  previous_same_conversation: "Atendente anterior na mesma conversa",
  any_available: "Qualquer disponível",
  random: "Aleatório",
};

export function TransferAgentNode({ data, selected }: NodeProps) {
  const d = data as NodeData & TransferAgentNodeData;
  const ruleLabel = TRANSFER_RULE_LABELS[d.rule] ?? "Específico";

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[210px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-rose-500">
          <UserRoundCog className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Transferir para atendente"}
          </span>
        </div>
        <div className="px-3 py-2 space-y-1">
          <div className="text-[11px] text-gray-500">
            <span className="font-medium text-gray-700">Regra: </span>{ruleLabel}
          </div>
          {d.rule === "specific" && d.agentId && (
            <div className="text-[11px] text-gray-500 truncate">
              <span className="font-medium text-gray-700">Atendente selecionado</span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function DistributeFlowNode({ data, selected }: NodeProps) {
  const d = data as NodeData & DistributeFlowNodeData;
  const outputs = d.outputs ?? [];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[230px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-violet-500">
          <Shuffle className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Distribuir fluxo"}
          </span>
        </div>
        <div className="px-3 py-2 space-y-2">
          {outputs.map((out) => (
            <div key={out.handle} className="relative flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-violet-200">
                <div
                  className="h-1.5 rounded-full bg-violet-500 transition-all"
                  style={{ width: `${out.percentage}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-gray-600 w-9 text-right shrink-0">
                {out.percentage}%
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={out.handle}
                style={{ top: "auto", right: -8, position: "relative" }}
              />
            </div>
          ))}
          {outputs.length === 0 && (
            <p className="text-[11px] text-gray-400">Nenhuma saída configurada</p>
          )}
        </div>
      </div>
    </>
  );
}

export function EditTagsNode({ data, selected }: NodeProps) {
  const d = data as NodeData & EditTagsNodeData;
  const tagIds = d.tagIds ?? [];
  const modeLabel = d.mode === "remove" ? "Remover" : "Adicionar";

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[210px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-amber-500">
          <Tag className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Editar etiquetas"}
          </span>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex gap-1">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${d.mode === "remove" ? "bg-gray-700 text-white" : "bg-blue-500 text-white"}`}>
              {modeLabel}
            </span>
          </div>
          {tagIds.length > 0 ? (
            <p className="text-[11px] text-gray-500">{tagIds.length} etiqueta(s) selecionada(s)</p>
          ) : (
            <p className="text-[11px] text-gray-400">Nenhuma etiqueta</p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function SendTemplateNode({ data, selected }: NodeProps) {
  const d = data as NodeData & SendTemplateNodeData;
  const buttons: SendTemplateButtonHandle[] = d.buttonHandles ?? [];

  type HandleEntry = { id: string; label: string };
  const extraHandles: HandleEntry[] = [
    d.invalidResponseHandle ? { id: "invalid_response", label: "Resposta inválida" } : null,
    d.noResponseHandle ? { id: "no_response", label: "Sem resposta" } : null,
    d.notDeliveredHandle ? { id: "not_delivered", label: "Não entregue" } : null,
  ].filter((h): h is HandleEntry => h !== null);

  const allHandles: HandleEntry[] = [
    ...buttons.map((b) => ({ id: b.handle, label: b.label })),
    ...extraHandles,
  ];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[220px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-blue-600">
          <SendHorizonal className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Enviar template"}
          </span>
        </div>
        <div className="px-3 py-2">
          {d.metaTemplateName ? (
            <p className="text-xs text-gray-600 font-medium truncate">{d.metaTemplateName}</p>
          ) : (
            <p className="text-xs text-gray-400">Nenhum template selecionado</p>
          )}
        </div>
        {allHandles.length > 0 && (
          <div className="border-t border-gray-100 divide-y divide-gray-100">
            {allHandles.map((h) => (
              <div key={h.id} className="relative flex items-center px-3 py-1.5">
                <span className="text-[11px] text-gray-600 truncate flex-1 select-none">{h.label}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={h.id}
                  className="!w-3 !h-3 !border-2 !border-white !bg-blue-400"
                  style={{ right: -6 }}
                />
              </div>
            ))}
          </div>
        )}
        {allHandles.length === 0 && (
          <Handle type="source" position={Position.Bottom} />
        )}
      </div>
    </>
  );
}

export function TriggerFlowNode({ data, selected }: NodeProps) {
  const d = data as NodeData & TriggerFlowNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm w-[210px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-teal-600">
          <ArrowRightLeft className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Acionar outro fluxo"}
          </span>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          {d.targetBotId ? (
            <p className="text-[11px] text-gray-600 font-medium truncate">
              Caminho configurado
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">Nenhum fluxo selecionado</p>
          )}
          {d.executeOnCurrentChannel && (
            <p className="text-[10px] text-teal-600">✓ Canal atual</p>
          )}
          {d.executeParallel && (
            <p className="text-[10px] text-blue-500">✓ Paralelo</p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
