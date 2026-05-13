import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isToday, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  MessageSquare,
  Calendar,
  User,
  Trash2,
  Send,
  ClipboardList,
  LayoutGrid,
  List,
  Pencil,
  Folder,
  Upload,
  Download,
  File,
  FileText as FileTextIcon,
  Image,
  FileSpreadsheet,
  Film,
  Music,
  ChevronLeft,
  FileText,
  FolderOpen,
  NotebookPen,
  Check,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskPriority = "baixa" | "media" | "alta" | "urgente";
type TaskCategory =
  | "marketing"
  | "operacao"
  | "financeiro"
  | "comercial"
  | "outro";

interface TaskBoard {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isDefault: boolean;
  createdById: string;
  createdAt: string;
  taskCount: number;
}

interface TaskStage {
  id: string;
  boardId: string | null;
  name: string;
  slug: string;
  color: string;
  order: number;
  isDefault: boolean;
}

interface TaskUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  createdById: string;
  dueDate: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: string;
  boardId: string | null;
  order: number | null;
  assignee: TaskUser | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskWithComments extends Task {
  comments: Array<{
    id: string;
    taskId: string;
    userId: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string } | null;
  }>;
}

interface NoteSection {
  id: string;
  name: string;
  color: string;
  order: number;
  createdById: string;
  createdAt: string;
  noteCount: number;
}

interface Note {
  id: string;
  title: string;
  content: string;
  sectionId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  slate: {
    color: "text-slate-700 dark:text-slate-200",
    bg: "bg-slate-100 border-slate-300 dark:bg-slate-700/40 dark:border-slate-600",
  },
  blue: {
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700",
  },
  amber: {
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700",
  },
  green: {
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700",
  },
  purple: {
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700",
  },
  orange: {
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700",
  },
  red: {
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700",
  },
  teal: {
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 border-teal-300 dark:bg-teal-900/20 dark:border-teal-700",
  },
  indigo: {
    color: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700",
  },
  pink: {
    color: "text-pink-700 dark:text-pink-300",
    bg: "bg-pink-50 border-pink-300 dark:bg-pink-900/20 dark:border-pink-700",
  },
};

const COLOR_CYCLE = [
  "slate",
  "blue",
  "amber",
  "green",
  "purple",
  "orange",
  "red",
  "teal",
  "indigo",
  "pink",
];

const BOARD_COLOR_DOT: Record<string, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  pink: "bg-pink-500",
};

const BOARD_COLOR_HEADER: Record<string, string> = {
  slate: "from-slate-500 to-slate-600",
  blue: "from-blue-500 to-blue-600",
  amber: "from-amber-500 to-amber-600",
  green: "from-green-500 to-green-600",
  purple: "from-purple-500 to-purple-600",
  orange: "from-orange-500 to-orange-600",
  red: "from-red-500 to-red-600",
  teal: "from-teal-500 to-teal-600",
  indigo: "from-indigo-500 to-indigo-600",
  pink: "from-pink-500 to-pink-600",
};

function stageStyle(color: string) {
  return STAGE_COLORS[color] ?? STAGE_COLORS.slate;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string }> =
  {
    baixa: {
      label: "Baixa",
      badge: "bg-slate-100 text-slate-600 border-slate-300",
    },
    media: {
      label: "Média",
      badge: "bg-blue-100 text-blue-700 border-blue-300",
    },
    alta: {
      label: "Alta",
      badge: "bg-orange-100 text-orange-700 border-orange-300",
    },
    urgente: {
      label: "Urgente",
      badge: "bg-red-100 text-red-700 border-red-300",
    },
  };

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  marketing: "Marketing",
  operacao: "Operação",
  financeiro: "Financeiro",
  comercial: "Comercial",
  outro: "Outro",
};

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...options });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? `Resposta inválida do servidor (${res.status}): ${text.slice(0, 120)}`
        : `Erro ${res.status}: resposta não-JSON`,
    );
  }
  if (!res.ok)
    throw new Error(
      ((parsed as Record<string, unknown>)?.message as string) ??
        `Erro ${res.status}`,
    );
  return parsed as T;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const date = parseISO(dueDate);
  const overdue = isPast(date) && !isToday(date);
  const dueToday = isToday(date);
  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1",
        overdue && "text-red-600 font-semibold",
        dueToday && "text-amber-600 font-semibold",
        !overdue && !dueToday && "text-slate-500",
      )}
    >
      <Calendar className="h-3 w-3" />
      {format(date, "dd/MM/yy", { locale: ptBR })}
      {overdue && " · vencida"}
      {dueToday && " · hoje"}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded border font-medium",
        cfg.badge,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onOpen,
  onDragStart,
  isDragging,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  onDragStart: (id: string) => void;
  isDragging: boolean;
}) {
  const dueDate = task.dueDate ? parseISO(task.dueDate) : null;
  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const dueToday = dueDate && isToday(dueDate);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("taskId", task.id);
        onDragStart(task.id);
      }}
      onClick={() => onOpen(task)}
      className={cn(
        "rounded-lg border p-3 bg-white dark:bg-slate-800 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none",
        overdue && "border-l-4 border-l-red-500",
        dueToday && !overdue && "border-l-4 border-l-amber-400",
        isDragging && "opacity-40 scale-95",
      )}
    >
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug mb-2">
        {task.title}
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <PriorityBadge priority={task.priority} />
        <span className="text-xs px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300">
          {CATEGORY_LABELS[task.category]}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2">
        {task.assignee ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold flex-shrink-0 select-none">
              {task.assignee.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
              {task.assignee.name.split(" ")[0]}
            </span>
          </span>
        ) : (
          <span />
        )}
        <DueDateBadge dueDate={task.dueDate} />
      </div>
    </div>
  );
}

// ─── Quick add ────────────────────────────────────────────────────────────────

function QuickAddCard({
  onConfirm,
  onCancel,
}: {
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const submit = () => {
    const t = title.trim();
    if (t) onConfirm(t);
  };
  return (
    <div className="rounded-lg border border-purple-300 bg-white dark:bg-slate-800 p-2 shadow-sm flex flex-col gap-2">
      <textarea
        autoFocus
        rows={2}
        placeholder="Título da tarefa..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onCancel();
        }}
        className="w-full resize-none text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
      />
      <div className="flex gap-1.5">
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="text-xs px-3 py-1 rounded bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
        >
          Adicionar
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortedCol(tasks: Task[], slug: string): Task[] {
  return tasks
    .filter((t) => t.status === slug)
    .sort((a, b) => {
      if (a.order == null && b.order == null) return 0;
      if (a.order == null) return 1;
      if (b.order == null) return -1;
      return a.order - b.order;
    });
}

// ─── Kanban view ──────────────────────────────────────────────────────────────

function KanbanView({
  tasks,
  stages,
  onOpen,
  onDropToStatus,
  onReorder,
  onQuickCreate,
  onRenameStage,
  onAddStage,
  canManageStages,
  boardId,
}: {
  tasks: Task[];
  stages: TaskStage[];
  onOpen: (t: Task) => void;
  onDropToStatus: (taskId: string, slug: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onQuickCreate?: (title: string, slug: string) => void;
  onRenameStage?: (id: string, name: string) => void;
  onAddStage?: (name: string) => void;
  canManageStages?: boolean;
  boardId?: string;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overSlug, setOverSlug] = useState<string | null>(null);
  // For intra-column reordering: which card are we hovering over and which half
  const [dropTarget, setDropTarget] = useState<{
    cardId: string;
    before: boolean;
  } | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const draggedTask = tasks.find((t) => t.id === draggedId);

  const saveRename = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed && onRenameStage) onRenameStage(id, trimmed);
    setEditingId(null);
  };

  const handleDrop = (e: React.DragEvent, slug: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find((t) => t.id === taskId);
    if (!taskId || !task) {
      setDraggedId(null);
      setOverSlug(null);
      setDropTarget(null);
      return;
    }

    if (task.status !== slug) {
      // Moving to a different column — simple status change
      onDropToStatus(taskId, slug);
    } else if (onReorder && dropTarget) {
      // Same column — reorder
      const col = sortedCol(tasks, slug);
      const filtered = col.filter((t) => t.id !== taskId);
      const targetIdx = filtered.findIndex((t) => t.id === dropTarget.cardId);
      if (targetIdx === -1) {
        // dropped on empty area — move to end
        filtered.push(task);
      } else if (dropTarget.before) {
        filtered.splice(targetIdx, 0, task);
      } else {
        filtered.splice(targetIdx + 1, 0, task);
      }
      onReorder(filtered.map((t) => t.id));
    }

    setDraggedId(null);
    setOverSlug(null);
    setDropTarget(null);
  };

  const handleCardDragOver = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setDropTarget((prev) =>
      prev?.cardId === cardId && prev?.before === before
        ? prev
        : { cardId, before },
    );
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth">
      {stages.map((stage) => {
        const cfg = stageStyle(stage.color);
        const col = sortedCol(tasks, stage.slug);
        const isOver = overSlug === stage.slug;
        const isSameCol = draggedTask?.status === stage.slug;
        return (
          <div
            key={stage.id}
            className="flex flex-col gap-3 min-w-[280px] w-[280px] flex-shrink-0 snap-start"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverSlug(stage.slug);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverSlug(null);
                setDropTarget(null);
              }
            }}
            onDrop={(e) => handleDrop(e, stage.slug)}
          >
            <div
              className={cn(
                "rounded-lg border px-3 py-2 flex items-center justify-between gap-2 transition-colors group",
                cfg.bg,
              )}
            >
              {editingId === stage.id ? (
                <input
                  ref={editInputRef}
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(stage.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => saveRename(stage.id)}
                  className={cn(
                    "text-sm font-semibold bg-transparent outline-none border-b border-current flex-1 min-w-0",
                    cfg.color,
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "text-sm font-semibold flex-1 min-w-0 truncate",
                    cfg.color,
                  )}
                >
                  {stage.name}
                </span>
              )}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canManageStages && editingId !== stage.id && (
                  <button
                    onClick={() => {
                      setEditingId(stage.id);
                      setEditingName(stage.name);
                    }}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/50",
                      cfg.color,
                    )}
                    title="Renomear"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                <span
                  className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-full bg-white/70",
                    cfg.color,
                  )}
                >
                  {col.length}
                </span>
              </div>
            </div>
            <div
              className={cn(
                "flex flex-col gap-2 min-h-[120px] rounded-lg transition-all p-1 -m-1",
                isOver &&
                  !isSameCol &&
                  "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-400 ring-dashed",
              )}
            >
              {col.map((t) => {
                const isDropBefore =
                  isSameCol &&
                  dropTarget?.cardId === t.id &&
                  dropTarget?.before;
                const isDropAfter =
                  isSameCol &&
                  dropTarget?.cardId === t.id &&
                  !dropTarget?.before;
                return (
                  <div
                    key={t.id}
                    onDragOver={(e) => handleCardDragOver(e, t.id)}
                    className={cn(
                      "rounded-lg transition-all",
                      isDropBefore && "border-t-2 border-purple-500 pt-0.5",
                      isDropAfter && "border-b-2 border-purple-500 pb-0.5",
                    )}
                  >
                    <TaskCard
                      task={t}
                      onOpen={onOpen}
                      onDragStart={setDraggedId}
                      isDragging={draggedId === t.id}
                    />
                  </div>
                );
              })}
              {col.length === 0 && addingIn !== stage.slug && (
                <div
                  className={cn(
                    "text-xs text-slate-400 dark:text-slate-500 text-center mt-4",
                    isOver && "opacity-0",
                  )}
                >
                  Nenhuma tarefa
                </div>
              )}
              {onQuickCreate &&
                (addingIn === stage.slug ? (
                  <QuickAddCard
                    onConfirm={(title) => {
                      onQuickCreate(title, stage.slug);
                      setAddingIn(null);
                    }}
                    onCancel={() => setAddingIn(null)}
                  />
                ) : (
                  <button
                    onClick={() => setAddingIn(stage.slug)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5 transition-colors mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar tarefa
                  </button>
                ))}
            </div>
          </div>
        );
      })}
      {canManageStages && onAddStage && (
        <div className="flex flex-col gap-3 min-w-[200px] w-[200px] flex-shrink-0 snap-start">
          {addingStage ? (
            <div className="rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 px-3 py-2 flex flex-col gap-2">
              <input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Nome da etapa..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newStageName.trim()) {
                    onAddStage(newStageName.trim());
                    setNewStageName("");
                    setAddingStage(false);
                  }
                  if (e.key === "Escape") {
                    setNewStageName("");
                    setAddingStage(false);
                  }
                }}
                onBlur={() => {
                  if (!newStageName.trim()) setAddingStage(false);
                }}
                className="text-sm font-semibold bg-transparent outline-none text-slate-700 dark:text-slate-200 w-full"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    if (newStageName.trim()) {
                      onAddStage(newStageName.trim());
                      setNewStageName("");
                      setAddingStage(false);
                    }
                  }}
                  disabled={!newStageName.trim()}
                  className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
                >
                  Criar
                </button>
                <button
                  onClick={() => {
                    setNewStageName("");
                    setAddingStage(false);
                  }}
                  className="text-xs px-2 py-0.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingStage(true)}
              className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 px-3 py-2 flex items-center gap-1.5 text-sm text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova etapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── My tasks list view ───────────────────────────────────────────────────────

function MyTasksListView({
  tasks,
  allStages,
  boards,
  onOpen,
}: {
  tasks: Task[];
  allStages: TaskStage[];
  boards: TaskBoard[];
  onOpen: (t: Task) => void;
}) {
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const stageMap = Object.fromEntries(allStages.map((s) => [s.slug, s]));
  const boardMap = Object.fromEntries(boards.map((b) => [b.id, b]));

  const filtered = tasks.filter((t) => {
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const pending = filtered.filter((t) => {
    const stage = stageMap[t.status];
    return (
      !stage ||
      (stage.slug !== "concluido" &&
        !stage.name.toLowerCase().includes("conclu"))
    );
  });
  const done = filtered.filter((t) => {
    const stage = stageMap[t.status];
    return (
      stage &&
      (stage.slug === "concluido" ||
        stage.name.toLowerCase().includes("conclu"))
    );
  });

  const renderRow = (t: Task) => {
    const dueDate = t.dueDate ? parseISO(t.dueDate) : null;
    const overdue = dueDate && isPast(dueDate) && !isToday(dueDate);
    const dueToday = dueDate && isToday(dueDate);
    const stage = stageMap[t.status];
    const scfg = stage ? stageStyle(stage.color) : stageStyle("slate");
    const board = t.boardId ? boardMap[t.boardId] : null;
    return (
      <div
        key={t.id}
        onClick={() => onOpen(t)}
        className={cn(
          "px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
          overdue && "bg-red-50/40 dark:bg-red-900/10",
          dueToday && !overdue && "bg-amber-50/40 dark:bg-amber-900/10",
        )}
      >
        {/* Desktop layout */}
        <div className="hidden md:grid grid-cols-[1fr_120px_120px_100px_110px] items-center text-sm gap-2">
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
              {t.title}
            </p>
            {board && (
              <span className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full inline-block",
                    BOARD_COLOR_DOT[board.color] ?? "bg-slate-400",
                  )}
                />
                {board.name}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-full border w-fit",
              scfg.bg,
              scfg.color,
            )}
          >
            {stage?.name ?? t.status}
          </span>
          <PriorityBadge priority={t.priority} />
          <span className="text-xs text-slate-500">
            {CATEGORY_LABELS[t.category]}
          </span>
          <span
            className={cn(
              "text-xs",
              overdue && "text-red-600 font-semibold",
              dueToday && "text-amber-600 font-semibold",
              !overdue && !dueToday && "text-slate-500",
            )}
          >
            {dueDate ? format(dueDate, "dd/MM/yy", { locale: ptBR }) : "—"}
            {overdue && " ⚠"}
            {dueToday && " · hoje"}
          </span>
        </div>
        {/* Mobile layout */}
        <div className="md:hidden flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-slate-800 dark:text-slate-100 leading-snug">
              {t.title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {board && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full inline-block",
                      BOARD_COLOR_DOT[board.color] ?? "bg-slate-400",
                    )}
                  />
                  {board.name}
                </span>
              )}
              <span
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded-full border",
                  scfg.bg,
                  scfg.color,
                )}
              >
                {stage?.name ?? t.status}
              </span>
              <PriorityBadge priority={t.priority} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
            <span
              className={cn(
                "text-xs font-medium",
                overdue && "text-red-600",
                dueToday && "text-amber-600",
                !overdue && !dueToday && "text-slate-500",
              )}
            >
              {dueDate ? format(dueDate, "dd/MM", { locale: ptBR }) : "—"}
            </span>
            {overdue && (
              <span className="text-[10px] text-red-500 font-semibold">
                vencida
              </span>
            )}
            {dueToday && (
              <span className="text-[10px] text-amber-500 font-semibold">
                hoje
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 py-16">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma tarefa atribuída a você.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-slate-800 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_100px_110px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b bg-slate-50 dark:bg-slate-900 px-4 py-2">
            <span>Tarefa</span>
            <span>Status</span>
            <span>Prioridade</span>
            <span>Categoria</span>
            <span>Prazo</span>
          </div>
          {pending.length > 0 && <>{pending.map(renderRow)}</>}
          {done.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/50 dark:bg-slate-900/50 border-t">
                Concluídas ({done.length})
              </div>
              {done.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function BoardCard({
  board,
  onClick,
  onEdit,
  onDelete,
  canManage,
  canDelete,
}: {
  board: TaskBoard;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canManage?: boolean;
  canDelete?: boolean;
}) {
  const headerGrad =
    BOARD_COLOR_HEADER[board.color] ?? BOARD_COLOR_HEADER.slate;
  return (
    <div
      onClick={onClick}
      className="rounded-xl border bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer overflow-hidden group"
    >
      <div className={cn("h-16 bg-gradient-to-r", headerGrad)} />
      <div className="p-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base truncate">
              {board.name}
            </h3>
            {board.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                {board.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {canManage && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="text-slate-400 hover:text-purple-600 p-1 rounded"
                title="Editar board"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && onDelete && !board.isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-red-400 hover:text-red-600 p-1 rounded"
                title="Excluir board"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {board.taskCount} tarefa{board.taskCount !== 1 ? "s" : ""}
          </span>
          {board.isDefault && (
            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
              Padrão
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add board dialog ─────────────────────────────────────────────────────────

function AddBoardDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/task-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Board criado com sucesso" });
      setName("");
      setColor("blue");
      setDescription("");
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Board</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nome *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marketing"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Descrição
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_CYCLE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    BOARD_COLOR_DOT[c] ?? "bg-slate-400",
                    color === c &&
                      "ring-2 ring-offset-2 ring-purple-500 scale-110",
                  )}
                ></button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!name.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Criando..." : "Criar Board"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit board dialog ────────────────────────────────────────────────────────

function EditBoardDialog({
  board,
  onClose,
}: {
  board: TaskBoard | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (board) {
      setName(board.name);
      setColor(board.color);
      setDescription(board.description ?? "");
    }
  }, [board]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/task-boards/${board!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Board atualizado" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!board} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Board</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nome *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marketing"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Descrição
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_CYCLE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    BOARD_COLOR_DOT[c] ?? "bg-slate-400",
                    color === c &&
                      "ring-2 ring-offset-2 ring-purple-500 scale-110",
                  )}
                ></button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!name.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create task dialog ───────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z.string().min(3, "Título deve ter ao menos 3 caracteres"),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Selecione um responsável"),
  dueDate: z.string().optional(),
  category: z.enum([
    "marketing",
    "operacao",
    "financeiro",
    "comercial",
    "outro",
  ]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]),
  status: z.string().min(1),
});
type CreateTaskForm = z.infer<typeof createTaskSchema>;

function CreateTaskDialog({
  open,
  onClose,
  platformUsers,
  stages,
  boardId,
}: {
  open: boolean;
  onClose: () => void;
  platformUsers: TaskUser[];
  stages: TaskStage[];
  boardId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      dueDate: "",
      category: "outro",
      priority: "media",
      status: stages[0]?.slug ?? "",
    },
  });

  const firstSlug = stages[0]?.slug;
  if (firstSlug && !form.getValues("status"))
    form.setValue("status", firstSlug);

  const mutation = useMutation({
    mutationFn: (data: CreateTaskForm) =>
      apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          boardId,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      queryClient.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Tarefa criada com sucesso" });
      form.reset();
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Preparar campanha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Descreva a tarefa..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {platformUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map(
                          (c) => (
                            <SelectItem key={c} value={c}>
                              {CATEGORY_LABELS[c]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map(
                          (p) => (
                            <SelectItem key={p} value={p}>
                              {PRIORITY_CONFIG[p].label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa inicial</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.slug} value={s.slug}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task detail dialog ───────────────────────────────────────────────────────

function TaskDetailDialog({
  taskId,
  onClose,
  canEdit,
  canDelete,
  platformUsers,
  stages,
  boardId,
}: {
  taskId: string | null;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
  platformUsers: TaskUser[];
  stages: TaskStage[];
  boardId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { data: task, isLoading } = useQuery<TaskWithComments>({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => apiFetch<TaskWithComments>(`/api/tasks/${taskId}`),
    enabled: !!taskId,
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      toast({ title: "Tarefa atualizada" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
      queryClient.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Tarefa excluída" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail", taskId] });
      setComment("");
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!taskId) return null;

  return (
    <Dialog open={!!taskId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90dvh] flex flex-col">
        {isLoading || !task ? (
          <div className="py-10 text-center text-slate-400">Carregando...</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                {canEdit && editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && titleDraft.trim()) {
                        patchMutation.mutate({ title: titleDraft.trim() });
                        setEditingTitle(false);
                      }
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    onBlur={() => {
                      if (
                        titleDraft.trim() &&
                        titleDraft.trim() !== task.title
                      ) {
                        patchMutation.mutate({ title: titleDraft.trim() });
                      }
                      setEditingTitle(false);
                    }}
                    className="flex-1 text-lg font-semibold bg-transparent outline-none border-b-2 border-purple-400 text-slate-900 dark:text-slate-100 leading-snug pr-2"
                  />
                ) : (
                  <DialogTitle
                    className={cn(
                      "text-lg leading-snug pr-8",
                      canEdit &&
                        "cursor-text hover:text-purple-700 dark:hover:text-purple-300 transition-colors",
                    )}
                    title={canEdit ? "Clique para editar o título" : undefined}
                    onClick={() => {
                      if (canEdit) {
                        setTitleDraft(task.title);
                        setEditingTitle(true);
                      }
                    }}
                  >
                    {task.title}
                  </DialogTitle>
                )}
                {canDelete && (
                  <button
                    onClick={() => deleteMutation.mutate()}
                    className="text-red-500 hover:text-red-700 p-1 rounded flex-shrink-0"
                    title="Excluir tarefa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-2">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <PriorityBadge priority={task.priority} />
                  <span className="text-xs px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                    {CATEGORY_LABELS[task.category]}
                  </span>
                  <DueDateBadge dueDate={task.dueDate} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <Select
                    value={task.status}
                    onValueChange={(v) => patchMutation.mutate({ status: v })}
                  >
                    <SelectTrigger className="h-7 text-xs w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.slug} value={s.slug}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Responsável:</span>
                    <Select
                      value={task.assigneeId}
                      onValueChange={(v) =>
                        patchMutation.mutate({ assigneeId: v })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {platformUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                    <User className="h-4 w-4" />
                    <span>{task.assignee?.name ?? "—"}</span>
                  </div>
                )}
                {task.description && (
                  <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                    {task.description}
                  </div>
                )}
                <Separator />
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" /> Comentários (
                    {task.comments.length})
                  </span>
                  {task.comments.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Nenhum comentário ainda.
                    </p>
                  )}
                  {task.comments.map((c) => (
                    <div key={c.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {c.user?.name ?? "Usuário"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {format(parseISO(c.createdAt), "dd/MM/yy HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 rounded px-3 py-2">
                        {c.content}
                      </p>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <Textarea
                      rows={2}
                      placeholder="Adicionar comentário..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="icon"
                      disabled={!comment.trim() || commentMutation.isPending}
                      onClick={() => commentMutation.mutate(comment.trim())}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Criada por {task.createdBy?.name ?? "—"} em{" "}
                  {format(parseISO(task.createdAt), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Notes view ───────────────────────────────────────────────────────────────

function NotesView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [addingSectionName, setAddingSectionName] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle",
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<
    NoteSection[]
  >({
    queryKey: ["note-sections"],
    queryFn: () => apiFetch<NoteSection[]>("/api/note-sections"),
  });

  const { data: sectionNotes = [] } = useQuery<Note[]>({
    queryKey: ["notes", selectedSectionId],
    queryFn: () =>
      apiFetch<Note[]>(`/api/notes?sectionId=${selectedSectionId}`),
    enabled: !!selectedSectionId,
  });

  const selectedNote =
    sectionNotes.find((n) => n.id === selectedNoteId) ?? null;

  // Sync editor state when note changes
  useEffect(() => {
    if (selectedNote) {
      setNoteTitle(selectedNote.title);
      setNoteContent(selectedNote.content);
      setSaveStatus("idle");
    }
  }, [selectedNote?.id]);

  const patchNoteMutation = useMutation({
    mutationFn: ({
      id,
      title,
      content,
    }: {
      id: string;
      title?: string;
      content?: string;
    }) =>
      apiFetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", selectedSectionId] });
      setSaveStatus("saved");
    },
    onError: () => setSaveStatus("idle"),
  });

  const triggerSave = useCallback(
    (id: string, title: string, content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(() => {
        patchNoteMutation.mutate({ id, title, content });
      }, 800);
    },
    [],
  );

  const handleTitleChange = (val: string) => {
    setNoteTitle(val);
    if (selectedNoteId) triggerSave(selectedNoteId, val, noteContent);
  };

  const handleContentChange = (val: string) => {
    setNoteContent(val);
    if (selectedNoteId) triggerSave(selectedNoteId, noteTitle, val);
  };

  const addSectionMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/note-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: COLOR_CYCLE[sections.length % COLOR_CYCLE.length],
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["note-sections"] });
      setSelectedSectionId((data as NoteSection).id);
      setAddingSectionName("");
      setShowAddSection(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/note-sections/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["note-sections"] });
      if (selectedSectionId === id) {
        setSelectedSectionId(null);
        setSelectedNoteId(null);
      }
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const renameSectionMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/note-sections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["note-sections"] }),
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saveRenameSection = (id: string) => {
    const trimmed = editingSectionName.trim();
    if (trimmed) renameSectionMutation.mutate({ id, name: trimmed });
    setEditingSectionId(null);
  };

  const addNoteMutation = useMutation({
    mutationFn: ({ title, sectionId }: { title: string; sectionId: string }) =>
      apiFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sectionId }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notes", selectedSectionId] });
      queryClient.invalidateQueries({ queryKey: ["note-sections"] });
      setSelectedNoteId((data as Note).id);
      setNewNoteTitle("");
      setCreateNoteOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/notes/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["notes", selectedSectionId] });
      queryClient.invalidateQueries({ queryKey: ["note-sections"] });
      if (selectedNoteId === id) setSelectedNoteId(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  return (
    <div
      className="flex rounded-xl border bg-white dark:bg-slate-800 overflow-hidden"
      style={{ minHeight: 520 }}
    >
      {/* Sidebar — full-width on mobile when no section selected, hidden when content visible */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-slate-50 dark:bg-slate-900 flex-col",
          "md:flex md:w-56",
          !selectedSectionId ? "flex w-full" : "hidden",
        )}
      >
        <div className="px-3 py-3 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Seções
          </span>
          <button
            onClick={() => setShowAddSection(true)}
            className="text-slate-400 hover:text-purple-600 transition-colors"
            title="Nova seção"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="py-1">
            {sectionsLoading && (
              <p className="text-xs text-slate-400 px-3 py-2">Carregando...</p>
            )}
            {sections.map((section) => (
              <div key={section.id}>
                <div
                  onClick={() => {
                    if (editingSectionId !== section.id) {
                      setSelectedSectionId(
                        selectedSectionId === section.id ? null : section.id,
                      );
                      setSelectedNoteId(null);
                    }
                  }}
                  onDoubleClick={() => {
                    setEditingSectionId(section.id);
                    setEditingSectionName(section.name);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors cursor-pointer select-none",
                    selectedSectionId === section.id
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                >
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      BOARD_COLOR_DOT[section.color] ?? "bg-slate-400",
                    )}
                  />
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                  {editingSectionId === section.id ? (
                    <input
                      autoFocus
                      value={editingSectionName}
                      onChange={(e) => setEditingSectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRenameSection(section.id);
                        if (e.key === "Escape") setEditingSectionId(null);
                      }}
                      onBlur={() => saveRenameSection(section.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-transparent outline-none border-b border-purple-400 text-sm font-medium"
                    />
                  ) : (
                    <span className="flex-1 truncate">{section.name}</span>
                  )}
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {section.noteCount}
                  </span>
                </div>
                {selectedSectionId === section.id && (
                  <div className="ml-5 border-l border-slate-200 dark:border-slate-700">
                    {sectionNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-xs transition-colors",
                          selectedNoteId === note.id
                            ? "text-purple-700 dark:text-purple-300 font-medium bg-purple-50 dark:bg-purple-900/10"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                        )}
                      >
                        <FileText className="h-3 w-3 flex-shrink-0 opacity-60" />
                        <span className="flex-1 truncate">{note.title}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setCreateNoteOpen(true)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-purple-600 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Nova nota
                    </button>
                  </div>
                )}
              </div>
            ))}

            {showAddSection ? (
              <div className="px-2 py-2">
                <input
                  autoFocus
                  value={addingSectionName}
                  onChange={(e) => setAddingSectionName(e.target.value)}
                  placeholder="Nome da seção..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addingSectionName.trim())
                      addSectionMutation.mutate(addingSectionName.trim());
                    if (e.key === "Escape") {
                      setAddingSectionName("");
                      setShowAddSection(false);
                    }
                  }}
                  onBlur={() => {
                    if (!addingSectionName.trim()) setShowAddSection(false);
                  }}
                  className="w-full text-sm bg-white dark:bg-slate-800 border rounded px-2 py-1 outline-none focus:border-purple-400"
                />
              </div>
            ) : (
              sections.length === 0 &&
              !sectionsLoading && (
                <p className="text-xs text-slate-400 px-3 py-3 text-center">
                  Nenhuma seção ainda.
                  <br />
                  Clique em + para criar.
                </p>
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Content area — hidden on mobile when no section selected */}
      <div
        className={cn(
          "flex-1 flex-col min-w-0",
          "md:flex",
          selectedSectionId ? "flex" : "hidden",
        )}
      >
        {!selectedSectionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
            <NotebookPen className="h-12 w-12 opacity-20" />
            <p className="text-sm">Selecione uma seção para ver as anotações</p>
            <button
              onClick={() => setShowAddSection(true)}
              className="text-xs text-purple-600 hover:underline"
            >
              Ou crie uma nova seção
            </button>
          </div>
        ) : !selectedNoteId ? (
          <div className="flex-1 flex flex-col">
            <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Back button on mobile */}
                <button
                  onClick={() => setSelectedSectionId(null)}
                  className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 -ml-1"
                  title="Voltar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span
                  className={cn(
                    "w-3 h-3 rounded-full",
                    BOARD_COLOR_DOT[selectedSection?.color ?? "slate"] ??
                      "bg-slate-400",
                  )}
                />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {selectedSection?.name}
                </h2>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {sectionNotes.length} nota
                  {sectionNotes.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateNoteOpen(true)}
                  className="text-xs h-7 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova nota
                </Button>
                <button
                  onClick={() =>
                    deleteSectionMutation.mutate(selectedSectionId)
                  }
                  className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                  title="Excluir seção"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4">
              {sectionNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <FileText className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Nenhuma nota nesta seção ainda.</p>
                  <button
                    onClick={() => setCreateNoteOpen(true)}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    Criar primeira nota
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sectionNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className="rounded-lg border bg-white dark:bg-slate-700 p-3 cursor-pointer hover:shadow-md transition-all group relative"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNoteMutation.mutate(note.id);
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate pr-6">
                        {note.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                        {note.content || "Sem conteúdo"}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {format(parseISO(note.updatedAt), "dd/MM/yy HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b flex items-center gap-3">
              <button
                onClick={() => setSelectedNoteId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                {/* Back to sidebar on mobile */}
                <button
                  onClick={() => {
                    setSelectedNoteId(null);
                    setSelectedSectionId(null);
                  }}
                  className="md:hidden text-purple-500 hover:text-purple-700 font-medium"
                  title="Voltar para seções"
                >
                  Seções
                </button>
                <span className="hidden md:inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      BOARD_COLOR_DOT[selectedSection?.color ?? "slate"] ??
                        "bg-slate-400",
                    )}
                  />
                  {selectedSection?.name}
                </span>
              </span>
              <div className="ml-auto flex items-center gap-1.5 text-xs">
                {saveStatus === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    <span className="text-slate-400">Salvando...</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">Salvo</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col p-6 gap-3 overflow-auto">
              <input
                value={noteTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-xl font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none border-b border-transparent focus:border-slate-200 dark:focus:border-slate-700 pb-1 transition-colors"
                placeholder="Título da nota"
              />
              <textarea
                value={noteContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Escreva sua anotação aqui..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-300 resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600 leading-relaxed"
                style={{ minHeight: 300 }}
              />
              <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t">
                <span>
                  {selectedNote?.createdBy?.name &&
                    `Criada por ${selectedNote.createdBy.name} · `}
                  {selectedNote &&
                    format(parseISO(selectedNote.createdAt), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                </span>
                <button
                  onClick={() => deleteNoteMutation.mutate(selectedNoteId)}
                  className="text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir nota
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog: criar nota */}
      <Dialog
        open={createNoteOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCreateNoteOpen(false);
            setNewNoteTitle("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Anotação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {selectedSection && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full inline-block",
                    BOARD_COLOR_DOT[selectedSection.color] ?? "bg-slate-400",
                  )}
                />
                Em: <span className="font-medium">{selectedSection.name}</span>
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Título *
              </label>
              <Input
                autoFocus
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Ex: Reunião com cliente"
                className="mt-1"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    newNoteTitle.trim() &&
                    selectedSectionId
                  ) {
                    addNoteMutation.mutate({
                      title: newNoteTitle.trim(),
                      sectionId: selectedSectionId,
                    });
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateNoteOpen(false);
                  setNewNoteTitle("");
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={!newNoteTitle.trim() || addNoteMutation.isPending}
                onClick={() => {
                  if (newNoteTitle.trim() && selectedSectionId) {
                    addNoteMutation.mutate({
                      title: newNoteTitle.trim(),
                      sectionId: selectedSectionId,
                    });
                  }
                }}
              >
                {addNoteMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Files view ───────────────────────────────────────────────────────────────

interface TaskFileFolder {
  id: string;
  name: string;
  color: string;
  order: number;
  createdById: string;
  createdAt: string;
  fileCount: number;
}

interface TaskFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  folderId: string;
  uploadedById: string;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  if (mimeType.startsWith("image/")) return <Image className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType.startsWith("audio/")) return <Music className={className} />;
  if (mimeType === "application/pdf")
    return <FileTextIcon className={className} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className={className} />;
  return <File className={className} />;
}

function fileColorClass(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "text-purple-500";
  if (mimeType.startsWith("video/")) return "text-blue-500";
  if (mimeType.startsWith("audio/")) return "text-pink-500";
  if (mimeType === "application/pdf") return "text-red-500";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "text-green-600";
  if (mimeType.includes("word")) return "text-blue-600";
  return "text-slate-500";
}

function FilesView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [addingFolderName, setAddingFolderName] = useState("");
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: folders = [], isLoading: foldersLoading } = useQuery<
    TaskFileFolder[]
  >({
    queryKey: ["task-file-folders"],
    queryFn: () => apiFetch<TaskFileFolder[]>("/api/task-file-folders"),
  });

  const { data: folderFiles = [], isLoading: filesLoading } = useQuery<
    TaskFile[]
  >({
    queryKey: ["task-files", selectedFolderId],
    queryFn: () =>
      apiFetch<TaskFile[]>(`/api/task-files?folderId=${selectedFolderId}`),
    enabled: !!selectedFolderId,
  });

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const addFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/task-file-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: COLOR_CYCLE[folders.length % COLOR_CYCLE.length],
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-file-folders"] });
      setSelectedFolderId((data as TaskFileFolder).id);
      setAddingFolderName("");
      setShowAddFolder(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/task-file-folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["task-file-folders"] }),
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saveRenameFolder = (id: string) => {
    const trimmed = editingFolderName.trim();
    if (trimmed) renameFolderMutation.mutate({ id, name: trimmed });
    setEditingFolderId(null);
  };

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/task-file-folders/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["task-file-folders"] });
      if (selectedFolderId === id) setSelectedFolderId(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/task-files/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-files", selectedFolderId],
      });
      queryClient.invalidateQueries({ queryKey: ["task-file-folders"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFolderId) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderId", selectedFolderId);

      const res = await fetch("/api/task-files/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Resposta inválida do servidor");
      }
      if (!res.ok)
        throw new Error(
          ((parsed as Record<string, unknown>)?.message as string) ??
            `Erro ${res.status}`,
        );

      queryClient.invalidateQueries({
        queryKey: ["task-files", selectedFolderId],
      });
      queryClient.invalidateQueries({ queryKey: ["task-file-folders"] });
      toast({ title: "Arquivo enviado com sucesso" });
    } catch (err) {
      toast({
        title: "Erro no upload",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="flex rounded-xl border bg-white dark:bg-slate-800 overflow-hidden"
      style={{ minHeight: 520 }}
    >
      {/* Sidebar — full-width on mobile when no folder selected, hidden when content visible */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-slate-50 dark:bg-slate-900 flex-col",
          "md:flex md:w-56",
          !selectedFolderId ? "flex w-full" : "hidden",
        )}
      >
        <div className="px-3 py-3 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Pastas
          </span>
          <button
            onClick={() => setShowAddFolder(true)}
            className="text-slate-400 hover:text-purple-600 transition-colors"
            title="Nova pasta"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="py-1">
            {foldersLoading && (
              <p className="text-xs text-slate-400 px-3 py-2">Carregando...</p>
            )}

            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => {
                  if (editingFolderId !== folder.id)
                    setSelectedFolderId(
                      selectedFolderId === folder.id ? null : folder.id,
                    );
                }}
                onDoubleClick={() => {
                  setEditingFolderId(folder.id);
                  setEditingFolderName(folder.name);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors cursor-pointer select-none",
                  selectedFolderId === folder.id
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full flex-shrink-0",
                    BOARD_COLOR_DOT[folder.color] ?? "bg-slate-400",
                  )}
                />
                <Folder className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                {editingFolderId === folder.id ? (
                  <input
                    autoFocus
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRenameFolder(folder.id);
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                    onBlur={() => saveRenameFolder(folder.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent outline-none border-b border-purple-400 text-sm font-medium"
                  />
                ) : (
                  <span className="flex-1 truncate">{folder.name}</span>
                )}
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {folder.fileCount}
                </span>
              </div>
            ))}

            {showAddFolder ? (
              <div className="px-2 py-2">
                <input
                  autoFocus
                  value={addingFolderName}
                  onChange={(e) => setAddingFolderName(e.target.value)}
                  placeholder="Nome da pasta..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addingFolderName.trim())
                      addFolderMutation.mutate(addingFolderName.trim());
                    if (e.key === "Escape") {
                      setAddingFolderName("");
                      setShowAddFolder(false);
                    }
                  }}
                  onBlur={() => {
                    if (!addingFolderName.trim()) setShowAddFolder(false);
                  }}
                  className="w-full text-sm bg-white dark:bg-slate-800 border rounded px-2 py-1 outline-none focus:border-purple-400"
                />
              </div>
            ) : (
              folders.length === 0 &&
              !foldersLoading && (
                <p className="text-xs text-slate-400 px-3 py-3 text-center">
                  Nenhuma pasta ainda.
                  <br />
                  Clique em + para criar.
                </p>
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Content — hidden on mobile when no folder selected */}
      <div
        className={cn(
          "flex-1 flex-col min-w-0",
          "md:flex",
          selectedFolderId ? "flex" : "hidden",
        )}
      >
        {!selectedFolderId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
            <Folder className="h-12 w-12 opacity-20" />
            <p className="text-sm">Selecione uma pasta para ver os arquivos</p>
            <button
              onClick={() => setShowAddFolder(true)}
              className="text-xs text-purple-600 hover:underline"
            >
              Ou crie uma nova pasta
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Back button on mobile */}
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 -ml-1"
                  title="Voltar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span
                  className={cn(
                    "w-3 h-3 rounded-full",
                    BOARD_COLOR_DOT[selectedFolder?.color ?? "slate"] ??
                      "bg-slate-400",
                  )}
                />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {selectedFolder?.name}
                </h2>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {folderFiles.length} arquivo
                  {folderFiles.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs h-7 gap-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Upload
                    </>
                  )}
                </Button>
                <button
                  onClick={() => deleteFolderMutation.mutate(selectedFolderId)}
                  className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                  title="Excluir pasta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Files grid */}
            <div className="flex-1 p-4 overflow-auto">
              {filesLoading ? (
                <div className="text-slate-400 text-sm">Carregando...</div>
              ) : folderFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <Upload className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Nenhum arquivo nesta pasta ainda.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    Fazer upload do primeiro arquivo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {folderFiles.map((file) => (
                    <div
                      key={file.id}
                      className="rounded-lg border bg-white dark:bg-slate-700 p-3 flex flex-col gap-2 group relative hover:shadow-md transition-all"
                    >
                      {/* Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-400 hover:text-blue-600 p-0.5 rounded"
                          title="Baixar / Abrir"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => deleteFileMutation.mutate(file.id)}
                          className="text-red-400 hover:text-red-600 p-0.5 rounded"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Icon */}
                      <div className="flex justify-center pt-2 pb-1">
                        <FileIcon
                          mimeType={file.mimeType}
                          className={cn(
                            "h-10 w-10",
                            fileColorClass(file.mimeType),
                          )}
                        />
                      </div>

                      {/* Info */}
                      <p
                        className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate text-center"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{formatBytes(file.size)}</span>
                        <span>
                          {format(parseISO(file.createdAt), "dd/MM/yy", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      {file.uploadedBy && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {file.uploadedBy.name.split(" ")[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TarefasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<TaskBoard | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const isGerente = user?.role === "gerente";
  const canManage = isAdmin || isGerente;

  // Boards
  const { data: boards = [], isLoading: boardsLoading } = useQuery<TaskBoard[]>(
    {
      queryKey: ["task-boards"],
      queryFn: () => apiFetch<TaskBoard[]>("/api/task-boards"),
      enabled: canManage,
    },
  );

  // Board-specific stages and tasks
  const { data: boardStages = [], isLoading: stagesLoading } = useQuery<
    TaskStage[]
  >({
    queryKey: ["task-stages", selectedBoardId],
    queryFn: () =>
      apiFetch<TaskStage[]>(`/api/task-stages?boardId=${selectedBoardId}`),
    enabled: !!selectedBoardId,
  });

  const { data: boardTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", selectedBoardId],
    queryFn: () => apiFetch<Task[]>(`/api/tasks?boardId=${selectedBoardId}`),
    enabled: !!selectedBoardId,
  });

  // All tasks + all stages for "Minhas Tarefas" list
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", "all"],
    queryFn: () => apiFetch<Task[]>("/api/tasks"),
  });

  const { data: allStages = [] } = useQuery<TaskStage[]>({
    queryKey: ["task-stages", "all"],
    queryFn: () => apiFetch<TaskStage[]>("/api/task-stages"),
  });

  // Platform users (admin/gerente only)
  const { data: platformUsers = [] } = useQuery<TaskUser[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch<TaskUser[]>("/api/users"),
    enabled: canManage,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const quickCreateMutation = useMutation({
    mutationFn: ({ title, status }: { title: string; status: string }) =>
      apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          boardId: selectedBoardId,
          assigneeId: user!.id,
          category: "outro",
          priority: "media",
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["task-boards"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const renameStageMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/task-stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["task-stages", selectedBoardId],
      }),
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addStageMutation = useMutation({
    mutationFn: (name: string) => {
      const color = COLOR_CYCLE[boardStages.length % COLOR_CYCLE.length];
      return apiFetch("/api/task-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, boardId: selectedBoardId }),
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["task-stages", selectedBoardId],
      }),
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "all"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/task-boards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Board excluído" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const myTasks = allTasks.filter((t) => t.assigneeId === user?.id);
  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const overdueCt = myTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = parseISO(t.dueDate);
    return isPast(d) && !isToday(d);
  }).length;

  const dueTodayCt = myTasks.filter((t) => {
    if (!t.dueDate) return false;
    return isToday(parseISO(t.dueDate));
  }).length;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={ClipboardList}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>
              {selectedBoard ? (
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedBoardId(null);
                      setSelectedTaskId(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  {selectedBoard.name}
                </span>
              ) : (
                "Tarefas"
              )}
            </PageHeader.Title>
            <PageHeader.Description>
              {selectedBoard ? (
                <>
                  {boardTasks.length} tarefa{boardTasks.length !== 1 ? "s" : ""}
                </>
              ) : (
                <span className="flex items-center gap-3">
                  {myTasks.length} tarefa{myTasks.length !== 1 ? "s" : ""}{" "}
                  atribuídas a mim
                  {overdueCt > 0 && (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      {overdueCt} vencida{overdueCt !== 1 ? "s" : ""}
                    </span>
                  )}
                  {dueTodayCt > 0 && (
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {dueTodayCt} vencem hoje
                    </span>
                  )}
                </span>
              )}
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          {selectedBoard && canManage && (
            <Button
              onClick={() => setCreateTaskOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Button>
          )}
          {!selectedBoard && canManage && (
            <Button
              variant="outline"
              onClick={() => setAddBoardOpen(true)}
              className="flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Novo Board
            </Button>
          )}
        </PageHeader.Actions>
      </PageHeader>

      {/* Board kanban drill-down */}
      {selectedBoard ? (
        <div className="flex-1">
          {stagesLoading || tasksLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Carregando...
            </div>
          ) : (
            <KanbanView
              tasks={boardTasks}
              stages={boardStages}
              boardId={selectedBoardId!}
              onOpen={(t) => setSelectedTaskId(t.id)}
              onDropToStatus={(id, slug) =>
                moveMutation.mutate({ id, status: slug })
              }
              onReorder={(orderedIds) => reorderMutation.mutate(orderedIds)}
              onQuickCreate={(title, slug) =>
                quickCreateMutation.mutate({ title, status: slug })
              }
              onRenameStage={(id, name) =>
                renameStageMutation.mutate({ id, name })
              }
              onAddStage={(name) => addStageMutation.mutate(name)}
              canManageStages={canManage}
            />
          )}
        </div>
      ) : (
        /* Tabs: Boards | Minhas Tarefas | Anotações | Arquivos */
        <AppTabs
          defaultValue={canManage ? "boards" : "minhas"}
          className="flex-1 flex flex-col"
        >
          <UnderlineTabsList>
            {canManage && (
              <UnderlineTabsTrigger value="boards" color="wine">
                <LayoutGrid className="h-3.5 w-3.5" />
                Boards
              </UnderlineTabsTrigger>
            )}
            <UnderlineTabsTrigger value="minhas" color="wine">
              <List className="h-3.5 w-3.5" />
              Minhas Tarefas
              {myTasks.filter((t) => {
                const stage = allStages.find((s) => s.slug === t.status);
                return !stage || !stage.name.toLowerCase().includes("conclu");
              }).length > 0 && (
                <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {
                    myTasks.filter((t) => {
                      const stage = allStages.find((s) => s.slug === t.status);
                      return (
                        !stage || !stage.name.toLowerCase().includes("conclu")
                      );
                    }).length
                  }
                </span>
              )}
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="anotacoes" color="wine">
              <NotebookPen className="h-3.5 w-3.5" />
              Anotações
            </UnderlineTabsTrigger>
            <UnderlineTabsTrigger value="arquivos" color="wine">
              <Folder className="h-3.5 w-3.5" />
              Arquivos
            </UnderlineTabsTrigger>
          </UnderlineTabsList>

          {canManage && (
            <AppTabsContent value="boards" className="flex-1">
              {boardsLoading ? (
                <div className="text-slate-400 text-sm">
                  Carregando boards...
                </div>
              ) : boards.length === 0 ? (
                <div className="text-center text-slate-400 py-16">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum board ainda.</p>
                  <button
                    onClick={() => setAddBoardOpen(true)}
                    className="text-primary text-sm hover:underline mt-1"
                  >
                    Criar primeiro board
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {boards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      onClick={() => setSelectedBoardId(board.id)}
                      onEdit={() => setEditingBoard(board)}
                      onDelete={() => deleteBoardMutation.mutate(board.id)}
                      canManage={canManage}
                      canDelete={isAdmin}
                    />
                  ))}
                  <button
                    onClick={() => setAddBoardOpen(true)}
                    className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary flex flex-col items-center justify-center gap-2 py-10 text-slate-400 hover:text-primary transition-colors"
                  >
                    <Plus className="h-8 w-8" />
                    <span className="text-sm font-medium">Novo Board</span>
                  </button>
                </div>
              )}
            </AppTabsContent>
          )}

          <AppTabsContent value="minhas" className="flex-1">
            <MyTasksListView
              tasks={myTasks}
              allStages={allStages}
              boards={boards}
              onOpen={(t) => setSelectedTaskId(t.id)}
            />
          </AppTabsContent>

          <AppTabsContent value="anotacoes" className="flex-1">
            <NotesView />
          </AppTabsContent>

          <AppTabsContent value="arquivos" className="flex-1">
            <FilesView />
          </AppTabsContent>
        </AppTabs>
      )}

      {/* Dialogs */}
      <AddBoardDialog
        open={addBoardOpen}
        onClose={() => setAddBoardOpen(false)}
      />
      <EditBoardDialog
        board={editingBoard}
        onClose={() => setEditingBoard(null)}
      />

      {selectedBoard && canManage && (
        <CreateTaskDialog
          open={createTaskOpen}
          onClose={() => setCreateTaskOpen(false)}
          platformUsers={platformUsers}
          stages={boardStages}
          boardId={selectedBoardId!}
        />
      )}

      <TaskDetailDialog
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        canEdit={canManage}
        canDelete={isAdmin}
        platformUsers={platformUsers}
        stages={selectedBoard ? boardStages : allStages}
        boardId={selectedBoardId ?? ""}
      />
    </div>
  );
}
