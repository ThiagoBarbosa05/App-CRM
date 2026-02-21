import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle, TrendingUp, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface AcompanhamentoStats {
  totalPendentes: number;
  criticos: number;
  alta: number;
  media: number;
  normal: number;
  produtividade: number;
  totalInteracoes: number;
  mediaInteracoes: string;
}

interface AcompanhamentoMetricsProps {
  stats: AcompanhamentoStats;
}

// Configuração de animação para stagger dos cards
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function AcompanhamentoMetrics({ stats }: AcompanhamentoMetricsProps) {
  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Main Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <motion.div variants={itemVariants}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Total Pendentes
                  </p>
                  <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {stats.totalPendentes}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-white to-red-50/50 dark:from-slate-900 dark:to-red-900/10 hover:shadow-md transition-shadow relative overflow-hidden">
             {/* Subtle alert pulse if criticos > 0 */}
             {stats.criticos > 0 && (
               <div className="absolute -top-10 -right-10 w-24 h-24 bg-red-400/20 rounded-full blur-xl animate-pulse" />
             )}
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Críticos
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-red-600 dark:text-red-500 tracking-tight">
                      {stats.criticos}
                    </p>
                    <span className="text-[11px] font-medium text-red-600/70 dark:text-red-400/70 uppercase tracking-wider bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">
                      30+ dias
                    </span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-900/10 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Produtividade
                  </p>
                  <div className="flex items-baseline gap-2">
                     <p className="text-3xl font-black text-emerald-600 dark:text-emerald-500 tracking-tight">
                      {stats.produtividade}%
                    </p>
                   </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none shadow-sm bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-900 dark:to-indigo-900/10 hover:shadow-md transition-shadow">
             <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Média de Interações
                  </p>
                  <div className="flex items-baseline gap-2">
                     <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                      {stats.mediaInteracoes}
                    </p>
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      / cliente
                    </span>
                   </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Secondary Metrics Row (Priority breakdown) */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border-slate-200/60 dark:border-slate-800/60 shadow-none hover:bg-white dark:hover:bg-slate-900 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-black text-orange-500 dark:text-orange-400 tracking-tight mb-1">
              {stats.alta}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Alta <span className="opacity-70 normal-case block sm:inline mt-0.5 sm:mt-0">(14-30 dias)</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border-slate-200/60 dark:border-slate-800/60 shadow-none hover:bg-white dark:hover:bg-slate-900 transition-colors">
           <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-black text-yellow-500 dark:text-yellow-400 tracking-tight mb-1">
              {stats.media}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Média <span className="opacity-70 normal-case block sm:inline mt-0.5 sm:mt-0">(7-14 dias)</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border-slate-200/60 dark:border-slate-800/60 shadow-none hover:bg-white dark:hover:bg-slate-900 transition-colors">
           <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-black text-blue-500 dark:text-blue-400 tracking-tight mb-1">
              {stats.normal}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Normal <span className="opacity-70 normal-case block sm:inline mt-0.5 sm:mt-0">(1-7 dias)</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border-slate-200/60 dark:border-slate-800/60 shadow-none hover:bg-white dark:hover:bg-slate-900 transition-colors">
           <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight mb-1">
              {stats.totalInteracoes}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
               <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Registrado
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
