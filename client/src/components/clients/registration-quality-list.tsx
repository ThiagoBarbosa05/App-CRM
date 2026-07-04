import { useMemo, useState } from "react";
import { Link } from "wouter";
import { User, Filter, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RegistrationQualityBar } from "@/components/clients/registration-quality-bar";
import {
  useRegistrationQualityPanel,
  type RegistrationQualityCandidate,
} from "@/hooks/use-registration-quality-panel";
import { formatCurrency } from "@/lib/utils";
import { FaWhatsapp } from "react-icons/fa";

interface RegistrationQualityListProps {
  responsavelId?: string;
}

const PAGE_SIZE = 25;

type FilterableFieldKey = "phone" | "cpf" | "birthday" | "email";

const FILTERABLE_FIELDS: { key: FilterableFieldKey; label: string }[] = [
  { key: "phone", label: "Celular" },
  { key: "cpf", label: "CPF" },
  { key: "birthday", label: "Data de nascimento" },
  { key: "email", label: "Email" },
];

/**
 * Chaves (exceto nome, sempre presente) que o cliente tem preenchidas.
 * Usado para o filtro por combinação exata de campos.
 */
function getFilledKeys(client: RegistrationQualityCandidate): Set<FilterableFieldKey> {
  const filled = new Set<FilterableFieldKey>();
  for (const field of client.registrationQuality.fields) {
    if (field.key !== "name" && field.filled) {
      filled.add(field.key as FilterableFieldKey);
    }
  }
  return filled;
}

function sameSet<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  return Array.from(a).every((item) => b.has(item));
}

/** Todas as combinações possíveis dos 4 campos opcionais (2^4 = 16, incluindo vazia). */
const ALL_FIELD_COMBINATIONS: FilterableFieldKey[][] = (() => {
  const keys = FILTERABLE_FIELDS.map((f) => f.key);
  const combos: FilterableFieldKey[][] = [];
  for (let mask = 0; mask < 1 << keys.length; mask++) {
    combos.push(keys.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  return combos;
})();

function combinationKey(combo: FilterableFieldKey[]): string {
  return [...combo].sort().join(",");
}

function combinationLabel(combo: FilterableFieldKey[]): string {
  if (combo.length === 0) return "Só nome";
  const labels = combo.map(
    (key) => FILTERABLE_FIELDS.find((f) => f.key === key)!.label,
  );
  return `Nome + ${labels.join(" + ")}`;
}

export function RegistrationQualityList({
  responsavelId,
}: RegistrationQualityListProps) {
  const { data: candidates, isLoading } = useRegistrationQualityPanel(responsavelId);
  // null = filtro inativo (mostra todos). Set vazio = filtro ativo pedindo
  // "nenhum campo além do nome" (caso contrário indistinguível de "sem filtro").
  const [fieldFilter, setFieldFilter] = useState<Set<FilterableFieldKey> | null>(null);

  const isOnlyNameActive = fieldFilter !== null && fieldFilter.size === 0;

  const toggleOnlyName = () => {
    setFieldFilter((prev) => (prev !== null && prev.size === 0 ? null : new Set()));
  };

  const toggleField = (key: FilterableFieldKey) => {
    setFieldFilter((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? null : next;
    });
  };

  // Distribuição por combinação exata de campos preenchidos, sempre sobre a
  // lista completa (ignora o filtro ativo) — serve de guia pra escolher o filtro.
  const combinationCounts = useMemo(() => {
    if (!candidates) return [];
    const counts = new Map<string, number>();
    for (const client of candidates) {
      const key = combinationKey(Array.from(getFilledKeys(client)));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return ALL_FIELD_COMBINATIONS.map((combo) => ({
      combo,
      count: counts.get(combinationKey(combo)) ?? 0,
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    if (fieldFilter === null) return candidates;
    return candidates.filter((client) => sameSet(getFilledKeys(client), fieldFilter));
  }, [candidates, fieldFilter]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  // Corrige a página se o filtro reduziu o total de resultados abaixo da página atual.
  const safePage = Math.min(page, totalPages);

  const pagedCandidates = useMemo(
    () => filteredCandidates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCandidates, safePage],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          Nome + só isso preenchido:
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer select-none pr-4 border-r border-slate-200 dark:border-slate-800">
          <Checkbox checked={isOnlyNameActive} onCheckedChange={toggleOnlyName} />
          <Label className="text-sm font-normal cursor-pointer">
            Só nome (nada mais)
          </Label>
        </label>

        {FILTERABLE_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-1.5 cursor-pointer select-none"
          >
            <Checkbox
              checked={fieldFilter?.has(field.key) ?? false}
              onCheckedChange={() => toggleField(field.key)}
            />
            <Label className="text-sm font-normal cursor-pointer">
              {field.label}
            </Label>
          </label>
        ))}
      </div>

      {combinationCounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              Clientes por combinação de campos preenchidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {combinationCounts.map(({ combo, count }) => {
                const comboSet = new Set(combo);
                const isActive = fieldFilter !== null && sameSet(fieldFilter, comboSet);
                const isOnlyName = combo.length === 0;

                return (
                  <button
                    key={combinationKey(combo)}
                    type="button"
                    onClick={() => setFieldFilter(isActive ? null : comboSet)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isOnlyName && count > 0
                        ? "animate-blink-red border-2"
                        : isActive
                          ? "border-amber-300 bg-amber-50 dark:border-amber-600/60 dark:bg-amber-900/20"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <span className="truncate text-slate-600 dark:text-slate-300">
                      {combinationLabel(combo)}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-100">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !candidates || candidates.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-16 text-center">
            Nenhum cliente com cadastro incompleto por aqui.
          </p>
        ) : filteredCandidates.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-16 text-center">
            Nenhum cliente com exatamente essa combinação de campos preenchidos.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pagedCandidates.map((client) => {
              const whatsappUrl = client.phone
                ? `https://wa.me/55${client.phone.replace(/\D/g, "")}`
                : null;
              return (
                <li
                  key={client.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <Link href={`/clientes/${client.id}`} className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className="truncate">{client.name}</span>
                      {client.isPriority && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          Prioridade
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatCurrency(client.totalSpent)} · {client.orderCount} pedido(s)
                    </p>
                    {client.responsavelName && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <User className="h-3 w-3 shrink-0" />
                        {client.responsavelName}
                      </p>
                    )}
                  </Link>

                  <RegistrationQualityBar
                    quality={client.registrationQuality}
                    className="shrink-0"
                  />

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <FaWhatsapp className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isLoading && filteredCandidates.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredCandidates.length)}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {filteredCandidates.length}
            </span>
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (safePage > 1) setPage(safePage - 1);
                  }}
                  className={
                    safePage <= 1
                      ? "pointer-events-none opacity-40"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  Página {safePage} de {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (safePage < totalPages) setPage(safePage + 1);
                  }}
                  className={
                    safePage >= totalPages
                      ? "pointer-events-none opacity-40"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
