import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageCircle, HelpCircle, GitBranch, Zap, PlayCircle, StopCircle, LayoutTemplate, FileText, Hourglass, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotNodeData, SendMessageNodeData, SendMessageAttachment, QuestionNodeData, ConditionNodeData, MenuNodeData, ActionNodeData, FlowFormNodeData, WaitNodeData } from "@shared/schema";

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

export function QuestionNode({ data, selected }: NodeProps) {
  const d = data as NodeData & QuestionNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-purple-500"
        icon={HelpCircle}
        title={d.label || "Pergunta"}
        preview={d.messageText}
        selected={selected}
      />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData & ConditionNodeData;
  const branches = d.branches ?? [];

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={cn(
          "rounded-lg border-2 bg-white shadow-sm min-w-[180px] max-w-[240px]",
          selected ? "border-blue-500 shadow-blue-200 shadow-md" : "border-gray-200",
        )}
      >
        <div className="flex items-center gap-2 rounded-t-md px-3 py-2 bg-orange-500">
          <GitBranch className="h-4 w-4 text-white" />
          <span className="text-xs font-semibold text-white truncate">
            {d.label || "Condição"}
          </span>
        </div>
        {branches.length > 0 && (
          <div className="px-3 py-2 space-y-1 relative">
            {branches.map((branch, i) => (
              <div key={branch.handle} className="relative flex items-center">
                <span className="text-xs text-gray-600 truncate flex-1">
                  {branch.label || `Ramo ${i + 1}`}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={branch.handle}
                  style={{ top: "auto", right: -8, position: "relative" }}
                />
              </div>
            ))}
            <div className="relative flex items-center">
              <span className="text-xs text-gray-400 flex-1">Padrão</span>
              <Handle
                type="source"
                position={Position.Right}
                id={d.defaultHandle || "default"}
                style={{ top: "auto", right: -8, position: "relative" }}
              />
            </div>
          </div>
        )}
        {branches.length === 0 && (
          <div className="px-3 py-2">
            <p className="text-xs text-gray-400">Nenhuma condição</p>
          </div>
        )}
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
