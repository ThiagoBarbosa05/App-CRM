import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  History,
  Filter,
  Check,
  ChevronDown,
  Calendar as CalendarIcon,
  MessageCircle,
  AlertCircle,
  Bot as BotIcon,
  Smartphone,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWhatsappBots } from "@/hooks/use-whatsapp-bots";
import {
  useWhatsappBotDispatchHistory,
  type BotDispatchHistoryRow,
} from "@/hooks/use-whatsapp";

const STATUS_CONFIG: Record<
  BotDispatchHistoryRow["status"],
  { label: string; className: string }
> = {
  active: { label: "Em execução", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  completed: { label: "Finalizado", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  timed_out: { label: "Expirado", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  failed: { label: "Erro", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const PAGE_SIZE = 25;

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

export default function WhatsAppBotHistory() {
  const [, navigate] = useLocation();
  const { data: bots = [] } = useWhatsappBots();

  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [botSearch, setBotSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BotDispatchHistoryRow["status"] | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [errorRow, setErrorRow] = useState<BotDispatchHistoryRow | null>(null);

  const filteredBots = useMemo(
    () => bots.filter((b) => b.name.toLowerCase().includes(botSearch.toLowerCase())),
    [bots, botSearch],
  );

  function toggleBot(botId: string) {
    setSelectedBotIds((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId],
    );
    setPage(1);
  }

  const { data, isLoading } = useWhatsappBotDispatchHistory({
    botIds: selectedBotIds.length > 0 ? selectedBotIds : undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    dateFrom: dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateTo: dateRange?.to ? dateRange.to.toISOString() : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="overflow-y-auto h-full p-3 sm:p-5 lg:p-6">
      <div className="space-y-4 sm:space-y-6 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon
              icon={History}
              color="text-indigo-600 dark:text-indigo-400"
              bgColor="bg-indigo-50 dark:bg-indigo-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Histórico de Bots</PageHeader.Title>
              <PageHeader.Description>
                Acompanhe cada disparo de bot (manual ou por campanha) e veja o
                detalhe do erro quando um envio falhar
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
        </PageHeader>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left sm:w-56 h-9",
                  selectedBotIds.length > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/40",
                )}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">
                  {selectedBotIds.length > 0
                    ? `${selectedBotIds.length} bot${selectedBotIds.length !== 1 ? "s" : ""} selecionado${selectedBotIds.length !== 1 ? "s" : ""}`
                    : "Todos os bots"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Pesquisar bot..."
                  value={botSearch}
                  onValueChange={setBotSearch}
                  className="h-9"
                />
                <CommandList className="max-h-64">
                  <CommandEmpty>Nenhum bot encontrado.</CommandEmpty>
                  {filteredBots.map((bot) => {
                    const selected = selectedBotIds.includes(bot.id);
                    return (
                      <CommandItem
                        key={bot.id}
                        value={bot.name}
                        onSelect={() => toggleBot(bot.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            selected ? "bg-primary border-primary" : "border-border",
                          )}
                        >
                          {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        <BotIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{bot.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
                {selectedBotIds.length > 0 && (
                  <div className="border-t p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBotIds([]);
                        setPage(1);
                      }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 rounded hover:bg-muted/50"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(STATUS_CONFIG) as BotDispatchHistoryRow["status"][]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 text-sm font-medium justify-start sm:w-56">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <span className="truncate">
                      {format(dateRange.from, "dd/MM/yy")} — {format(dateRange.to, "dd/MM/yy")}
                    </span>
                  ) : (
                    format(dateRange.from, "dd/MM/yy")
                  )
                ) : (
                  <span>Data da execução</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  setPage(1);
                  if (range?.from && range?.to) setIsCalendarOpen(false);
                }}
                numberOfMonths={2}
                locale={ptBR}
              />
              {dateRange?.from && (
                <div className="border-t p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDateRange(undefined);
                      setPage(1);
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 rounded hover:bg-muted/50"
                  >
                    Limpar período
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Resultados */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center px-4 border border-dashed border-border rounded-xl">
            <History className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum disparo de bot encontrado para os filtros aplicados</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="p-4 space-y-2 border border-border rounded-lg bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.botName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {row.clientName ?? row.phoneNumber}
                      </p>
                    </div>
                    <Badge className={cn(STATUS_CONFIG[row.status].className, "border-0 shrink-0")}>
                      {STATUS_CONFIG[row.status].label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Início: {formatDate(row.startedAt)}</span>
                    <span className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> {row.channelName ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      disabled={!row.conversationId}
                      onClick={() => navigate(`/whatsapp/conversas?phone=${encodeURIComponent(row.phoneNumber)}`)}
                    >
                      <MessageCircle className="h-3 w-3" /> Conversa
                    </Button>
                    {row.status === "failed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-red-600 dark:text-red-400"
                        onClick={() => setErrorRow(row)}
                      >
                        <AlertCircle className="h-3 w-3" /> Ver erro
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Bot</TableHead>
                    <TableHead>Cliente / Telefone</TableHead>
                    <TableHead>Iniciado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Instância</TableHead>
                    <TableHead className="text-right pr-6">Conversa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <BotIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{row.botName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="truncate">{row.clientName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.phoneNumber}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(row.startedAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={cn(STATUS_CONFIG[row.status].className, "border-0")}>
                            {STATUS_CONFIG[row.status].label}
                          </Badge>
                          {row.status === "failed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 dark:text-red-400"
                              title="Ver detalhe do erro"
                              onClick={() => setErrorRow(row)}
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.channelName ? (
                          <span className="flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 shrink-0" />
                            {row.channelName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Abrir conversa"
                          disabled={!row.conversationId}
                          onClick={() => navigate(`/whatsapp/conversas?phone=${encodeURIComponent(row.phoneNumber)}`)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {total} disparo{total !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detalhe do erro */}
      <Dialog open={!!errorRow} onOpenChange={(open) => !open && setErrorRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Detalhe do erro
            </DialogTitle>
            <DialogDescription>
              {errorRow?.botName} · {errorRow?.clientName ?? errorRow?.phoneNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {errorRow?.completionReasonLabel && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Motivo</p>
                <p>{errorRow.completionReasonLabel}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem de erro</p>
              <pre className="whitespace-pre-wrap break-words text-xs bg-muted rounded-md p-3 max-h-64 overflow-y-auto">
                {errorRow?.errorMessage ?? "Nenhuma mensagem de erro registrada."}
              </pre>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Iniciado: {formatDate(errorRow?.startedAt)}</span>
              <span>Finalizado: {formatDate(errorRow?.completedAt)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
