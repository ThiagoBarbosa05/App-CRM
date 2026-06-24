import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Copy,
  MoreHorizontal,
  Search,
  Workflow,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  useWhatsappBots,
  useCreateBot,
  useUpdateBot,
  useDeleteBot,
  useDuplicateBot,
  useToggleBotActive,
} from "@/hooks/use-whatsapp-bots";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WhatsappBot } from "@shared/schema";

const botFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type BotForm = z.infer<typeof botFormSchema>;

type StatusFilter = "all" | "active" | "inactive";

// Mobile card for each bot
function BotMobileCard({
  bot,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onNavigate,
  duplicatePending,
  togglePending,
}: {
  bot: WhatsappBot;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onNavigate: () => void;
  duplicatePending: boolean;
  togglePending: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <button
        type="button"
        className="flex items-start gap-3 flex-1 min-w-0 text-left"
        onClick={onNavigate}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{bot.name}</p>
            {bot.isActive ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-100 shrink-0">
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">Inativo</Badge>
            )}
          </div>
          {bot.description && (
            <p className="text-xs text-muted-foreground truncate">{bot.description}</p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            {format(new Date(bot.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={`Ações do bot ${bot.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onNavigate}>
            <Workflow className="mr-2 h-4 w-4" />
            Editar fluxo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar dados
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate} disabled={duplicatePending}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggle} disabled={togglePending}>
            {bot.isActive ? (
              <><PowerOff className="mr-2 h-4 w-4" />Desativar</>
            ) : (
              <><Power className="mr-2 h-4 w-4" />Ativar</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function WhatsAppBotsList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: bots = [], isLoading } = useWhatsappBots();
  const createBot = useCreateBot();
  const updateBot = useUpdateBot();
  const deleteBot = useDeleteBot();
  const duplicateBot = useDuplicateBot();
  const toggleActive = useToggleBotActive();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<WhatsappBot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WhatsappBot | null>(null);

  const createForm = useForm<BotForm>({
    resolver: zodResolver(botFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<BotForm>({
    resolver: zodResolver(botFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const filteredBots = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bots.filter((bot) => {
      if (statusFilter === "active" && !bot.isActive) return false;
      if (statusFilter === "inactive" && bot.isActive) return false;
      if (!term) return true;
      return (
        bot.name.toLowerCase().includes(term) ||
        (bot.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [bots, search, statusFilter]);

  async function onCreate(values: BotForm) {
    try {
      const result = await createBot.mutateAsync({
        name: values.name,
        description: values.description?.trim() || undefined,
      });
      setShowCreate(false);
      createForm.reset();
      navigate(`/whatsapp/bots/${result.bot.id}/editor`);
    } catch {
      toast({ title: "Erro ao criar bot", variant: "destructive" });
    }
  }

  function openEdit(bot: WhatsappBot) {
    setEditTarget(bot);
    editForm.reset({ name: bot.name, description: bot.description ?? "" });
  }

  async function onEdit(values: BotForm) {
    if (!editTarget) return;
    try {
      await updateBot.mutateAsync({
        botId: editTarget.id,
        data: {
          name: values.name,
          description: values.description?.trim() || null,
        },
      });
      setEditTarget(null);
      toast({ title: "Bot atualizado" });
    } catch {
      toast({ title: "Erro ao atualizar bot", variant: "destructive" });
    }
  }

  async function onDuplicate(bot: WhatsappBot) {
    try {
      await duplicateBot.mutateAsync(bot.id);
      toast({ title: "Bot duplicado" });
    } catch {
      toast({ title: "Erro ao duplicar bot", variant: "destructive" });
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteBot.mutateAsync(deleteTarget.id);
      toast({ title: "Bot excluído" });
    } catch {
      toast({ title: "Erro ao excluir bot", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function onToggle(bot: WhatsappBot) {
    try {
      await toggleActive.mutateAsync({ botId: bot.id, active: !bot.isActive });
      toast({ title: bot.isActive ? "Bot desativado" : "Bot ativado" });
    } catch {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  }

  const hasBots = bots.length > 0;

  return (
    <div className="overflow-y-auto h-full p-3 sm:p-5 lg:p-6">
      <div className="space-y-4 sm:space-y-6 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={Bot}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Bots</PageHeader.Title>
              <PageHeader.Description>
                Fluxos de conversa automatizados, iniciados manualmente ou por
                campanha
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            <Button onClick={() => setShowCreate(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Novo Bot
            </Button>
          </PageHeader.Actions>
        </PageHeader>

        {/* Toolbar: busca + filtro de status */}
        {(hasBots || isLoading) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar bots..."
                className="pl-9"
              />
            </div>
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="active">Ativos</ToggleGroupItem>
              <ToggleGroupItem value="inactive">Inativos</ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {isLoading ? (
          <div className="border rounded-lg divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        ) : !hasBots ? (
          <div className="text-center py-16 text-muted-foreground border rounded-lg">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum bot criado ainda.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              Criar primeiro bot
            </Button>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-lg">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum bot encontrado para os filtros aplicados.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-border">
              {filteredBots.map((bot) => (
                <BotMobileCard
                  key={bot.id}
                  bot={bot}
                  onNavigate={() => navigate(`/whatsapp/bots/${bot.id}/editor`)}
                  onEdit={() => openEdit(bot)}
                  onDuplicate={() => onDuplicate(bot)}
                  onToggle={() => onToggle(bot)}
                  onDelete={() => setDeleteTarget(bot)}
                  duplicatePending={duplicateBot.isPending}
                  togglePending={toggleActive.isPending}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="w-[60px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBots.map((bot) => (
                    <TableRow
                      key={bot.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/whatsapp/bots/${bot.id}/editor`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            <Bot className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{bot.name}</p>
                            {bot.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-xs">
                                {bot.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {bot.isActive ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-100">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(bot.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ações do bot ${bot.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/whatsapp/bots/${bot.id}/editor`)}
                            >
                              <Workflow className="mr-2 h-4 w-4" />
                              Editar fluxo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(bot)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar dados
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDuplicate(bot)}
                              disabled={duplicateBot.isPending}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onToggle(bot)}
                              disabled={toggleActive.isPending}
                            >
                              {bot.isActive ? (
                                <><PowerOff className="mr-2 h-4 w-4" />Desativar</>
                              ) : (
                                <><Power className="mr-2 h-4 w-4" />Ativar</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(bot)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Create Bot Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
            <DialogHeader>
              <DialogTitle>Novo Bot</DialogTitle>
              <DialogDescription>
                Dê um nome ao bot. Você montará o fluxo na próxima etapa.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onCreate)}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Bot de Boas-vindas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Para que serve este bot?"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      createForm.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createBot.isPending}>
                    {createBot.isPending ? "Criando..." : "Criar e editar fluxo"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Bot Dialog */}
        <Dialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
            <DialogHeader>
              <DialogTitle>Editar bot</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit(onEdit)}
                className="space-y-4"
              >
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {editTarget && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Bot ativo</p>
                      <p className="text-xs text-muted-foreground">
                        Bots inativos não podem ser usados em campanhas.
                      </p>
                    </div>
                    <Switch
                      checked={editTarget.isActive}
                      onCheckedChange={() => onToggle(editTarget)}
                      disabled={toggleActive.isPending}
                    />
                  </div>
                )}
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditTarget(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateBot.isPending}>
                    {updateBot.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir bot</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o bot{" "}
                <strong>{deleteTarget?.name}</strong>? Essa ação é irreversível e
                encerrará todas as sessões ativas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
