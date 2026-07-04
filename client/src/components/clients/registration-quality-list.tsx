import { Link } from "wouter";
import { User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RegistrationQualityBar } from "@/components/clients/registration-quality-bar";
import { useRegistrationQualityPanel } from "@/hooks/use-registration-quality-panel";
import { formatCurrency } from "@/lib/utils";
import { FaWhatsapp } from "react-icons/fa";

interface RegistrationQualityListProps {
  responsavelId?: string;
}

export function RegistrationQualityList({
  responsavelId,
}: RegistrationQualityListProps) {
  const { data: candidates, isLoading } = useRegistrationQualityPanel(responsavelId);

  return (
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
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {candidates.map((client) => {
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
  );
}
