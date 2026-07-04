import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Users, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegistrationQualityBar } from "@/components/clients/registration-quality-bar";
import { useAuth } from "@/hooks/useAuth";
import { useRegistrationQualityPanel } from "@/hooks/use-registration-quality-panel";
import { formatCurrency } from "@/lib/utils";
import { FaWhatsapp } from "react-icons/fa";

interface UserOption {
  id: string;
  name: string;
  isActive: string;
}

export default function ClientsRegistrationQualityPage() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "admin" || user?.role === "gerente";

  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");

  const { data: usersList = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    enabled: isAdminOrManager,
    select: (users) =>
      users
        .filter((u) => u.isActive === "true")
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  const responsavelId = isAdminOrManager
    ? selectedSellerId === "all"
      ? undefined
      : selectedSellerId
    : undefined;

  const { data: candidates, isLoading } = useRegistrationQualityPanel(responsavelId);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon icon={ClipboardList} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-900/20" />
          <PageHeader.Text>
            <PageHeader.Title>Clientes para atualizar cadastro</PageHeader.Title>
            <PageHeader.Description>
              Compram bem ou com frequência, mas o cadastro está incompleto
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>

        {isAdminOrManager && (
          <PageHeader.Actions>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-52 rounded-lg text-sm font-medium">
                  <SelectValue placeholder="Selecionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-semibold">
                    Todos os vendedores
                  </SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PageHeader.Actions>
        )}
      </PageHeader>

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
                  <Link
                    href={`/clientes/${client.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {client.name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatCurrency(client.totalSpent)} · {client.orderCount} pedido(s)
                    </p>
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
