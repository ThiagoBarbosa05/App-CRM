import { Users, PieChart, Tag, MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface ClientReportsGridProps {
  clientsByCategory: Array<{ category: string | null; count: number }>;
  clientsByOrigin: Array<{ origin: string | null; count: number }>;
  clientsByUser: Array<{ userId: string | null; userName: string; count: number }>;
  clientsByMarkers: Array<{ marker: string; count: number }>;
}

export function ClientReportsGrid({
  clientsByCategory,
  clientsByOrigin,
  clientsByUser,
  clientsByMarkers,
}: ClientReportsGridProps) {
  return (
    <div className="space-y-8">
      <SectionHeader
        icon={<Users className="h-5 w-5" />}
        title="Análise de Clientes"
        description="Distribuição e segmentação da base de clientes"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DistributionCard
          title="Por Categoria"
          description="Segmentação por tipo de cliente"
          items={clientsByCategory.map((d) => ({
            label: d.category ?? "Sem categoria",
            count: d.count,
          }))}
          icon={<PieChart className="h-5 w-5" />}
          color="purple"
        />

        <DistributionCard
          title="Por Origem"
          description="Como os clientes chegaram até você"
          items={clientsByOrigin.map((d) => ({
            label: d.origin ?? "Sem origem",
            count: d.count,
          }))}
          icon={<MapPin className="h-5 w-5" />}
          color="cyan"
        />

        <DistributionCard
          title="Por Responsável"
          description="Distribuição da carteira entre a equipe"
          items={clientsByUser.map((d) => ({
            label: d.userName || "Sem responsável",
            count: d.count,
          }))}
          icon={<Users className="h-5 w-5" />}
          color="indigo"
          solidBadge
        />

        <DistributionCard
          title="Por Marcadores"
          description="Classificação por etiquetas e tags"
          items={clientsByMarkers.map((d) => ({
            label: d.marker || "Sem marcador",
            count: d.count,
          }))}
          icon={<Tag className="h-5 w-5" />}
          color="rose"
        />
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-900/10 dark:to-green-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 text-emerald-600 dark:text-emerald-400 shadow-sm">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

interface DistributionCardProps {
  title: string;
  description: string;
  items: Array<{ label: string; count: number }>;
  icon: React.ReactNode;
  color: string;
  solidBadge?: boolean;
}

function DistributionCard({
  title,
  description,
  items,
  icon,
  color,
  solidBadge,
}: DistributionCardProps) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group h-full border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader
          className={`pb-4 border-b border-slate-50 dark:border-slate-800/50 bg-${color}-50/30 dark:bg-${color}-900/10`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`bg-${color}-100 dark:bg-${color}-900/30 rounded-xl p-2.5 text-${color}-600 dark:text-${color}-400 group-hover:scale-110 transition-transform`}
            >
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {sorted.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400 italic">
                Nenhum dado disponível
              </p>
            </div>
          ) : (
            sorted.map(({ label, count }) => {
              const percentage = total > 0 ? (count / total) * 100 : 0;
              return (
                <div
                  key={label}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge
                      variant={solidBadge ? "default" : "secondary"}
                      className={`px-2.5 py-0.5 font-bold text-[11px] truncate max-w-[140px] ${
                        solidBadge
                          ? `bg-${color}-600 hover:bg-${color}-700 text-white border-none shadow-sm`
                          : `bg-${color}-50 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400 border-${color}-100 dark:border-${color}-800/30`
                      }`}
                    >
                      {label}
                    </Badge>
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[100px] hidden sm:block">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className={`h-full bg-${color}-500/50`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {percentage.toFixed(0)}%
                    </span>
                    <div
                      className={`min-w-[40px] text-center bg-${color}-100 dark:bg-${color}-900/30 px-2 py-1 rounded-lg`}
                    >
                      <span
                        className={`font-black text-${color}-700 dark:text-${color}-400 text-sm`}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
