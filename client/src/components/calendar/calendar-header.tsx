import { Calendar, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface CalendarHeaderProps {
  onCreateAutoReminders: () => void;
  isPending: boolean;
}

export function CalendarHeader({
  onCreateAutoReminders,
  isPending,
}: CalendarHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0 shadow-inner">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              Aniversários
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 truncate">
              Visualize e gerencie os aniversários dos seus clientes
            </p>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 w-full md:w-auto"
        >
          <Button
            onClick={onCreateAutoReminders}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-6 h-11 rounded-xl flex-1 md:flex-none"
          >
            <Bell className="h-4 w-4 mr-2" />
            {isPending ? "Criando..." : "Lembretes Automáticos"}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
