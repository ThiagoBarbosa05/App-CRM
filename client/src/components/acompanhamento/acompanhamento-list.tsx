import { User, Phone, Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FaWhatsapp } from "react-icons/fa";
import { motion } from "framer-motion";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ClientWithStats {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  createdAt: string;
  daysSinceCreated: number;
  responsavelName?: string;
}

interface PaginationData {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface AcompanhamentoListProps {
  clients: ClientWithStats[];
  isLoading: boolean;
  isFetching: boolean;
  searchQuery: string;
  pagination?: PaginationData;
  page: number;
  setPage: (page: number | ((p: number) => number)) => void;
  onContactClick: (client: ClientWithStats) => void;
}

export function AcompanhamentoList({
  clients,
  isLoading,
  isFetching,
  searchQuery,
  pagination,
  page,
  setPage,
  onContactClick,
}: AcompanhamentoListProps) {
  const getPriorityColor = (days: number) => {
    if (days > 30)
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50";
    if (days > 14)
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50";
    if (days > 7)
      return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50";
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50";
  };

  const getPriorityLabel = (days: number) => {
    if (days > 30) return "Estado Crítico";
    if (days > 14) return "Prioridade Alta";
    if (days > 7) return "Prioridade Média";
    return "Prioridade Normal";
  };

  if (isFetching && !clients.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Carregando lista de acompanhamento...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      {/* Loading Overlay for pagination fetches */}
      {isFetching && clients.length > 0 && (
         <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 shadow-sm" />
         </div>
      )}

      <div className={`min-h-[400px] transition-opacity duration-300 ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
        {clients.length === 0 ? (
          <div className="p-8 text-center flex flex-col justify-center items-center h-[400px]">
            <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-5 border border-slate-100 dark:border-slate-800">
               <User className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {searchQuery ? "Nenhum cliente encontrado" : "Tudo em dia!"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              {searchQuery
                ? "Tente ajustar os termos da sua busca (nome, telefone ou CPF)."
                : "Excelente trabalho! Todos os clientes da sua carteira estão com o acompanhamento em dia."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {clients.map((client, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
                key={client.id}
                className="p-5 sm:p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group"
              >
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
                  <div className="flex items-start sm:items-center gap-4 w-full xl:w-auto min-w-0">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center border border-blue-100 dark:border-slate-600 shrink-0 shadow-sm">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {client.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5 font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                          <Phone className="h-3.5 w-3.5" />
                          {client.phone}
                        </span>
                        {client.email && (
                          <span className="truncate max-w-[200px]">{client.email}</span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 opacity-70" />
                           Base há {client.daysSinceCreated} dias
                        </span>
                        {client.responsavelName && (
                          <span className="hidden sm:inline-block text-slate-400">
                            • Resp: <span className="font-medium text-slate-600 dark:text-slate-300">{client.responsavelName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto justify-between xl:justify-end pl-16 xl:pl-0 mt-3 xl:mt-0">
                    <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-1 w-full sm:w-auto justify-between sm:justify-start">
                      <Badge
                        className={`${getPriorityColor(
                          client.daysSinceCreated
                        )} px-2.5 py-1 text-xs shadow-sm font-semibold tracking-wide`}
                      >
                        {getPriorityLabel(client.daysSinceCreated)}
                      </Badge>
                      <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <span className="text-slate-900 dark:text-slate-200 font-bold">{client.daysSinceCreated}</span> dias s/ contato
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 dark:border-emerald-900/50 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 transition-all text-emerald-600 dark:text-emerald-500 shadow-sm"
                        asChild
                        title="Abrir no WhatsApp"
                      >
                        <a
                          href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaWhatsapp className="h-5 w-5" />
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:border-blue-900/50 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-all text-blue-600 dark:text-blue-500 shadow-sm"
                        asChild
                        title="Ligar"
                      >
                         <a href={`tel:${client.phone}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onContactClick(client)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-4 font-semibold shadow-sm shadow-blue-500/20 sm:w-auto flex-1 sm:flex-none transition-all active:scale-95"
                      >
                        Registrar
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
           <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block font-medium px-4">
             Mostrando <span className="text-slate-900 dark:text-slate-200 font-bold">{clients.length}</span> de <span className="text-slate-900 dark:text-slate-200 font-bold">{pagination.totalItems}</span> registros
           </p>
          <Pagination className="justify-center sm:justify-end mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(p - 1, 1));
                  }}
                  className={`rounded-lg ${
                    !pagination || page <= 1
                      ? "pointer-events-none opacity-50 bg-transparent"
                      : "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                  }`}
                />
              </PaginationItem>
              <PaginationItem className="hidden sm:inline-block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mx-1">
                   Página {pagination.currentPage} de {pagination.totalPages}
                </span>
              </PaginationItem>
               <PaginationItem className="sm:hidden">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-2 opacity-80">
                   {pagination.currentPage} / {pagination.totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(p + 1, pagination.totalPages));
                  }}
                  className={`rounded-lg ${
                    !pagination || page >= pagination.totalPages
                      ? "pointer-events-none opacity-50 bg-transparent"
                      : "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                  }`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
