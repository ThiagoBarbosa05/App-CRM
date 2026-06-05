import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bot, Plus, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useWhatsappBots,
  useCreateBot,
  useDeleteBot,
  useToggleBotActive,
} from "@/hooks/use-whatsapp-bots";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WhatsappBot } from "@shared/schema";

const createBotSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    triggerType: z.enum(["keyword", "new_conversation"]),
    triggerKeyword: z.string().optional(),
  })
  .refine(
    (d) =>
      d.triggerType !== "keyword" || (d.triggerKeyword?.trim() ?? "").length > 0,
    { message: "Palavra-chave é obrigatória", path: ["triggerKeyword"] },
  );

type CreateBotForm = z.infer<typeof createBotSchema>;

function triggerLabel(bot: WhatsappBot) {
  if (bot.triggerType === "keyword") return `Palavra: "${bot.triggerKeyword}"`;
  return "Nova conversa";
}

export default function WhatsAppBotsList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: bots = [], isLoading } = useWhatsappBots();
  const createBot = useCreateBot();
  const deleteBot = useDeleteBot();
  const toggleActive = useToggleBotActive();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsappBot | null>(null);

  const form = useForm<CreateBotForm>({
    resolver: zodResolver(createBotSchema),
    defaultValues: { name: "", triggerType: "keyword", triggerKeyword: "" },
  });

  const triggerType = form.watch("triggerType");

  async function onSubmit(values: CreateBotForm) {
    try {
      const result = await createBot.mutateAsync(values);
      setShowCreate(false);
      form.reset();
      navigate(`/whatsapp/bots/${result.bot.id}/editor`);
    } catch {
      toast({ title: "Erro ao criar bot", variant: "destructive" });
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

  return (
    <div className="overflow-y-auto h-full p-5 lg:p-6">
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Bot}
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Bots</PageHeader.Title>
            <PageHeader.Description>Gerencie os fluxos de conversa automatizados</PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Bot
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando...
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum bot criado ainda.</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
            Criar primeiro bot
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bots.map((bot) => (
                <TableRow key={bot.id}>
                  <TableCell className="font-medium">{bot.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {triggerLabel(bot)}
                  </TableCell>
                  <TableCell>
                    {bot.isActive ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(bot.createdAt), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          navigate(`/whatsapp/bots/${bot.id}/editor`)
                        }
                        title="Editar fluxo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggle(bot)}
                        title={bot.isActive ? "Desativar" : "Ativar"}
                      >
                        {bot.isActive ? (
                          <PowerOff className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Power className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(bot)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Bot Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Bot</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
                name="triggerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gatilho</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="keyword">Palavra-chave</SelectItem>
                        <SelectItem value="new_conversation">
                          Nova conversa
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {triggerType === "keyword" && (
                <FormField
                  control={form.control}
                  name="triggerKeyword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Palavra-chave</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: oi, olá, menu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    form.reset();
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

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bot</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o bot{" "}
              <strong>{deleteTarget?.name}</strong>? Essa ação é irreversível e
              encerrará todas as sessões ativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
