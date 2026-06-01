import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageCircle, HelpCircle, GitBranch, Zap, PlayCircle, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotNodeData, SendMessageNodeData, QuestionNodeData, ConditionNodeData, ActionNodeData } from "@shared/schema";

interface NodeData extends Record<string, unknown> {
  label: string;
}

function NodeCard({
  color,
  icon: Icon,
  title,
  preview,
  selected,
}: {
  color: string;
  icon: React.ElementType;
  title: string;
  preview?: string;
  selected?: boolean;
}) {
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
      {preview && (
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500 line-clamp-2">{preview}</p>
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
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-blue-500"
        icon={MessageCircle}
        title={d.label || "Enviar Mensagem"}
        preview={d.text ?? (d.templateId ? `Template: ${d.templateId}` : undefined)}
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

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as NodeData & ActionNodeData;
  const actionLabels: Record<string, string> = {
    add_tag: "Adicionar Tag",
    assign_agent: "Atribuir Agente",
    end_conversation: "Encerrar Conversa",
  };
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <NodeCard
        color="bg-red-500"
        icon={Zap}
        title={d.label || "Ação"}
        preview={d.actionType ? actionLabels[d.actionType] : undefined}
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
