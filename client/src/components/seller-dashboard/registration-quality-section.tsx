import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ClipboardList, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { RegistrationQualityBar } from "@/components/clients/registration-quality-bar";
import type { RegistrationQualityCandidate } from "@/hooks/use-registration-quality-panel";
import { useRegistrationQualityPanel } from "@/hooks/use-registration-quality-panel";

interface RegistrationQualitySectionProps {
  sellerId?: string;
}

const PREVIEW_SIZE = 5;

export function RegistrationQualitySection({
  sellerId,
}: RegistrationQualitySectionProps) {
  const { data, isLoading } = useRegistrationQualityPanel(sellerId);
  const candidates = data?.slice(0, PREVIEW_SIZE) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-5 w-5 text-amber-500" />
          <div>
            <CardTitle className="text-base">
              Clientes para atualizar cadastro
            </CardTitle>
            <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
              Compram bem, mas o cadastro está incompleto
            </p>
          </div>
        </div>
        <Link href="/clientes/qualidade-cadastro">
          <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0">
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
            Nenhum cliente com cadastro incompleto por aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((client: RegistrationQualityCandidate) => (
              <Link
                key={client.id}
                href={`/clientes/${client.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {client.name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {formatCurrency(client.totalSpent)} · {client.orderCount} pedido(s)
                  </p>
                </div>
                <RegistrationQualityBar
                  quality={client.registrationQuality}
                  className="shrink-0"
                />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
