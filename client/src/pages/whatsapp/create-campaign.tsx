import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  FileText,
  Info,
  Send,
  Search,
  X,
  MessageCircle,
  Loader2,
  Bot,
  AlertTriangle,
  PhoneOff,
  BellOff,
  Clock,
  User,
  Filter,
  ChevronDown,
  Tag,
  RadioTower,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
import { AttachFileDialog } from "@/components/media-library/attach-file-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  useWhatsappBots,
  useWhatsappBotCompatibility,
  useAccessibleWhatsappChannels,
  useWhatsappMetaTemplates,
  useCreateCampaignWithDispatch,
  type MetaTemplate,
  type WhatsappBot,
  type WhatsappChannelOption,
  type BotCompatibilityResult,
} from "@/hooks/use-whatsapp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getTemplateBodyText,
  getTemplateHeaderText,
  renderTemplateText,
  parseTemplateVars,
} from "@/lib/whatsapp-template";
import { WhatsappOptOutInfoBanner } from "@/components/whatsapp/opt-out-info-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WHATSAPP_CAMPAIGN_SEGMENT_STORAGE_KEY } from "@/components/marketing/segmentation-tab";

type WhatsappFilterTag = {
  id: string;
  name: string;
  color?: string | null;
  emoji?: string | null;
};
type ClientTag = {
  id: string;
  name: string;
  color?: string | null;
  emoji?: string | null;
};
type Client = {
  id: string;
  name: string;
  phone?: string | null;
  tags?: ClientTag[];
  whatsappOptOut?: boolean | null;
};
type FilterAudience = {
  mode: "filter";
  search?: string;
  whatsappTagIds: string[];
  exclusiveWhatsappTags: boolean;
  excludedClientIds: string[];
  total: number;
};

type TemplateHeaderMediaValue = {
  storageKey: string;
  mediaType: "image" | "video" | "document";
};

const CLIENT_VARIABLE_TOKENS = [
  { label: "Nome", value: "{{nome}}" },
  { label: "E-mail", value: "{{email}}" },
  { label: "Telefone", value: "{{telefone}}" },
  { label: "Telefone fixo", value: "{{telefone_fixo}}" },
  { label: "CPF", value: "{{cpf}}" },
  { label: "Cidade", value: "{{cidade}}" },
  { label: "Estado", value: "{{estado}}" },
  { label: "Endereço", value: "{{endereco}}" },
  { label: "Bairro", value: "{{bairro}}" },
  { label: "Aniversário", value: "{{aniversario}}" },
];

const CLIENT_VARIABLE_LABELS: Record<string, string> = {
  nome: "Nome do cliente",
  email: "E-mail do cliente",
  telefone: "Telefone do cliente",
  telefone_fixo: "Telefone fixo do cliente",
  cpf: "CPF do cliente",
  cidade: "Cidade do cliente",
  estado: "Estado do cliente",
  endereco: "Endereço do cliente",
  bairro: "Bairro do cliente",
  aniversario: "Aniversário do cliente",
};

function ClientVariableMenu({
  onSelect,
}: {
  onSelect: (token: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <User className="h-3 w-3" />
          Inserir dado
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
        {CLIENT_VARIABLE_TOKENS.map((v) => (
          <DropdownMenuItem key={v.value} onClick={() => onSelect(v.value)}>
            <span className="text-xs">{v.label}</span>
            <span className="ml-2 text-[10px] text-muted-foreground font-mono">
              {v.value}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const UMBLER_COLOR_MAP: Record<string, string> = {
  Aquamarine: "#14b8a6",
  Chocolate: "#92400e",
  Cyan: "#06b6d4",
  Gold: "#d97706",
  Grape: "#7c3aed",
  Gray: "#6b7280",
  Green: "#16a34a",
  Kiwi: "#84cc16",
  Magenta: "#ec4899",
  Pink: "#f472b6",
  Rose: "#e11d48",
  Salmon: "#f87171",
  Skyblue: "#38bdf8",
  Tangerine: "#f97316",
  Tomato: "#ef4444",
  Umblerito: "#5046e5",
};

const TAG_PALETTE = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#1abc9c",
  "#3498db",
  "#9b59b6",
  "#e91e63",
  "#00bcd4",
  "#8bc34a",
  "#ff5722",
  "#795548",
  "#607d8b",
  "#009688",
  "#673ab7",
];

function resolveTagColor(color: string | null | undefined, id: string): string {
  if (color) {
    const mapped = UMBLER_COLOR_MAP[color];
    if (mapped) return mapped;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// 🐨 é o emoji padrão do Umbler quando nenhum emoji foi definido — tratamos como ausente
function resolveTagEmoji(emoji: string | null | undefined): string | null {
  if (!emoji || emoji === "🐨") return null;
  return emoji;
}

function ClientTagBadge({ tag }: { tag: ClientTag }) {
  const bg = resolveTagColor(tag.color, tag.id);
  const emoji = resolveTagEmoji(tag.emoji);
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white max-w-[100px]"
      style={{ backgroundColor: bg }}
      title={tag.name}
    >
      {emoji && <span className="shrink-0 leading-none">{emoji}</span>}
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

const STEPS = [
  { id: 1, label: "Informações", icon: Info },
  { id: 2, label: "Clientes", icon: Users },
  { id: 3, label: "Conteúdo", icon: FileText },
  { id: 4, label: "Canal", icon: RadioTower },
  { id: 5, label: "Confirmar", icon: Send },
];

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto">
      {STEPS.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                  done
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : active
                      ? "border-primary text-primary bg-primary/10 shadow-sm"
                      : "border-muted-foreground/30 text-muted-foreground bg-background",
                )}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium hidden sm:block whitespace-nowrap",
                  active
                    ? "text-primary"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-10 sm:w-16 mx-1 mb-4 sm:mb-5 rounded-full transition-all duration-300",
                  current > step.id ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Informações ───────────────────────────────────────────────────────

function StepInfo({
  title,
  description,
  onChange,
}: {
  title: string;
  description: string;
  onChange: (title: string, description: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="campaign-title">
          Título da campanha <span className="text-destructive">*</span>
        </Label>
        <Input
          id="campaign-title"
          value={title}
          onChange={(e) => onChange(e.target.value, description)}
          placeholder="Ex.: Promoção de aniversário junho"
          autoFocus
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">
          Usado internamente para identificar o disparo.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-desc">
          Descrição{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="campaign-desc"
          value={description}
          onChange={(e) => onChange(title, e.target.value)}
          placeholder="Descreva o objetivo da campanha"
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}

// ── Step 2: Clientes ──────────────────────────────────────────────────────────

function StepClients({
  selectedIds,
  onChange,
  filterAudience,
  onFilterAudienceChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  filterAudience: FilterAudience | null;
  onFilterAudienceChange: (value: FilterAudience | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [exclusiveTags, setExclusiveTags] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false);
  const PAGE_SIZE = 20;

  const { data: whatsappTags = [] } = useQuery<WhatsappFilterTag[]>({
    queryKey: ["/api/whatsapp/tags"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/tags");
      if (!res.ok) throw new Error("Erro ao buscar tags do WhatsApp");
      return res.json();
    },
  });

  const isViewingSelected = viewSelectedOnly && !filterAudience;

  const { data: clientsResponse, isFetching } = useQuery({
    queryKey: isViewingSelected
      ? ["/api/clients", "campaign-select", "selected", selectedIds, currentPage]
      : ["/api/clients", "campaign-select", search, selectedTagIds, exclusiveTags, currentPage],
    queryFn: async () => {
      if (isViewingSelected) {
        const res = await fetch("/api/clients/by-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientIds: selectedIds,
            page: currentPage,
            pageSize: PAGE_SIZE,
          }),
        });
        if (!res.ok) throw new Error("Erro ao buscar clientes selecionados");
        return res.json();
      }
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedTagIds.length > 0) {
        params.set("whatsappTagIds", selectedTagIds.join(","));
        if (exclusiveTags) params.set("exclusiveWhatsappTags", "true");
      }
      params.set("page", String(currentPage));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/clients?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar clientes");
      return res.json();
    },
    enabled: !isViewingSelected || selectedIds.length > 0,
  });

  useEffect(() => {
    if (viewSelectedOnly && (filterAudience || selectedIds.length === 0)) {
      setViewSelectedOnly(false);
      setCurrentPage(1);
    }
  }, [viewSelectedOnly, filterAudience, selectedIds.length]);

  const clients: Client[] = useMemo(
    () => clientsResponse?.data ?? [],
    [clientsResponse],
  );
  const hasNextPage = clientsResponse?.hasNextPage ?? false;
  const totalItems = clientsResponse?.totalItems ?? clients.length;
  const hasPhone = (c: Client) => Boolean(c.phone?.trim());
  const isOptedOut = (c: Client) => Boolean(c.whatsappOptOut);
  const isSelectable = (c: Client) => hasPhone(c) && !isOptedOut(c);

  const toggleTag = (id: string) => {
    onFilterAudienceChange(null);
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
    setCurrentPage(1);
  };

  const toggleClient = (client: Client) => {
    if (!isSelectable(client)) return;
    if (filterAudience) {
      const excluded = filterAudience.excludedClientIds.includes(client.id);
      onFilterAudienceChange({
        ...filterAudience,
        excludedClientIds: excluded
          ? filterAudience.excludedClientIds.filter((id) => id !== client.id)
          : [...filterAudience.excludedClientIds, client.id],
      });
      return;
    }
    onChange(
      selectedIds.includes(client.id)
        ? selectedIds.filter((s) => s !== client.id)
        : [...selectedIds, client.id],
    );
  };

  const selectableIds = useMemo(
    () => clients.filter(isSelectable).map((c) => c.id),
    [clients],
  );

  const togglePageAll = () => {
    if (filterAudience) {
      const pageIsSelected = selectableIds.every(
        (id) => !filterAudience.excludedClientIds.includes(id),
      );
      onFilterAudienceChange({
        ...filterAudience,
        excludedClientIds: pageIsSelected
          ? Array.from(new Set([...filterAudience.excludedClientIds, ...selectableIds]))
          : filterAudience.excludedClientIds.filter((id) => !selectableIds.includes(id)),
      });
      return;
    }
    const allSelected =
      selectableIds.length > 0 &&
      selectableIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !selectableIds.includes(id)));
    } else {
      const newIds = [...selectedIds];
      selectableIds.forEach((id) => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      onChange(newIds);
    }
  };

  const allOnPageSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) =>
      filterAudience
        ? !filterAudience.excludedClientIds.includes(id)
        : selectedIds.includes(id),
    );
  const selectedCount = filterAudience
    ? Math.max(0, filterAudience.total - filterAudience.excludedClientIds.length)
    : selectedIds.length;

  return (
    <div className="space-y-3">
      {/* Search */}
      {!isViewingSelected && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => {
              onFilterAudienceChange(null);
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por nome ou telefone"
            className="pl-9"
          />
        </div>
      )}

      {/* WhatsApp tag filters */}
      {!isViewingSelected && whatsappTags.length > 0 && (
        <div className="space-y-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm transition-all text-left",
                  selectedTagIds.length > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/40",
                )}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">
                  {selectedTagIds.length > 0
                    ? `${selectedTagIds.length} tag${selectedTagIds.length !== 1 ? "s" : ""} selecionada${selectedTagIds.length !== 1 ? "s" : ""}`
                    : "Filtrar por tag"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar tag..." className="h-9" />
                <CommandList className="max-h-56">
                  <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                  {whatsappTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => toggleTag(tag.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            selected
                              ? "bg-primary border-primary"
                              : "border-border",
                          )}
                        >
                          {selected && (
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          )}
                        </div>
                        {tag.emoji ? (
                          <span className="shrink-0 text-sm">{tag.emoji}</span>
                        ) : tag.color ? (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                        ) : (
                          <Tag className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="text-sm truncate">{tag.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
                {selectedTagIds.length > 0 && (
                  <div className="border-t p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTagIds([]);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 rounded hover:bg-muted/50"
                    >
                      Limpar filtro de tags
                    </button>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>

          {/* Selected tags as dismissible badges */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {whatsappTags
                .filter((t) => selectedTagIds.includes(t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
                  >
                    {tag.emoji ? (
                      <span className="shrink-0 leading-none">{tag.emoji}</span>
                    ) : tag.color ? (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    ) : null}
                    {tag.name}
                    <X className="h-2.5 w-2.5" />
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Exclusive tag toggle */}
      {!isViewingSelected && selectedTagIds.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
          <Checkbox
            checked={exclusiveTags}
            onCheckedChange={(v) => {
              onFilterAudienceChange(null);
              setExclusiveTags(!!v);
              setCurrentPage(1);
            }}
          />
          Somente clientes com{" "}
          {selectedTagIds.length > 1 ? "apenas essas tags" : "apenas esta tag"}{" "}
          (sem nenhuma outra tag do WhatsApp)
        </label>
      )}

      {!isViewingSelected && totalItems > 0 && (
        <Button
          type="button"
          variant={filterAudience ? "default" : "outline"}
          className="w-full justify-between"
          onClick={() => {
            if (filterAudience) {
              onFilterAudienceChange(null);
              return;
            }
            onChange([]);
            onFilterAudienceChange({
              mode: "filter",
              search: search.trim() || undefined,
              whatsappTagIds: selectedTagIds,
              exclusiveWhatsappTags: exclusiveTags,
              excludedClientIds: [],
              total: totalItems,
            });
          }}
        >
          <span>{filterAudience ? "Todos os resultados selecionados" : `Selecionar todos os ${totalItems} resultados`}</span>
          <Check className="h-4 w-4" />
        </Button>
      )}

      {/* Selected count bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/8 border border-primary/20 rounded-xl">
          <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary flex-1">
            {selectedCount} cliente{selectedCount !== 1 ? "s" : ""}{" "}
            selecionado{selectedCount !== 1 ? "s" : ""}
          </span>
          {!filterAudience && (
            <button
              type="button"
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              onClick={() => {
                setViewSelectedOnly((v) => !v);
                setCurrentPage(1);
              }}
            >
              {viewSelectedOnly ? "Ver todos" : "Ver quem vai receber"}
            </button>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={() => { onChange([]); onFilterAudienceChange(null); }}
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        </div>
      )}

      {isViewingSelected && (
        <p className="text-xs text-muted-foreground px-1">
          Mostrando apenas os clientes selecionados que receberão a campanha.
        </p>
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePageAll}
                  disabled={selectableIds.length === 0}
                />
              </TableHead>
              <TableHead className="font-semibold">Nome</TableHead>
              <TableHead className="hidden sm:table-cell font-semibold">
                Telefone
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isFetching && clients.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            )}
            {!isFetching &&
              clients.map((client) => {
                const selectable = isSelectable(client);
                const optedOut = isOptedOut(client);
                const selected = filterAudience
                  ? !filterAudience.excludedClientIds.includes(client.id)
                  : selectedIds.includes(client.id);
                return (
                  <TableRow
                    key={client.id}
                    className={cn(
                      "transition-colors",
                      selectable ? "cursor-pointer" : "opacity-50",
                      selected
                        ? "bg-primary/5 hover:bg-primary/8"
                        : "hover:bg-muted/40",
                    )}
                    onClick={() => toggleClient(client)}
                  >
                    <TableCell
                      className="pl-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleClient(client)}
                        disabled={!selectable}
                        aria-label={`Selecionar ${client.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm",
                          selected ? "font-semibold" : "font-medium",
                        )}
                      >
                        {client.name}
                      </span>
                      {/* Phone shown inline on mobile */}
                      <div className="sm:hidden mt-0.5">
                        {selectable ? (
                          <span className="text-xs text-muted-foreground font-mono">
                            {client.phone}
                          </span>
                        ) : optedOut ? (
                          <span className="text-xs text-rose-600 flex items-center gap-1">
                            <BellOff className="h-3 w-3" /> Optou por sair
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <PhoneOff className="h-3 w-3" /> Sem telefone
                          </span>
                        )}
                      </div>
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {client.tags.slice(0, 3).map((tag) => (
                            <ClientTagBadge key={tag.id} tag={tag} />
                          ))}
                          {client.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{client.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {selectable ? (
                        <span className="text-sm text-muted-foreground font-mono">
                          {client.phone}
                        </span>
                      ) : optedOut ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-rose-600 border-rose-200 border-dashed font-normal text-xs"
                        >
                          <BellOff className="h-3 w-3" />
                          Optou por sair
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-muted-foreground border-dashed font-normal text-xs"
                        >
                          <PhoneOff className="h-3 w-3" />
                          Sem telefone
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {(currentPage > 1 || hasNextPage) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Próxima <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Pré-visualização estilo bolha WhatsApp
function TemplatePreview({
  meta,
  bodyParams,
  headerParams,
}: {
  meta: MetaTemplate;
  bodyParams: string[];
  headerParams: string[];
}) {
  const friendlyValue = (raw: string): string => {
    const trimmed = raw.trim();
    const match = /^\{\{(\w+)\}\}$/.exec(trimmed);
    if (match) return `[${CLIENT_VARIABLE_LABELS[match[1]] ?? match[1]}]`;
    return trimmed || "[valor não preenchido]";
  };

  const groups = parseTemplateVars(meta);
  const bodyGroup = groups.find((g) => g.componentType === "body");
  const headerGroup = groups.find(
    (g) => g.componentType === "header" && g.format === "text",
  );

  const bodyReplacements: Record<string, string> = {};
  (bodyGroup?.vars ?? []).forEach((name, i) => {
    bodyReplacements[name] = friendlyValue(bodyParams[i] ?? "");
  });
  const headerReplacements: Record<string, string> = {};
  (headerGroup?.vars ?? []).forEach((name, i) => {
    headerReplacements[name] = friendlyValue(headerParams[i] ?? "");
  });

  const fallback = (v: string) => `[${v}]`;
  const header = renderTemplateText(
    getTemplateHeaderText(meta),
    headerReplacements,
    fallback,
  );
  const body = renderTemplateText(
    getTemplateBodyText(meta),
    bodyReplacements,
    fallback,
  );

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Pré-visualização
      </p>
      <div className="rounded-xl bg-[#e7ffdb] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 p-3.5 max-w-sm shadow-sm">
        {header && (
          <p className="text-sm font-semibold text-foreground whitespace-pre-wrap mb-1">
            {header}
          </p>
        )}
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {body || "(Sem corpo de texto neste template.)"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Campos entre colchetes são substituídos por dados do contato no envio.
      </p>
    </div>
  );
}

function TemplateConfigForm({
  template,
  onChangeTemplate,
  bodyParams,
  onBodyParamsChange,
  headerParams,
  onHeaderParamsChange,
  headerMedia,
  onHeaderMediaChange,
}: {
  template: MetaTemplate;
  onChangeTemplate: () => void;
  bodyParams: string[];
  onBodyParamsChange: (values: string[]) => void;
  headerParams: string[];
  onHeaderParamsChange: (values: string[]) => void;
  headerMedia: TemplateHeaderMediaValue | null;
  onHeaderMediaChange: (media: TemplateHeaderMediaValue | null) => void;
}) {
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const groups = parseTemplateVars(template);
  const bodyGroup = groups.find((g) => g.componentType === "body");
  const headerGroup = groups.find((g) => g.componentType === "header");
  const headerIsMedia = !!headerGroup && headerGroup.format !== "text";

  const setBodyValue = (i: number, value: string) => {
    const next = [...bodyParams];
    next[i] = value;
    onBodyParamsChange(next);
  };
  const setHeaderValue = (i: number, value: string) => {
    const next = [...headerParams];
    next[i] = value;
    onHeaderParamsChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/30">
        <div className="min-w-0">
          <p className="font-semibold font-mono text-sm truncate">
            {template.name}
          </p>
          <div className="flex gap-1.5 mt-1">
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </Badge>
            <Badge variant="outline" className="text-xs font-mono">
              {template.language}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onChangeTemplate}
        >
          Trocar template
        </Button>
      </div>

      {bodyGroup && bodyGroup.vars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Variáveis do corpo:</p>
          {bodyGroup.vars.map((name, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground font-mono">{`{{${name}}}`}</label>
                <ClientVariableMenu
                  onSelect={(token) => setBodyValue(i, token)}
                />
              </div>
              <Input
                value={bodyParams[i] ?? ""}
                onChange={(e) => setBodyValue(i, e.target.value)}
                placeholder="Texto fixo ou {{nome}}, {{email}}..."
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {headerGroup && !headerIsMedia && headerGroup.vars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Variáveis do cabeçalho:</p>
          {headerGroup.vars.map((name, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground font-mono">{`{{${name}}}`}</label>
                <ClientVariableMenu
                  onSelect={(token) => setHeaderValue(i, token)}
                />
              </div>
              <Input
                value={headerParams[i] ?? ""}
                onChange={(e) => setHeaderValue(i, e.target.value)}
                placeholder="Texto fixo ou {{nome}}, {{email}}..."
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {headerIsMedia && headerGroup && (
        <div className="space-y-2">
          <p className="text-xs font-medium">
            Mídia do cabeçalho (
            {headerGroup.format === "image"
              ? "imagem"
              : headerGroup.format === "video"
                ? "vídeo"
                : "documento"}
            ):
          </p>
          {headerMedia ? (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground truncate">
                Arquivo selecionado
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMediaDialogOpen(true)}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setMediaDialogOpen(true)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Selecionar arquivo
            </Button>
          )}
          <AttachFileDialog
            open={mediaDialogOpen}
            onOpenChange={setMediaDialogOpen}
            lockedType={headerGroup.format as "image" | "video" | "document"}
            onAttach={(item) =>
              onHeaderMediaChange({
                storageKey: item.storageKey,
                mediaType: item.mediaType,
              })
            }
          />
        </div>
      )}

      <TemplatePreview
        meta={template}
        bodyParams={bodyParams}
        headerParams={headerParams}
      />
    </div>
  );
}

// ── Step 3: Template / Bot ────────────────────────────────────────────────────

function StepTemplateOrBot({
  selectedTemplate,
  selectedBotId,
  onSelectTemplate,
  onSelectBot,
  bodyParams,
  onBodyParamsChange,
  headerParams,
  onHeaderParamsChange,
  headerMedia,
  onHeaderMediaChange,
}: {
  selectedTemplate: MetaTemplate | null;
  selectedBotId: string;
  onSelectTemplate: (t: MetaTemplate | null) => void;
  onSelectBot: (id: string) => void;
  bodyParams: string[];
  onBodyParamsChange: (values: string[]) => void;
  headerParams: string[];
  onHeaderParamsChange: (values: string[]) => void;
  headerMedia: TemplateHeaderMediaValue | null;
  onHeaderMediaChange: (media: TemplateHeaderMediaValue | null) => void;
}) {
  const { data: metaTemplates = [], isLoading: templatesLoading } =
    useWhatsappMetaTemplates();
  const { data: bots = [], isLoading: botsLoading } = useWhatsappBots();
  const [search, setSearch] = useState("");
  const approvedTemplates = metaTemplates.filter(
    (t) => t.status === "APPROVED",
  );
  const filteredTemplates = approvedTemplates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  const activeBots = bots.filter((b) => b.isActive);
  const defaultTab = selectedBotId ? "bot" : "template";
  const templateKey = (t: MetaTemplate) => `${t.name}::${t.language}`;
  const selectedKey = selectedTemplate ? templateKey(selectedTemplate) : null;

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full mb-4 h-10">
        <TabsTrigger value="template" className="flex-1 gap-1.5 text-sm">
          <FileText className="h-3.5 w-3.5" />
          Template
        </TabsTrigger>
        <TabsTrigger value="bot" className="flex-1 gap-1.5 text-sm">
          <Bot className="h-3.5 w-3.5" />
          Bot
        </TabsTrigger>
      </TabsList>

      <TabsContent value="template">
        {selectedTemplate ? (
          <TemplateConfigForm
            template={selectedTemplate}
            onChangeTemplate={() => onSelectTemplate(null)}
            bodyParams={bodyParams}
            onBodyParamsChange={onBodyParamsChange}
            headerParams={headerParams}
            onHeaderParamsChange={onHeaderParamsChange}
            headerMedia={headerMedia}
            onHeaderMediaChange={onHeaderMediaChange}
          />
        ) : templatesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : approvedTemplates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border-2 border-dashed border-border">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum template aprovado</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Crie e aprove um template em{" "}
                <a
                  href="/whatsapp/templates"
                  className="text-primary underline underline-offset-2"
                >
                  WhatsApp → Templates
                </a>{" "}
                antes de criar uma campanha.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar template aprovado"
                className="pl-9"
              />
            </div>
            <div className="space-y-2.5">
              {filteredTemplates.map((t) => (
                <button
                  key={templateKey(t)}
                  type="button"
                  onClick={() => {
                    onSelectTemplate(t);
                    onSelectBot("");
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all",
                    selectedKey === templateKey(t)
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate font-mono text-sm">
                        {t.name}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[t.category] ?? t.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        {t.language}
                      </Badge>
                    </div>
                  </div>
                  {selectedKey === templateKey(t) && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-primary/10 text-primary text-sm font-semibold">
                      <Check className="h-3.5 w-3.5" />
                      Selecionado
                    </div>
                  )}
                </button>
              ))}
              {filteredTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum template corresponde à busca.
                </p>
              )}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="bot">
        <div className="flex items-start gap-2.5 p-3.5 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Para contatos fora da janela de 24h, a Meta exige que a primeira
            mensagem do bot seja um <strong>template aprovado</strong>.
          </p>
        </div>
        {botsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeBots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border-2 border-dashed border-border">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">Nenhum bot ativo</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Crie um bot em{" "}
                <a
                  href="/whatsapp/bots"
                  className="text-primary underline underline-offset-2"
                >
                  WhatsApp → Bots
                </a>{" "}
                antes de criar uma campanha.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeBots.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onSelectBot(b.id);
                  onSelectTemplate(null);
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  selectedBotId === b.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">
                      {b.name}
                    </p>
                    {b.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>
                {selectedBotId === b.id && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-primary/10 text-primary text-sm font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    Selecionado
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function StepChannel({
  channels,
  isLoading,
  selectedChannelId,
  contentType,
  compatibility,
  compatibilityLoading,
  compatibilityError,
  onSelect,
}: {
  channels: WhatsappChannelOption[];
  isLoading: boolean;
  selectedChannelId: number | null;
  contentType: "template" | "bot";
  compatibility?: BotCompatibilityResult;
  compatibilityLoading: boolean;
  compatibilityError?: string;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <RadioTower className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Escolha o número de saída</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Todas as mensagens e respostas desta campanha permanecerão vinculadas
            a este canal.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border px-5 py-10 text-center">
          <RadioTower className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-semibold">Nenhum canal disponível</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {contentType === "template"
              ? "Templates exigem um canal Cloud API ativo e configurado."
              : "Conecte ou ative um canal antes de criar a campanha."}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <a href="/whatsapp/canais">Configurar canais</a>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => {
            const selected = selectedChannelId === channel.id;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelect(channel.id)}
                aria-pressed={selected}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                  selected
                    ? "border-emerald-500 bg-emerald-500/5 shadow-sm"
                    : "border-border hover:border-emerald-500/40 hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-muted-foreground/40",
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {channel.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {channel.displayPhone ?? "Número não informado"}
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {channel.provider === "evolution"
                      ? "QR Code · conectado"
                      : "Cloud API · disponível"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {contentType === "bot" && selectedChannelId !== null && compatibilityLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando se o fluxo pode ser enviado por este canal...
        </div>
      ) : null}

      {contentType === "bot" && compatibility && !compatibility.compatible ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Este bot precisa de ajustes para o canal escolhido</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                {compatibility.issues.map((issue) => (
                  <li key={`${issue.nodeId}:${issue.code}`} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {contentType === "bot" && compatibilityError ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Não foi possível validar este canal</p>
            <p className="mt-1 text-sm leading-relaxed">{compatibilityError}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Step 5: Confirmação ───────────────────────────────────────────────────────

function StepConfirm({
  title,
  description,
  clientCount,
  templateName,
  botId,
  channelName,
  scheduledAt,
  onScheduleChange,
  dedupeWindowHours,
  onDedupeWindowChange,
  postSendTagId,
  onPostSendTagChange,
}: {
  title: string;
  description: string;
  clientCount: number;
  templateName?: string;
  botId: string;
  channelName?: string;
  scheduledAt: string;
  onScheduleChange: (value: string) => void;
  dedupeWindowHours: number;
  onDedupeWindowChange: (value: number) => void;
  postSendTagId: string;
  onPostSendTagChange: (value: string) => void;
}) {
  const { data: bots = [] } = useWhatsappBots();
  const bot = bots.find((b) => b.id === botId);
  const { data: campaignTags = [], refetch: refetchTags } = useQuery<WhatsappFilterTag[]>({
    queryKey: ["/api/whatsapp/tags"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/tags");
      if (!response.ok) throw new Error("Erro ao buscar etiquetas");
      return response.json();
    },
  });
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const selectedCampaignTag = campaignTags.find(
    (tag) => tag.id === postSendTagId,
  );

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const response = await fetch("/api/whatsapp/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Não foi possível criar a etiqueta");
      const tag = await response.json() as WhatsappFilterTag;
      await refetchTags();
      onPostSendTagChange(tag.id);
      setNewTagName("");
    } finally {
      setCreatingTag(false);
    }
  };

  const mode = scheduledAt ? "schedule" : "now";
  const minDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);

  const summaryRows = [
    { label: "Título", value: title },
    description ? { label: "Descrição", value: description } : null,
    {
      label: "Destinatários",
      value: `${clientCount} cliente${clientCount !== 1 ? "s" : ""}`,
    },
    templateName ? { label: "Template", value: templateName } : null,
    bot ? { label: "Bot", value: bot.name } : null,
    bot && channelName ? { label: "Canal de envio", value: channelName } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="p-0">
          {summaryRows.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "flex items-start justify-between gap-4 px-5 py-3.5 text-sm",
                i < summaryRows.length - 1 && "border-b border-border",
              )}
            >
              <span className="text-muted-foreground shrink-0">
                {row.label}
              </span>
              <span className="font-semibold text-right break-words max-w-[60%]">
                {row.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold">Quando disparar?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: "now",
                label: "Agora",
                icon: Send,
                action: () => onScheduleChange(""),
              },
              {
                value: "schedule",
                label: "Agendar",
                icon: Clock,
                action: () => onScheduleChange(scheduledAt || minDateTime),
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={opt.action}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                  mode === opt.value
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>
          {mode === "schedule" && (
            <Input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => onScheduleChange(e.target.value)}
              className="font-mono"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dedupe-window">Evitar mensagem repetida por</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dedupe-window"
                type="number"
                min={1}
                max={8760}
                value={dedupeWindowHours}
                onChange={(event) =>
                  onDedupeWindowChange(
                    Math.min(8760, Math.max(1, Number(event.target.value) || 1)),
                  )
                }
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Contatos que receberam ou já têm agendada a mesma abertura serão excluídos automaticamente.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="post-send-tag">Marcar após o primeiro envio</Label>
            <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  id="post-send-tag"
                  type="button"
                  role="combobox"
                  aria-expanded={tagPickerOpen}
                  aria-label="Selecionar etiqueta para aplicar após o primeiro envio"
                  className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {selectedCampaignTag ? (
                    <>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: resolveTagColor(
                            selectedCampaignTag.color,
                            selectedCampaignTag.id,
                          ),
                        }}
                      />
                      <span className="flex-1 truncate">
                        {selectedCampaignTag.name}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-muted-foreground">
                      Não aplicar etiqueta
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Pesquisar etiqueta..."
                    className="h-9"
                  />
                  <CommandList className="max-h-56">
                    <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
                    <CommandItem
                      value="nao aplicar etiqueta"
                      onSelect={() => {
                        onPostSendTagChange("");
                        setTagPickerOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          postSendTagId ? "opacity-0" : "opacity-100",
                        )}
                      />
                      Não aplicar etiqueta
                    </CommandItem>
                    {campaignTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          onPostSendTagChange(tag.id);
                          setTagPickerOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            postSendTagId === tag.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span
                          className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: resolveTagColor(tag.color, tag.id),
                          }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder="Ex.: RECEBEU — BLACK FRIDAY 2026"
              />
              <Button
                type="button"
                variant="outline"
                disabled={creatingTag || newTagName.trim().length < 2}
                onClick={createTag}
              >
                {creatingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A etiqueta é aplicada somente quando o WhatsApp aceitar o primeiro envio.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info notice */}
      <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl">
        <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {mode === "schedule"
            ? `A campanha ficará agendada e ${clientCount} mensagem${clientCount !== 1 ? "ns" : ""} ${clientCount !== 1 ? "serão disparadas" : "será disparada"} automaticamente no horário escolhido.`
            : `${clientCount} mensagem${clientCount !== 1 ? "ns entrarão" : " entrará"} na fila de disparo imediatamente. O envio ocorre em segundo plano — acompanhe o progresso na tela da campanha.`}
        </p>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function WhatsAppCreateCampaign() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [filterAudience, setFilterAudience] = useState<FilterAudience | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(
    null,
  );
  const [selectedBotId, setSelectedBotId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    null,
  );
  const [templateBodyParams, setTemplateBodyParams] = useState<string[]>([]);
  const [templateHeaderParams, setTemplateHeaderParams] = useState<string[]>(
    [],
  );
  const [templateHeaderMedia, setTemplateHeaderMedia] =
    useState<TemplateHeaderMediaValue | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [dedupeWindowHours, setDedupeWindowHours] = useState(24);
  const [postSendTagId, setPostSendTagId] = useState("");
  const [prefilledSegmentLabel, setPrefilledSegmentLabel] = useState<string | null>(null);
  const [prefilledSegmentLoading, setPrefilledSegmentLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(WHATSAPP_CAMPAIGN_SEGMENT_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(WHATSAPP_CAMPAIGN_SEGMENT_STORAGE_KEY);
    let parsed: { segmentLabel?: string; filters?: Record<string, string | boolean> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed.segmentLabel || !parsed.filters) return;

    const segmentLabel = parsed.segmentLabel;
    const filters = parsed.filters;
    setPrefilledSegmentLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
          if (value === undefined || value === null || value === "") continue;
          params.set(key, String(value));
        }
        const res = await fetch(`/api/clients/ids?${params.toString()}`);
        if (!res.ok) throw new Error("Erro ao buscar clientes do segmento");
        const data: { clientIds: string[] } = await res.json();
        setSelectedClientIds(data.clientIds);
        setPrefilledSegmentLabel(segmentLabel);
      } catch {
        toast({
          variant: "destructive",
          title: "Não foi possível pré-selecionar o segmento",
          description: "Selecione os clientes manualmente no passo 2.",
        });
      } finally {
        setPrefilledSegmentLoading(false);
      }
    })();
  }, []);

  const createMutation = useCreateCampaignWithDispatch();
  const {
    data: availableChannels = [],
    isLoading: channelsLoading,
  } = useAccessibleWhatsappChannels();
  const selectedChannel = availableChannels.find(
    (channel) => channel.id === selectedChannelId,
  );
  const contentType = selectedTemplate ? "template" : "bot";
  const {
    data: botCompatibility,
    isFetching: compatibilityLoading,
    error: botCompatibilityError,
  } = useWhatsappBotCompatibility(
    contentType === "bot" ? selectedBotId : "",
    contentType === "bot" ? selectedChannelId : null,
  );
  const compatibleChannels = useMemo(
    () =>
      availableChannels.filter(
        (channel) => contentType === "bot" || channel.provider === "cloud_api",
      ),
    [availableChannels, contentType],
  );

  useEffect(() => {
    if (
      selectedChannelId !== null &&
      !compatibleChannels.some((channel) => channel.id === selectedChannelId)
    ) {
      setSelectedChannelId(null);
    }
  }, [compatibleChannels, selectedChannelId]);

  const handleSelectTemplate = (t: MetaTemplate | null) => {
    setSelectedTemplate(t);
    setTemplateBodyParams([]);
    setTemplateHeaderParams([]);
    setTemplateHeaderMedia(
      t?.headerMedia
        ? {
            storageKey: t.headerMedia.storageKey,
            mediaType: t.headerMedia.mediaType,
          }
        : null,
    );
  };

  const handleSelectBot = (id: string) => {
    setSelectedBotId(id);
    setTemplateBodyParams([]);
    setTemplateHeaderParams([]);
    setTemplateHeaderMedia(null);
  };

  const templateVarsComplete = useMemo(() => {
    if (!selectedTemplate) return true;
    const groups = parseTemplateVars(selectedTemplate);
    const bodyGroup = groups.find((g) => g.componentType === "body");
    const headerGroup = groups.find((g) => g.componentType === "header");
    const bodyOk =
      !bodyGroup ||
      bodyGroup.vars.every(
        (_, i) => (templateBodyParams[i] ?? "").trim().length > 0,
      );
    if (!headerGroup) return bodyOk;
    if (headerGroup.format !== "text")
      return bodyOk && templateHeaderMedia !== null;
    const headerOk = headerGroup.vars.every(
      (_, i) => (templateHeaderParams[i] ?? "").trim().length > 0,
    );
    return bodyOk && headerOk;
  }, [
    selectedTemplate,
    templateBodyParams,
    templateHeaderParams,
    templateHeaderMedia,
  ]);

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2)
      return filterAudience
        ? filterAudience.total > filterAudience.excludedClientIds.length
        : selectedClientIds.length > 0;
    if (step === 3)
      return selectedTemplate !== null
        ? templateVarsComplete
        : selectedBotId.length > 0;
    if (step === 4) {
      if (selectedChannelId == null) return false;
      if (contentType === "template") return true;
      return !compatibilityLoading && botCompatibility?.compatible === true;
    }
    return true;
  }, [
    step,
    title,
    selectedClientIds,
    filterAudience,
    selectedTemplate,
    selectedBotId,
    selectedChannelId,
    contentType,
    compatibilityLoading,
    botCompatibility,
    templateVarsComplete,
  ]);

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigate("/whatsapp/campanhas");
  };

  const handleSubmit = useCallback(() => {
    if (selectedChannelId == null) {
      toast({
        title: "Selecione um canal de envio",
        description: "Volte ao passo Canal antes de criar a campanha.",
        variant: "destructive",
      });
      return;
    }
    if (contentType === "bot" && botCompatibility?.compatible !== true) {
      toast({
        title: "Bot incompatível com o canal",
        description: "Revise os avisos exibidos no passo Canal antes de criar a campanha.",
        variant: "destructive",
      });
      return;
    }

    const scheduledIso =
      scheduledAt && new Date(scheduledAt).getTime() > Date.now()
        ? new Date(scheduledAt).toISOString()
        : undefined;

    createMutation.mutate(
      {
        name: title,
        description,
        metaTemplateName: selectedTemplate?.name,
        metaTemplateLanguage: selectedTemplate?.language,
        metaTemplateCategory: selectedTemplate?.category,
        metaTemplateBodyParams:
          selectedTemplate && templateBodyParams.length > 0
            ? templateBodyParams
            : undefined,
        metaTemplateHeaderParams:
          selectedTemplate && templateHeaderParams.length > 0
            ? templateHeaderParams
            : undefined,
        metaTemplateHeaderMedia:
          selectedTemplate && templateHeaderMedia
            ? templateHeaderMedia
            : undefined,
        waBotId: selectedBotId || undefined,
        waChannelId: selectedChannelId,
        audience: filterAudience
          ? {
              mode: "filter",
              search: filterAudience.search,
              whatsappTagIds: filterAudience.whatsappTagIds,
              exclusiveWhatsappTags: filterAudience.exclusiveWhatsappTags,
              excludedClientIds: filterAudience.excludedClientIds,
            }
          : { mode: "explicit", clientIds: selectedClientIds },
        scheduledAt: scheduledIso,
        dedupeWindowHours,
        postSendWhatsappTagId: postSendTagId || undefined,
      },
      {
        onSuccess: (data) => {
          toast({
            title: scheduledIso
              ? "Campanha agendada!"
              : "Campanha enfileirada!",
            description: data.preview.suppressedDuplicate > 0
              ? `${data.preview.eligible} elegíveis; ${data.preview.suppressedDuplicate} mensagens repetidas foram protegidas.`
              : scheduledIso
                ? "Será disparada automaticamente no horário escolhido."
                : "O disparo será processado em segundo plano.",
          });
          navigate(`/whatsapp/campanhas/${data.campaignId}`);
        },
      },
    );
  }, [
    createMutation,
    title,
    description,
    selectedTemplate,
    templateBodyParams,
    templateHeaderParams,
    templateHeaderMedia,
    selectedBotId,
    selectedChannelId,
    contentType,
    botCompatibility,
    selectedClientIds,
    filterAudience,
    scheduledAt,
    dedupeWindowHours,
    postSendTagId,
    toast,
    navigate,
  ]);

  // Progress percentage for the top bar
  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top progress bar */}
      <div className="h-0.5 bg-muted shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="space-y-6 pb-6">
            {/* Header */}
            <PageHeader>
              <PageHeader.Info>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="shrink-0 h-9 w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <PageHeader.Icon
                  icon={MessageCircle}
                  color="text-green-600 dark:text-green-400"
                  bgColor="bg-green-50 dark:bg-green-900/30"
                />
                <PageHeader.Text>
                  <PageHeader.Title>Nova campanha</PageHeader.Title>
                  <PageHeader.Description>
                    Passo {step} de {STEPS.length} · {STEPS[step - 1].label}
                  </PageHeader.Description>
                </PageHeader.Text>
              </PageHeader.Info>
            </PageHeader>

            {step === 1 && <WhatsappOptOutInfoBanner />}

            {/* Step indicator */}
            <StepIndicator current={step} />

            {/* Step content */}
            <div>
              {step === 1 && (
                <StepInfo
                  title={title}
                  description={description}
                  onChange={(t, d) => {
                    setTitle(t);
                    setDescription(d);
                  }}
                />
              )}
              {step === 2 && (
                <>
                  {prefilledSegmentLoading && (
                    <Alert className="mb-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertTitle>Carregando clientes do segmento…</AlertTitle>
                    </Alert>
                  )}
                  {prefilledSegmentLabel && !prefilledSegmentLoading && (
                    <Alert className="mb-4 border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-200">
                      <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertTitle>
                        {selectedClientIds.length} cliente(s) pré-selecionado(s) do segmento{" "}
                        <strong>{prefilledSegmentLabel}</strong>
                      </AlertTitle>
                      <AlertDescription className="flex items-center justify-between gap-2 text-green-800/90 dark:text-green-300/90">
                        <span>Você pode ajustar a seleção manualmente abaixo, se preferir.</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            setSelectedClientIds([]);
                            setPrefilledSegmentLabel(null);
                          }}
                        >
                          Limpar seleção
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  <StepClients
                    selectedIds={selectedClientIds}
                    onChange={setSelectedClientIds}
                    filterAudience={filterAudience}
                    onFilterAudienceChange={setFilterAudience}
                  />
                </>
              )}
              {step === 3 && (
                <StepTemplateOrBot
                  selectedTemplate={selectedTemplate}
                  selectedBotId={selectedBotId}
                  onSelectTemplate={handleSelectTemplate}
                  onSelectBot={handleSelectBot}
                  bodyParams={templateBodyParams}
                  onBodyParamsChange={setTemplateBodyParams}
                  headerParams={templateHeaderParams}
                  onHeaderParamsChange={setTemplateHeaderParams}
                  headerMedia={templateHeaderMedia}
                  onHeaderMediaChange={setTemplateHeaderMedia}
                />
              )}
              {step === 4 && (
                <StepChannel
                  channels={compatibleChannels}
                  isLoading={channelsLoading}
                  selectedChannelId={selectedChannelId}
                  contentType={contentType}
                  compatibility={botCompatibility}
                  compatibilityLoading={compatibilityLoading}
                  compatibilityError={
                    botCompatibilityError instanceof Error
                      ? botCompatibilityError.message
                      : undefined
                  }
                  onSelect={setSelectedChannelId}
                />
              )}
              {step === 5 && (
                <StepConfirm
                  title={title}
                  description={description}
                  clientCount={filterAudience
                    ? Math.max(0, filterAudience.total - filterAudience.excludedClientIds.length)
                    : selectedClientIds.length}
                  templateName={selectedTemplate?.name}
                  botId={selectedBotId}
                  channelName={selectedChannel?.name}
                  scheduledAt={scheduledAt}
                  onScheduleChange={setScheduledAt}
                  dedupeWindowHours={dedupeWindowHours}
                  onDedupeWindowChange={setDedupeWindowHours}
                  postSendTagId={postSendTagId}
                  onPostSendTagChange={setPostSendTagId}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom navigation */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 lg:px-6 py-3">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>

          <div className="flex items-center gap-2">
            {/* Dot progress indicator (mobile) */}
            <div className="flex items-center gap-1 sm:hidden mr-1">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-full transition-all",
                    step === s.id
                      ? "w-4 h-1.5 bg-primary"
                      : step > s.id
                        ? "w-1.5 h-1.5 bg-primary/50"
                        : "w-1.5 h-1.5 bg-muted",
                  )}
                />
              ))}
            </div>

            {step < STEPS.length ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="gap-2 min-w-28"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="gap-2 min-w-40"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {scheduledAt ? "Agendando..." : "Enfileirando..."}
                  </>
                ) : (
                  <>
                    {scheduledAt ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {scheduledAt ? "Agendar campanha" : "Disparar agora"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
