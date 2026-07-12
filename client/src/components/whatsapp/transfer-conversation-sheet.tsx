import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, User, MessageCircle, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TransferTab = "sector" | "attendant" | "channel";

interface SectorOption {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  onlineCount: number;
}

interface AttendantOption {
  userId: string;
  name: string;
  role: string;
  channelId: number | null;
  channelDisplayPhone: string | null;
  channelConnectionStatus: string | null;
  channelProvider: string | null;
}

export interface TransferChannelOption {
  id: number;
  name: string;
  displayPhone: string | null;
  connectionStatus: string | null;
  provider: string;
}

interface TransferConversationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  channels: TransferChannelOption[];
  onTransferred: () => void;
}

function TransferRow({
  icon,
  iconBg,
  label,
  statusLabel,
  statusOnline,
  disabled,
  selected,
  onSelect,
  radioValue,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  statusLabel?: string;
  statusOnline?: boolean;
  disabled?: boolean;
  selected: boolean;
  onSelect: () => void;
  radioValue: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800",
        selected && !disabled && "bg-slate-100 dark:bg-slate-800",
      )}
      onClick={() => !disabled && onSelect()}
    >
      <div className="relative shrink-0">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: iconBg ?? "#3B82F6" }}
        >
          {icon}
        </div>
        {statusOnline && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </div>
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{label}</span>
      {statusLabel && (
        <span
          className={cn(
            "text-xs shrink-0",
            statusOnline ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500",
          )}
        >
          {statusLabel}
        </span>
      )}
      <RadioGroupItem value={radioValue} disabled={disabled} className="shrink-0" />
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">{label}</p>;
}

function ListSkeleton() {
  return (
    <div className="space-y-1 px-1 py-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
          <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function TransferConversationSheet({
  open,
  onOpenChange,
  conversationId,
  channels,
  onTransferred,
}: TransferConversationSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TransferTab>("sector");
  const [search, setSearch] = useState("");
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setTab("sector");
      setSearch("");
      setSelectedSectorId(null);
      setSelectedUserId(null);
      setSelectedChannelId(null);
      setReason("");
    }
  }, [open]);

  const { data: sectors = [], isLoading: sectorsLoading } = useQuery<SectorOption[]>({
    queryKey: ["/api/whatsapp/sectors"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/sectors");
      if (!res.ok) throw new Error("Erro ao buscar setores");
      return res.json();
    },
    enabled: open,
  });

  const { data: attendants = [], isLoading: attendantsLoading } = useQuery<AttendantOption[]>({
    queryKey: ["/api/whatsapp/attendants"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/attendants");
      if (!res.ok) throw new Error("Erro ao buscar atendentes");
      return res.json();
    },
    enabled: open,
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = reason.trim() || undefined;
      let url: string;
      let body: Record<string, unknown>;

      if (tab === "sector") {
        if (!selectedSectorId) throw new Error("Selecione um setor");
        url = `/api/whatsapp/conversations/${conversationId}/transfer-sector`;
        body = { sectorId: selectedSectorId, reason: trimmedReason };
      } else if (tab === "attendant") {
        if (!selectedUserId) throw new Error("Selecione um atendente");
        url = `/api/whatsapp/conversations/${conversationId}/transfer-attendant`;
        body = { targetUserId: selectedUserId, reason: trimmedReason };
      } else {
        if (!selectedChannelId) throw new Error("Selecione um canal");
        url = `/api/whatsapp/conversations/${conversationId}/transfer`;
        body = { channelId: selectedChannelId, reason: trimmedReason };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Erro ao transferir conversa");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Conversa transferida com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations-list"] });
      onOpenChange(false);
      onTransferred();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const canSubmit =
    (tab === "sector" && !!selectedSectorId) ||
    (tab === "attendant" && !!selectedUserId) ||
    (tab === "channel" && !!selectedChannelId);

  const searchLower = search.toLowerCase();
  const filteredSectors = sectors.filter((s) => s.name.toLowerCase().includes(searchLower));
  const filteredAttendants = attendants.filter((a) => a.name.toLowerCase().includes(searchLower));
  const filteredChannels = channels.filter((c) => c.name.toLowerCase().includes(searchLower));

  const searchPlaceholder =
    tab === "sector" ? "Pesquisar setor" : tab === "attendant" ? "Pesquisar atendente" : "Pesquisar canal";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-5 pt-5 pb-0 space-y-3 text-left shrink-0">
          <SheetTitle>Transferir conversa</SheetTitle>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TransferTab)}>
            <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-4 border-b border-slate-200 dark:border-slate-800 rounded-none">
              <TabsTrigger
                value="sector"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-0 pb-2.5"
              >
                <Building2 className="h-3.5 w-3.5" /> Setor
              </TabsTrigger>
              <TabsTrigger
                value="attendant"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-0 pb-2.5"
              >
                <User className="h-3.5 w-3.5" /> Atendente
              </TabsTrigger>
              <TabsTrigger
                value="channel"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-0 pb-2.5"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Canal
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>

        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 min-h-[200px]">
          {tab === "sector" &&
            (sectorsLoading ? (
              <ListSkeleton />
            ) : filteredSectors.length === 0 ? (
              <EmptyState label="Nenhum setor de atendimento encontrado." />
            ) : (
              <RadioGroup value={selectedSectorId ?? ""} onValueChange={setSelectedSectorId}>
                {filteredSectors.map((s) => (
                  <TransferRow
                    key={s.id}
                    radioValue={s.id}
                    icon={<Building2 className="h-4 w-4" />}
                    iconBg={s.color}
                    label={s.name}
                    statusLabel={`${s.onlineCount} online`}
                    statusOnline={s.onlineCount > 0}
                    selected={selectedSectorId === s.id}
                    onSelect={() => setSelectedSectorId(s.id)}
                  />
                ))}
              </RadioGroup>
            ))}

          {tab === "attendant" &&
            (attendantsLoading ? (
              <ListSkeleton />
            ) : filteredAttendants.length === 0 ? (
              <EmptyState label="Nenhum atendente encontrado." />
            ) : (
              <RadioGroup value={selectedUserId ?? ""} onValueChange={setSelectedUserId}>
                {filteredAttendants.map((a) => {
                  const hasChannel = !!a.channelId;
                  const isConnected =
                    a.channelProvider === "cloud_api" || a.channelConnectionStatus === "connected";
                  return (
                    <TransferRow
                      key={a.userId}
                      radioValue={a.userId}
                      icon={<User className="h-4 w-4" />}
                      label={a.name}
                      statusLabel={hasChannel ? (isConnected ? "Online" : "Offline") : "Sem canal configurado"}
                      statusOnline={hasChannel && isConnected}
                      disabled={!hasChannel}
                      selected={selectedUserId === a.userId}
                      onSelect={() => setSelectedUserId(a.userId)}
                    />
                  );
                })}
              </RadioGroup>
            ))}

          {tab === "channel" &&
            (filteredChannels.length === 0 ? (
              <EmptyState label="Nenhum canal disponível." />
            ) : (
              <RadioGroup
                value={selectedChannelId != null ? String(selectedChannelId) : ""}
                onValueChange={(v) => setSelectedChannelId(Number(v))}
              >
                {filteredChannels.map((c) => {
                  const isConnected = c.provider === "cloud_api" || c.connectionStatus === "connected";
                  return (
                    <TransferRow
                      key={c.id}
                      radioValue={String(c.id)}
                      icon={<MessageCircle className="h-4 w-4" />}
                      label={c.name}
                      statusLabel={c.displayPhone ?? (isConnected ? "Conectado" : "Desconectado")}
                      statusOnline={isConnected}
                      selected={selectedChannelId === c.id}
                      onSelect={() => setSelectedChannelId(c.id)}
                    />
                  );
                })}
              </RadioGroup>
            ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 space-y-3 shrink-0">
          <Textarea
            placeholder="Digite o motivo da transferência (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
          <Button
            className="w-full"
            disabled={!canSubmit || transferMutation.isPending}
            onClick={() => transferMutation.mutate()}
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transferindo...
              </>
            ) : (
              "Transferir"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
