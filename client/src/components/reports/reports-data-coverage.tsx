import { ShieldCheck, Mail, CreditCard, MapPin, Phone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "framer-motion";

interface ReportsDataCoverageProps {
  totalClients: number;
  clientsWithEmail: number;
  clientsWithPhone: number;
  clientsWithCPF: number;
  clientsWithAddress: number;
}

interface CoverageItemProps {
  label: string;
  description: string;
  withCount: number;
  total: number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}

function CoverageItem({
  label,
  description,
  withCount,
  total,
  icon,
  color,
  delay,
}: CoverageItemProps) {
  const percentage = total > 0 ? (withCount / total) * 100 : 0;
  const withoutCount = total - withCount;

  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
  };

  const textColorMap: Record<string, string> = {
    blue: "text-blue-700 dark:text-blue-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
    violet: "text-violet-700 dark:text-violet-400",
    amber: "text-amber-700 dark:text-amber-400",
  };

  const bgColorMap: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30",
    emerald: "bg-emerald-100 dark:bg-emerald-900/30",
    violet: "bg-violet-100 dark:bg-violet-900/30",
    amber: "bg-amber-100 dark:bg-amber-900/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${bgColorMap[color]}`}>
            <div className={textColorMap[color]}>{icon}</div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-black ${textColorMap[color]}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: delay + 0.2, duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${colorMap[color]}`}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {withCount.toLocaleString("pt-BR")}
          </span>{" "}
          com dados
        </span>
        <span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {withoutCount.toLocaleString("pt-BR")}
          </span>{" "}
          sem dados
        </span>
      </div>
    </motion.div>
  );
}

export function ReportsDataCoverage({
  totalClients,
  clientsWithEmail,
  clientsWithPhone,
  clientsWithCPF,
  clientsWithAddress,
}: ReportsDataCoverageProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-blue-500">
      <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Qualidade dos Dados
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Cobertura de informações essenciais na base de clientes
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <CoverageItem
          label="E-mail"
          description="Para campanhas e comunicação digital"
          withCount={clientsWithEmail}
          total={totalClients}
          icon={<Mail className="h-4 w-4" />}
          color="blue"
          delay={0}
        />
        <div className="border-t border-slate-50 dark:border-slate-800" />
        <CoverageItem
          label="Telefone / Celular"
          description="Para contato direto e WhatsApp"
          withCount={clientsWithPhone}
          total={totalClients}
          icon={<Phone className="h-4 w-4" />}
          color="amber"
          delay={0.1}
        />
        <div className="border-t border-slate-50 dark:border-slate-800" />
        <CoverageItem
          label="CPF / Documento"
          description="Para identificação e compliance"
          withCount={clientsWithCPF}
          total={totalClients}
          icon={<CreditCard className="h-4 w-4" />}
          color="emerald"
          delay={0.2}
        />
        <div className="border-t border-slate-50 dark:border-slate-800" />
        <CoverageItem
          label="Endereço"
          description="Para entregas e segmentação geográfica"
          withCount={clientsWithAddress}
          total={totalClients}
          icon={<MapPin className="h-4 w-4" />}
          color="violet"
          delay={0.3}
        />
      </CardContent>
    </Card>
  );
}
