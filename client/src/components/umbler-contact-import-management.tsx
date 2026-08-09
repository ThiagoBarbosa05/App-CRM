import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Users as UsersIcon,
  RotateCcw,
  Check,
  ChevronsUpDown,
} from "lucide-react";

interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled,
}: {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ""}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface UmblerOrganizationMember {
  id: string;
  displayName: string;
  emailAddress: string | null;
  active: boolean;
}

interface AppUser {
  id: string;
  name: string;
  role: string;
  umblerMemberId?: string | null;
  umblerMemberName?: string | null;
}

interface UmblerContactTag {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
}

interface MemberContactListItem {
  id: string;
  name: string | null;
  phoneNumber: string | null;
  tags: UmblerContactTag[];
  alreadyImported: boolean;
  existingClientId?: string;
}

type ImportLogResult = "imported" | "skipped_existing" | "error";

interface ImportLogEntry {
  umblerContactId: string;
  contactName: string | null;
  phone: string | null;
  result: ImportLogResult;
  clientId?: string;
  errorMessage?: string;
  timestamp: string;
}

interface UmblerContactImportStatus {
  status: "idle" | "running" | "completed" | "error";
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  logs: ImportLogEntry[];
}

const RESULT_CONFIG: Record<
  ImportLogResult,
  { label: string; className: string; icon: React.ReactNode }
> = {
  imported: {
    label: "Importado",
    className: "text-green-700 bg-green-50 border-green-200",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  skipped_existing: {
    label: "Já existia",
    className: "text-slate-600 bg-slate-50 border-slate-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  error: {
    label: "Erro",
    className: "text-red-700 bg-red-50 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

type Step = "select" | "review" | "import";

export function UmblerContactImportManagement() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select");
  const [vendorUserId, setVendorUserId] = useState<string>("");
  const [memberId, setMemberId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: vendors = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar vendedores");
      return res.json();
    },
  });

  const { data: members = [], isFetching: isLoadingMembers } = useQuery<
    UmblerOrganizationMember[]
  >({
    queryKey: ["/api/umbler-contact-import/members"],
    queryFn: async () => {
      const res = await fetch("/api/umbler-contact-import/members", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar atendentes do Umbler");
      return res.json();
    },
  });

  const sellers = useMemo(
    () => vendors.filter((u) => u.role === "vendedor" || u.role === "gerente"),
    [vendors],
  );

  // Pré-seleciona o atendente já vinculado a esse vendedor, se houver.
  useEffect(() => {
    if (!vendorUserId) return;
    const vendor = vendors.find((u) => u.id === vendorUserId);
    if (vendor?.umblerMemberId) {
      setMemberId(vendor.umblerMemberId);
    }
  }, [vendorUserId, vendors]);

  const {
    data: contacts = [],
    isFetching: isLoadingContacts,
    refetch: refetchContacts,
  } = useQuery<MemberContactListItem[]>({
    queryKey: ["/api/umbler-contact-import/contacts", memberId],
    queryFn: async () => {
      const res = await fetch(
        `/api/umbler-contact-import/contacts?memberId=${encodeURIComponent(memberId)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Erro ao buscar contatos do atendente");
      return res.json();
    },
    enabled: false,
  });

  const { data: status, refetch: refetchStatus } =
    useQuery<UmblerContactImportStatus>({
      queryKey: ["/api/umbler-contact-import/status"],
      queryFn: async () => {
        const res = await fetch("/api/umbler-contact-import/status", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Erro ao buscar status");
        return res.json();
      },
      staleTime: 0,
      enabled: step === "import",
    });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const result = await refetchContacts();
      return result.data ?? [];
    },
    onSuccess: (data) => {
      setSelectedIds(new Set(data.filter((c) => !c.alreadyImported).map((c) => c.id)));
      setStep("review");
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao buscar contatos",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const member = members.find((m) => m.id === memberId);
      const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
      return apiRequest("POST", "/api/umbler-contact-import/start", {
        memberId,
        memberName: member?.displayName ?? memberId,
        vendorUserId,
        contacts: selectedContacts,
      });
    },
    onSuccess: () => {
      setStep("import");
      setPolling(true);
      toast({ title: "Importação iniciada" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao iniciar importação",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (polling) {
      intervalRef.current = setInterval(() => void refetchStatus(), 2000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, refetchStatus]);

  useEffect(() => {
    if (status?.status === "completed" || status?.status === "error") {
      setPolling(false);
    }
  }, [status?.status]);

  const selectableContacts = contacts.filter((c) => !c.alreadyImported);
  const allSelectableChecked =
    selectableContacts.length > 0 &&
    selectableContacts.every((c) => selectedIds.has(c.id));

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (allSelectableChecked) return new Set();
      return new Set(selectableContacts.map((c) => c.id));
    });
  }

  function resetFlow() {
    setStep("select");
    setSelectedIds(new Set());
  }

  const percent =
    status && status.total > 0
      ? Math.round((status.processed / status.total) * 100)
      : 0;

  return (
    <div className="space-y-4 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar Contatos do Umbler</CardTitle>
          <CardDescription>
            Selecione um vendedor do CRM e o atendente correspondente no
            Umbler Talk para ver e importar os contatos ligados a ele.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Vendedor do CRM
              </label>
              <SearchableSelect
                value={vendorUserId}
                onValueChange={setVendorUserId}
                disabled={step !== "select"}
                placeholder="Selecione o vendedor"
                searchPlaceholder="Buscar vendedor..."
                emptyMessage="Nenhum vendedor encontrado."
                options={sellers.map((u) => ({ value: u.id, label: u.name }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Atendente no Umbler
              </label>
              <SearchableSelect
                value={memberId}
                onValueChange={setMemberId}
                disabled={step !== "select" || isLoadingMembers}
                placeholder="Selecione o atendente"
                searchPlaceholder="Buscar atendente..."
                emptyMessage="Nenhum atendente encontrado."
                options={members.map((m) => ({
                  value: m.id,
                  label: m.displayName,
                  description: m.emailAddress ?? undefined,
                }))}
              />
            </div>
          </div>

          {step === "select" && (
            <Button
              size="sm"
              disabled={!vendorUserId || !memberId || searchMutation.isPending}
              onClick={() => searchMutation.mutate()}
            >
              {searchMutation.isPending || isLoadingContacts ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar contatos
            </Button>
          )}

          {step !== "select" && (
            <Button size="sm" variant="outline" onClick={resetFlow}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Nova importação
            </Button>
          )}
        </CardContent>
      </Card>

      {step === "review" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">
                  Contatos encontrados
                  <span className="ml-2 text-muted-foreground font-normal">
                    ({contacts.length})
                  </span>
                </CardTitle>
                <CardDescription>
                  Contatos já importados aparecem desmarcados e não podem ser
                  selecionados novamente.
                </CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                >
                  {startMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UsersIcon className="mr-2 h-4 w-4" />
                  )}
                  Importar selecionados ({selectedIds.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="max-h-[26rem] overflow-y-auto rounded-b-md">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <Checkbox
                        checked={allSelectableChecked}
                        onCheckedChange={toggleAll}
                        disabled={selectableContacts.length === 0}
                      />
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Nome
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Telefone
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Tags
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2">
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => toggleContact(contact.id)}
                          disabled={contact.alreadyImported}
                        />
                      </td>
                      <td className="px-4 py-2 font-medium max-w-[200px] truncate">
                        {contact.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-mono">
                        {contact.phoneNumber ?? "—"}
                      </td>
                      <td className="px-4 py-2 max-w-[240px]">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((t) => (
                            <Badge
                              key={t.id}
                              variant="secondary"
                              className="text-xs h-4 px-1"
                            >
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {contact.alreadyImported ? (
                          <Badge variant="outline" className="text-xs">
                            Já importado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Novo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "import" && status && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Progresso da importação</CardTitle>
              <StatusBadge status={status.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {status.processed} / {status.total} contatos
                </span>
                <span>{percent}%</span>
              </div>
              <Progress value={percent} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBox label="Total" value={status.total} color="text-foreground" />
              <StatBox label="Importados" value={status.imported} color="text-green-600" />
              <StatBox label="Já existentes" value={status.skipped} color="text-muted-foreground" />
              <StatBox label="Erros" value={status.errors} color="text-destructive" />
            </div>

            {status.status === "error" && status.errorMessage && (
              <p className="text-xs text-destructive">{status.errorMessage}</p>
            )}

            {status.logs.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Contato
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Telefone
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Detalhe
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {status.logs.map((entry, i) => {
                      const cfg = RESULT_CONFIG[entry.result];
                      return (
                        <tr key={i} className="hover:bg-muted/40">
                          <td className="px-4 py-2 font-medium max-w-[160px] truncate">
                            {entry.contactName ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground font-mono">
                            {entry.phone ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.className}`}
                            >
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-2 max-w-[260px] text-destructive truncate">
                            {entry.errorMessage ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: UmblerContactImportStatus["status"] }) {
  if (status === "idle") return <Badge variant="secondary">Aguardando</Badge>;
  if (status === "running")
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-400">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Importando
      </Badge>
    );
  if (status === "completed")
    return (
      <Badge variant="outline" className="text-green-600 border-green-400">
        <CheckCircle className="mr-1 h-3 w-3" />
        Concluído
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <AlertCircle className="mr-1 h-3 w-3" />
      Erro
    </Badge>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
