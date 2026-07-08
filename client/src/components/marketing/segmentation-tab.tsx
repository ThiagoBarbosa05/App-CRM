import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Sparkles,
  Wine,
  CalendarHeart,
  ArrowRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SegmentWithCount {
  id: string;
  label: string;
  description: string;
  filters: Record<string, string | boolean>;
  count: number;
}

interface SegmentGroupWithCounts {
  id: string;
  title: string;
  description: string;
  segments: SegmentWithCount[];
}

interface SegmentsOverview {
  total: number;
  groups: SegmentGroupWithCounts[];
}

const GROUP_STYLE: Record<
  string,
  { icon: React.ElementType; iconBg: string; iconColor: string; accent: string }
> = {
  rfm: {
    icon: Trophy,
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400",
  },
  lifecycle: {
    icon: Sparkles,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400",
  },
  product: {
    icon: Wine,
    iconBg: "bg-rose-50 dark:bg-rose-950/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    accent: "text-rose-600 dark:text-rose-400",
  },
  events: {
    icon: CalendarHeart,
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    accent: "text-violet-600 dark:text-violet-400",
  },
};

/** Monta a URL de deep-link para a lista de clientes já filtrada. */
function buildClientsUrl(filters: Record<string, string | boolean>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/clientes?${query}` : "/clientes";
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function MarketingSegmentationTab() {
  const { data, isLoading, isError } = useQuery<SegmentsOverview>({
    queryKey: ["/api/segments/overview"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[0, 1, 2, 3].map((g) => (
          <div key={g} className="space-y-3">
            <div className="h-5 w-52 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((c) => (
                <div
                  key={c}
                  className="h-28 rounded-lg bg-muted animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Não foi possível carregar os segmentos. Tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          Base total:{" "}
          <span className="font-semibold text-foreground">
            {formatNumber(data.total)}
          </span>{" "}
          clientes. Clique em um segmento para abrir a lista já filtrada e criar
          uma campanha.
        </span>
      </div>

      {data.groups.map((group) => {
        const style = GROUP_STYLE[group.id] ?? GROUP_STYLE.rfm;
        const Icon = style.icon;
        return (
          <section key={group.id} className="space-y-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  style.iconBg,
                )}
              >
                <Icon className={cn("h-5 w-5", style.iconColor)} />
              </div>
              <div>
                <h3 className="text-base font-semibold leading-tight">
                  {group.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.segments.map((segment) => (
                <Link key={segment.id} href={buildClientsUrl(segment.filters)}>
                  <Card className="group h-full cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40">
                    <CardContent className="flex h-full flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">
                          {segment.label}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {formatNumber(segment.count)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {segment.description}
                      </p>
                      <span
                        className={cn(
                          "mt-auto inline-flex items-center gap-1 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100",
                          style.accent,
                        )}
                      >
                        Ver clientes
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
