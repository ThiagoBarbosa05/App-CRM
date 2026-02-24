import { GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

export function TrainingsHeader() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 px-8 py-10 rounded-[2.5rem] shadow-sm mb-8"
    >
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-indigo-500/5 rounded-full blur-[80px]" />
      
      <div className="relative flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/20 ring-4 ring-blue-50 dark:ring-blue-900/20">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase transition-all">
              Centro de <span className="text-blue-600 dark:text-blue-400">Treinamento</span>
            </h1>
            <div className="hidden sm:flex px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
              <span className="text-[10px] font-black uppercase tracking-tighter text-blue-600 dark:text-blue-400">Hub de Aprendizado</span>
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-sm md:text-base font-medium leading-relaxed">
            Vídeos, documentos e recursos especializados para potencializar sua performance técnica e comercial.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
