import { useMemo, useState } from "react";
import { Link } from "wouter";
import { User, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    if (fieldFilter === null) return candidates;
    return candidates.filter((client) => sameSet(getFilledKeys(client), fieldFilter));
  }, [candidates, fieldFilter]);

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
            {filteredCandidates.map((client) => {
              const whatsappUrl = client.phone
                ? `https://wa.me/55${client.phone.replace(/\D/g, "")}`
                : null;
              return (
                <li
                  key={client.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <Link href={`/clientes/${client.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {client.name}
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
    </div>
  );
}
