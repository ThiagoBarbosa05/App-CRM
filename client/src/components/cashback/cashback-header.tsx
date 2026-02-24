import React from "react";
import { Gift } from "lucide-react";
import { motion } from "framer-motion";

export function CashbackHeader() {
  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl shadow-blue-500/5 border border-slate-100 dark:border-slate-800">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
      
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-start gap-6">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="hidden sm:flex w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-3xl items-center justify-center shadow-lg shadow-blue-500/20 ring-8 ring-blue-50 dark:ring-blue-900/10"
          >
            <Gift className="h-10 w-10 text-white" />
          </motion.div>
          
          <div className="space-y-2">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                Sistema de <span className="text-blue-600 dark:text-blue-400">Cashback</span>
              </h1>
            </motion.div>
            
            <motion.p 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-2xl"
            >
              Gestão estratégica de recompensas, saldos e fidelização de clientes.
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}
