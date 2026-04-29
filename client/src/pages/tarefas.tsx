import { useState } from "react";
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
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type TaskStatus = "a_fazer" | "em_andamento" | "aguardando_aprovacao" | "concluido";
type TaskPriority = "baixa" | "media" | "alta" | "urgente";
type TaskCategory = "marketing" | "operacao" | "financeiro" | "comercial" | "outro";

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
  status: TaskStatus;
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

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  a_fazer: { label: "A Fazer", color: "text-slate-700", bg: "bg-slate-100 border-slate-300" },
  em_andamento: { label: "Em Andamento", color: "text-blue-700", bg: "bg-blue-50 border-blue-300" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "text-amber-700", bg: "bg-amber-50 border-amber-300" },
  concluido: { label: "Concluído", color: "text-green-700", bg: "bg-green-50 border-green-300" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string }> = {
  baixa: { label: "Baixa", badge: "bg-slate-100 text-slate-600 border-slate-300" },
  media: { label: "Média", badge: "bg-blue-100 text-blue-700 border-blue-300" },
  alta: { label: "Alta", badge: "bg-orange-100 text-orange-700 border-orange-300" },
  urgente: { label: "Urgente", badge: "bg-red-100 text-red-700 border-red-300" },
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  marketing: "Marketing",
  operacao: "Operação",
  financeiro: "Financeiro",
  comercial: "Comercial",
  outro: "Outro",
};

const STATUS_ORDER: TaskStatus[] = [
  "a_fazer",
  "em_andamento",
  "aguardando_aprovacao",
  "concluido",
];

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...options });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      res.ok
        ? `Resposta inválida do servidor (${res.status}): ${preview}`
        : `Erro ${res.status}: resposta não-JSON do servidor`
    );
  }
  if (!res.ok) {
    const body = parsed as Record<string, unknown>;
    throw new Error((body?.message as string) ?? `Erro ${res.status}`);
  }
  return parsed;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", cfg.badge)}>
      {cfg.label}
    </span>
  );
}

// ─── Task card (Kanban) ───────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-0.5 mt-1">
        {task.assignee && (
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.assignee.name.split(" ")[0]}
          </span>
        )}
        <DueDateBadge dueDate={task.dueDate} />
      </div>
    </div>
  );
}

// ─── Kanban view ─────────────────────────────────────────────────────────────

function KanbanView({
  tasks,
  onOpen,
  onDropToStatus,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onDropToStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find((t) => t.id === taskId);
    if (taskId && task && task.status !== status) {
      onDropToStatus(taskId, status);
    }
    setDraggedId(null);
    setOverStatus(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 h-full">
      {STATUS_ORDER.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const col = tasks.filter((t) => t.status === status);
        const isOver = overStatus === status;
        const draggedTask = tasks.find((t) => t.id === draggedId);
        const isSameCol = draggedTask?.status === status;

        return (
          <div
            key={status}
            className="flex flex-col gap-3"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverStatus(status);
            }}
            onDragLeave={(e) => {
              // só limpa se saiu da coluna inteira (não de um filho)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverStatus(null);
              }
            }}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className={cn("rounded-lg border px-3 py-2 flex items-center justify-between transition-colors", cfg.bg)}>
              <span className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full bg-white/70", cfg.color)}>
                {col.length}
              </span>
            </div>
            <div
              className={cn(
                "flex flex-col gap-2 min-h-[120px] rounded-lg transition-all p-1 -m-1",
                isOver && !isSameCol && "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-400 ring-dashed",
              )}
            >
              {col.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onOpen={onOpen}
                  onDragStart={setDraggedId}
                  isDragging={draggedId === t.id}
                />
              ))}
              {col.length === 0 && (
                <div className={cn(
                  "text-xs text-slate-400 dark:text-slate-500 text-center mt-4 transition-opacity",
                  isOver && "opacity-0",
                )}>
                  Nenhuma tarefa
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List view ───────────────────────────────────────────────────────────────

function ListView({
  tasks,
  onOpen,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
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
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white dark:bg-slate-800 overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_110px_130px] gap-0 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b bg-slate-50 dark:bg-slate-900 px-4 py-2">
          <span>Tarefa</span>
          <span>Responsável</span>
          <span>Status</span>
          <span>Prioridade</span>
          <span>Prazo</span>
        </div>
        {filtered.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-10">
            Nenhuma tarefa encontrada
          </div>
        )}
        {filtered.map((t) => {
          const dueDate = t.dueDate ? parseISO(t.dueDate) : null;
          const overdue = dueDate && isPast(dueDate) && !isToday(dueDate);
          const dueToday = dueDate && isToday(dueDate);
          const scfg = STATUS_CONFIG[t.status];
          return (
            <div
              key={t.id}
              onClick={() => onOpen(t)}
              className={cn(
                "grid grid-cols-[1fr_140px_120px_110px_130px] gap-0 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 items-center text-sm",
                overdue && "bg-red-50/40 dark:bg-red-900/10",
                dueToday && !overdue && "bg-amber-50/40 dark:bg-amber-900/10",
              )}
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{t.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{CATEGORY_LABELS[t.category]}</p>
              </div>
              <span className="text-slate-600 dark:text-slate-300 text-xs">
                {t.assignee?.name.split(" ").slice(0, 2).join(" ") ?? "—"}
              </span>
              <span className={cn("text-xs font-medium px-2 py-1 rounded-full border w-fit", scfg.bg, scfg.color)}>
                {scfg.label}
              </span>
              <PriorityBadge priority={t.priority} />
              <span className={cn(
                "text-xs",
                overdue && "text-red-600 font-semibold",
                dueToday && "text-amber-600 font-semibold",
                !overdue && !dueToday && "text-slate-500",
              )}>
                {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                {overdue && " ⚠"}
                {dueToday && " ·hoje"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Create task form ─────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z.string().min(3, "Título deve ter ao menos 3 caracteres"),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Selecione um responsável"),
  dueDate: z.string().optional(),
  category: z.enum(["marketing", "operacao", "financeiro", "comercial", "outro"]),
  priority: z.enum(["baixa", "media", "alta", "urgente"]),
  status: z.enum(["a_fazer", "em_andamento", "aguardando_aprovacao", "concluido"]),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

function CreateTaskDialog({
  open,
  onClose,
  platformUsers,
}: {
  open: boolean;
  onClose: () => void;
  platformUsers: TaskUser[];
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
      status: "a_fazer",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateTaskForm) =>
      apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa criada com sucesso" });
      form.reset();
      onClose();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl><Input placeholder="Ex: Preparar campanha de páscoa" {...field} /></FormControl>
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
                  <FormControl><Textarea rows={3} placeholder="Descreva a tarefa..." {...field} /></FormControl>
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
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {platformUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
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
                    <FormControl><Input type="date" {...field} /></FormControl>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                        ))}
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                          <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
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
}: {
  taskId: string | null;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
  platformUsers: TaskUser[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus | "">("");

  const { data: task, isLoading } = useQuery<TaskWithComments>({
    queryKey: ["tasks", taskId],
    queryFn: () => apiFetch(`/api/tasks/${taskId}`),
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
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa atualizada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa excluída" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      setComment("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleStatusChange = (newStatus: TaskStatus) => {
    patchMutation.mutate({ status: newStatus });
    setEditStatus("");
  };

  if (!taskId) return null;

  return (
    <Dialog open={!!taskId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        {isLoading || !task ? (
          <div className="py-10 text-center text-slate-400">Carregando...</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-lg leading-snug pr-8">{task.title}</DialogTitle>
                {canDelete && (
                  <button
                    onClick={() => deleteMutation.mutate()}
                    className="text-red-500 hover:text-red-700 p-1 rounded"
                    title="Excluir tarefa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-2">
              <div className="flex flex-col gap-4">
                {/* Meta info */}
                <div className="flex flex-wrap gap-2 items-center">
                  <PriorityBadge priority={task.priority} />
                  <span className="text-xs px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                    {CATEGORY_LABELS[task.category]}
                  </span>
                  <DueDateBadge dueDate={task.dueDate} />
                </div>

                {/* Status selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <Select
                    value={task.status}
                    onValueChange={(v) => handleStatusChange(v as TaskStatus)}
                  >
                    <SelectTrigger className="h-7 text-xs w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Responsável:</span>
                    <Select
                      value={task.assigneeId}
                      onValueChange={(v) => patchMutation.mutate({ assigneeId: v })}
                    >
                      <SelectTrigger className="h-7 text-xs w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {platformUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
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

                {/* Description */}
                {task.description && (
                  <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                    {task.description}
                  </div>
                )}

                <Separator />

                {/* Comments */}
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Comentários ({task.comments.length})
                  </span>

                  {task.comments.length === 0 && (
                    <p className="text-xs text-slate-400">Nenhum comentário ainda.</p>
                  )}

                  {task.comments.map((c) => (
                    <div key={c.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {c.user?.name ?? "Usuário"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {format(parseISO(c.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/40 rounded px-3 py-2">
                        {c.content}
                      </p>
                    </div>
                  ))}

                  {/* Add comment */}
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

                {/* Footer meta */}
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Criada por {task.createdBy?.name ?? "—"} em{" "}
                  {format(parseISO(task.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TarefasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const isGerente = user?.role === "gerente";
  const canManage = isAdmin || isGerente;

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => apiFetch("/api/tasks"),
  });

  const { data: platformUsers = [] } = useQuery<TaskUser[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch("/api/users"),
    enabled: canManage,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleDropToStatus = (taskId: string, status: TaskStatus) => {
    moveMutation.mutate({ id: taskId, status });
  };

  const myTasks = tasks.filter((t) => t.assigneeId === user?.id);

  const overdueCt = tasks.filter((t) => {
    if (!t.dueDate || t.status === "concluido") return false;
    return isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate));
  }).length;

  const dueTodayCt = tasks.filter((t) => {
    if (!t.dueDate || t.status === "concluido") return false;
    return isToday(parseISO(t.dueDate));
  }).length;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-purple-600" />
            Tarefas
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
            </span>
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
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        )}
      </div>

      {/* Views */}
      <Tabs defaultValue={canManage ? "kanban" : "minhas"} className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          {canManage && (
            <>
              <TabsTrigger value="kanban" className="flex items-center gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="lista" className="flex items-center gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" /> Lista
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="minhas" className="flex items-center gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" /> Minhas Tarefas
            {myTasks.filter((t) => t.status !== "concluido").length > 0 && (
              <span className="ml-1 bg-purple-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {myTasks.filter((t) => t.status !== "concluido").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Carregando tarefas...
          </div>
        ) : (
          <>
            {canManage && (
              <>
                <TabsContent value="kanban" className="flex-1 mt-4">
                  <KanbanView
                    tasks={tasks}
                    onOpen={(t) => setSelectedTaskId(t.id)}
                    onDropToStatus={handleDropToStatus}
                  />
                </TabsContent>
                <TabsContent value="lista" className="flex-1 mt-4">
                  <ListView tasks={tasks} onOpen={(t) => setSelectedTaskId(t.id)} />
                </TabsContent>
              </>
            )}
            <TabsContent value="minhas" className="flex-1 mt-4">
              {myTasks.length === 0 ? (
                <div className="text-center text-slate-400 dark:text-slate-500 py-16">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma tarefa atribuída a você.</p>
                </div>
              ) : (
                <KanbanView
                  tasks={myTasks}
                  onOpen={(t) => setSelectedTaskId(t.id)}
                  onDropToStatus={handleDropToStatus}
                />
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialogs */}
      {canManage && (
        <CreateTaskDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          platformUsers={platformUsers}
        />
      )}
      <TaskDetailDialog
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        canEdit={canManage}
        canDelete={isAdmin}
        platformUsers={platformUsers}
      />
    </div>
  );
}
