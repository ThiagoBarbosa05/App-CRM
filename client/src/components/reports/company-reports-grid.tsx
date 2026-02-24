import { Building2, CheckCircle2, XCircle, FileType, PieChart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "framer-motion";

interface CompanyReportsGridProps {
  stats?: {
    companiesActive: number;
    companiesInactive: number;
    companiesWithCNPJ: number;
    companiesWithoutCNPJ: number;
    companiesBySector: any[];
  };
  isLoading: boolean;
}

export function CompanyReportsGrid({ stats, isLoading }: CompanyReportsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-3xl" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-3 text-blue-600 dark:text-blue-400 shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Relatórios de Empresas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Análise de status e conformidade das empresas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <StatusCard
          title="Status de Ativação"
          description="Empresas ativas vs inativas"
          active={stats.companiesActive}
          inactive={stats.companiesInactive}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
          secondaryColor="rose"
        />

        {/* CNPJ Compliance */}
        <StatusCard
          title="Cobertura de CNPJ"
          description="Presença de documento fiscal"
          active={stats.companiesWithCNPJ}
          inactive={stats.companiesWithoutCNPJ}
          icon={<FileType className="h-5 w-5" />}
          color="blue"
          secondaryColor="slate"
          labelActive="Com CNPJ"
          labelInactive="Sem CNPJ"
        />
      </div>

      {/* Sectors (Optional or could be a third card) */}
      <Card className="group border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-900/10">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
               <PieChart className="h-5 w-5" />
             </div>
             <CardTitle className="text-lg font-bold">Principais Setores</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stats.companiesBySector.map((item, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center group/sector hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all"
                >
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 group-hover/sector:text-indigo-500 transition-colors uppercase">
                     Setor {index + 1}
                   </span>
                   <span className="text-xl font-black text-slate-900 dark:text-white mb-1">
                     {item.count}
                   </span>
                   <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-full">
                     Empresas registradas
                   </span>
                </motion.div>
              ))}
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({ 
  title, 
  description, 
  active, 
  inactive, 
  icon, 
  color, 
  secondaryColor,
  labelActive = "Ativas",
  labelInactive = "Inativas"
}: { 
  title: string, 
  description: string, 
  active: number, 
  inactive: number, 
  icon: any, 
  color: string,
  secondaryColor: string,
  labelActive?: string,
  labelInactive?: string
}) {
  const total = active + inactive;
  const activePercent = total > 0 ? (active / total) * 100 : 0;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className={`pb-4 border-b border-slate-50 dark:border-slate-800 bg-${color}-50/30 dark:bg-${color}-900/10`}>
          <div className="flex items-center gap-3">
            <div className={`bg-${color}-100 dark:bg-${color}-900/30 rounded-xl p-2.5 text-${color}-600 dark:text-${color}-400`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">{title}</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-6">
             <div className="space-y-1">
                <span className={`text-3xl font-black text-${color}-600 dark:text-${color}-400 leading-none`}>
                  {active}
                </span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{labelActive}</p>
             </div>
             <div className="h-12 w-[1px] bg-slate-100 dark:bg-slate-800" />
             <div className="space-y-1 text-right">
                <span className={`text-3xl font-black text-${secondaryColor}-500/50 leading-none`}>
                  {inactive}
                </span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{labelInactive}</p>
             </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span>Pancentual de Conformidade</span>
               <span className={`text-${color}-600`}>{activePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${activePercent}%` }}
                 className={`h-full bg-${color}-500`}
               />
               <div className={`h-full bg-${secondaryColor}-200 dark:bg-${secondaryColor}-900/40 flex-1`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
