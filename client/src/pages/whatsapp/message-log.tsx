import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ScrollText,
  Filter,
  Check,
  ChevronDown,
  Calendar as CalendarIcon,
  MessageCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useDebounce } from "@/hooks/use-debounce";
import {
  useWhatsappChannels,
  useWhatsappMessageLog,
  type WhatsappMessageLogRow,
} from "@/hooks/use-whatsapp";

type StatusFilter = NonNullable<WhatsappMessageLogRow["status"]>;

const MESSAGE_STATUS_CONFIG: Record<StatusFilter, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  delivered: { label: "Entregue", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  read: { label: "Lido", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  failed: { label: "Erro", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const NO_STATUS_CONFIG = { label: "—", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };

const PAGE_SIZE = 25;

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function counterpartLabel(row: WhatsappMessageLogRow) {
  const ours = row.channelName ?? row.channelDisplayPhone ?? "Canal";
  const theirs = row.clientName ?? row.contactName ?? row.contactPhone;
  return row.direction === "outbound" ? `${ours} → ${theirs}` : `${theirs} → ${ours}`;
}

export default function WhatsAppMessageLog() {
  const [, navigate] = useLocation();
  const { data: channels = [] } = useWhatsappChannels();

  const [directionFilter, setDirectionFilter] = useState<WhatsappMessageLogRow["direction"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter | "all">("all");
  const [originFilter, setOriginFilter] = useState<"manual" | "campaign" | "all">("all");
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [channelSearch, setChannelSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [errorRow, setErrorRow] = useState<WhatsappMessageLogRow | null>(null);

  const filteredChannels = useMemo(
    () => channels.filter((c) => c.name.toLowerCase().includes(channelSearch.toLowerCase())),
    [channels, channelSearch],
  );

  function toggleChannel(channelId: number) {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId],
    );
    setPage(1);
  }

  const { data, isLoading } = useWhatsappMessageLog({
    direction: directionFilter === "all" ? undefined : directionFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    origin: originFilter === "all" ? undefined : originFilter,
    channelIds: selectedChannelIds.length > 0 ? selectedChannelIds : undefined,
    search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
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
              icon={ScrollText}
              color="text-indigo-600 dark:text-indigo-400"
              bgColor="bg-indigo-50 dark:bg-indigo-900/30"
            />
            <PageHeader.Text>
              <PageHeader.Title>Log de Mensagens</PageHeader.Title>
              <PageHeader.Description>
                Rastreie envios e recebimentos de WhatsApp — identifique remetente,
                destinatário e o motivo de cada falha de envio
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
        </PageHeader>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <div className="relative sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por telefone ou nome"
              className="h-9 pl-8"
            />
          </div>

          <Select
            value={directionFilter}
            onValueChange={(v) => {
              setDirectionFilter(v as typeof directionFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as direções</SelectItem>
              <SelectItem value="outbound">Enviadas</SelectItem>
              <SelectItem value="inbound">Recebidas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(MESSAGE_STATUS_CONFIG) as StatusFilter[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {MESSAGE_STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={originFilter}
            onValueChange={(v) => {
              setOriginFilter(v as typeof originFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="campaign">Campanha</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left sm:w-56 h-9",
                  selectedChannelIds.length > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/40",
                )}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">
                  {selectedChannelIds.length > 0
                    ? `${selectedChannelIds.length} canal${selectedChannelIds.length !== 1 ? "is" : ""} selecionado${selectedChannelIds.length !== 1 ? "s" : ""}`
                    : "Todos os canais"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Pesquisar canal..."
                  value={channelSearch}
                  onValueChange={setChannelSearch}
                  className="h-9"
                />
                <CommandList className="max-h-64">
                  <CommandEmpty>Nenhum canal encontrado.</CommandEmpty>
                  {filteredChannels.map((channel) => {
                    const selected = selectedChannelIds.includes(channel.id);
                    return (
                      <CommandItem
                        key={channel.id}
                        value={channel.name}
                        onSelect={() => toggleChannel(channel.id)}
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
                        <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{channel.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
                {selectedChannelIds.length > 0 && (
                  <div className="border-t p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChannelIds([]);
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
                  <span>Período</span>
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
            <ScrollText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada para os filtros aplicados</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {rows.map((row) => {
                const statusConfig = row.status ? MESSAGE_STATUS_CONFIG[row.status] : NO_STATUS_CONFIG;
                return (
                  <div key={row.id} className="p-4 space-y-2 border border-border rounded-lg bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{counterpartLabel(row)}</p>
                        {row.sentByUserName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">via {row.sentByUserName}</p>
                        )}
                        {row.campaignName && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Campanha: {row.campaignName}
                          </Badge>
                        )}
                      </div>
                      <Badge className={cn(statusConfig.className, "border-0 shrink-0")}>{statusConfig.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(row.effectiveAt)}</span>
                      <span className="flex items-center gap-1">
                        {row.direction === "outbound" ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3" />
                        )}
                        {row.direction === "outbound" ? "Enviada" : "Recebida"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Smartphone className="h-3 w-3" /> {row.channelName ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => navigate(`/whatsapp/conversas?conversationId=${row.conversationId}`)}
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
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Data/Hora</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>Remetente / Destinatário</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Conversa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const statusConfig = row.status ? MESSAGE_STATUS_CONFIG[row.status] : NO_STATUS_CONFIG;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="pl-6 text-muted-foreground text-sm">
                          {formatDate(row.effectiveAt)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            {row.direction === "outbound" ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            )}
                            {row.direction === "outbound" ? "Enviada" : "Recebida"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="truncate">{counterpartLabel(row)}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {row.sentByUserName && (
                              <span className="text-xs text-muted-foreground">via {row.sentByUserName}</span>
                            )}
                            {row.campaignName && (
                              <Badge variant="outline" className="text-xs">
                                Campanha: {row.campaignName}
                              </Badge>
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
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge className={cn(statusConfig.className, "border-0")}>{statusConfig.label}</Badge>
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
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Abrir conversa"
                            onClick={() => navigate(`/whatsapp/conversas?conversationId=${row.conversationId}`)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {total} mensage{total !== 1 ? "ns" : "m"}
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
              {errorRow ? counterpartLabel(errorRow) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Motivo</p>
              <pre className="whitespace-pre-wrap break-words text-xs bg-muted rounded-md p-3 max-h-64 overflow-y-auto">
                {errorRow?.statusReason ?? "Nenhum motivo de erro registrado."}
              </pre>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Data: {formatDate(errorRow?.effectiveAt)}</span>
              <span>Canal: {errorRow?.channelName ?? "—"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
