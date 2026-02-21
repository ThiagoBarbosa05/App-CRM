import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FileText,
  CreditCard,
  Phone,
  Mail,
  User,
  ChevronUp,
  ChevronDown,
  Edit2,
  Trash2,
  Settings,
  Loader2,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Company } from "@shared/schema";

interface CompaniesTableProps {
  companies: Company[];
  isLoading: boolean;
  isFetching: boolean;
  selectedCompanies: string[];
  onSelectCompany: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onSort: (field: "nomeFantasia" | "razaoSocial") => void;
  sortField: "nomeFantasia" | "razaoSocial" | null;
  sortDirection: "asc" | "desc";
  getResponsavelName: (id: string | null) => string;
  onCompanyClick: (company: Company) => void;
  onEdit: (company: Company) => void;
  onDelete: (id: string) => void;
  page: number;
  totalPages: number;
  totalItems: number;
  setPage: (page: number) => void;
}

export function CompaniesTable({
  companies,
  isLoading,
  isFetching,
  selectedCompanies,
  onSelectCompany,
  onSelectAll,
  onSort,
  sortField,
  sortDirection,
  getResponsavelName,
  onCompanyClick,
  onEdit,
  onDelete,
  page,
  totalPages,
  totalItems,
  setPage,
}: CompaniesTableProps) {
  if (isLoading && !companies.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[400px] flex flex-col items-center justify-center p-12">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
          Carregando empresas...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
      {/* Loading Overlay */}
      {isFetching && (
        <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      <div className="overflow-x-auto min-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
              <TableHead className="w-12 px-6">
                <Checkbox
                  checked={selectedCompanies.length === companies.length && companies.length > 0}
                  onCheckedChange={(checked) => onSelectAll(checked as boolean)}
                  className="rounded-md border-slate-300 dark:border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
              </TableHead>
              <TableHead className="px-6 py-4">
                <button
                  onClick={() => onSort("nomeFantasia")}
                  className="flex items-center gap-2 group text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                >
                  <Building2 className={`h-4 w-4 transition-colors ${sortField === "nomeFantasia" ? "text-blue-500" : "group-hover:text-blue-500"}`} />
                  Nome Fantasia
                  {sortField === "nomeFantasia" && (
                    sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </TableHead>
              <TableHead className="px-6 py-4">
                <button
                  onClick={() => onSort("razaoSocial")}
                  className="flex items-center gap-2 group text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                >
                  <FileText className={`h-4 w-4 transition-colors ${sortField === "razaoSocial" ? "text-indigo-500" : "group-hover:text-indigo-500"}`} />
                  Razão Social
                  {sortField === "razaoSocial" && (
                    sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  CNPJ
                </div>
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-orange-500" />
                  Contato
                </div>
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-400" />
                  Responsável
                </div>
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="flex items-center justify-end gap-2 text-slate-400">
                  <Settings className="h-4 w-4" />
                  Ações
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-full">
                        <Building2 className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">Nenhuma empresa encontrada com estes filtros.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company, index) => (
                  <motion.tr
                    key={company.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
                    className={`group border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${selectedCompanies.includes(company.id) ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                  >
                    <TableCell className="px-6 py-4">
                      <Checkbox
                        checked={selectedCompanies.includes(company.id)}
                        onCheckedChange={(checked) => onSelectCompany(company.id, checked as boolean)}
                        className="rounded-md border-slate-300 dark:border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <button
                        onClick={() => onCompanyClick(company)}
                        className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors max-w-[200px] truncate"
                      >
                        {company.nomeFantasia || "Sem nome fantasia"}
                      </button>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[220px] truncate">
                      {company.razaoSocial}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50">
                        {company.cnpj || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{company.phone || "N/A"}</span>
                         {company.phone && (
                            <a
                              href={`https://wa.me/${company.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                              title="Abrir no WhatsApp"
                            >
                              <FaWhatsapp className="h-4 w-4" />
                            </a>
                         )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-slate-800 flex items-center justify-center border border-blue-100 dark:border-slate-700">
                          <User className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {getResponsavelName(company.responsavelId)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={`h-6 px-2.5 font-semibold text-[10px] uppercase tracking-wider ${
                          company.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50"
                            : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {company.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity translate-x-2 xl:translate-x-0 xl:group-hover:translate-x-0 transition-transform">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(company)}
                          className="h-9 w-9 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deseja excluir esta empresa?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação removerá permanentemente a empresa <strong>{company.nomeFantasia}</strong> e não poderá ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onDelete(company.id)}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                              >
                                Excluir Empresa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Página <span className="text-slate-900 dark:text-slate-100">{page}</span> de <span className="text-slate-900 dark:text-slate-100">{totalPages}</span>
            <span className="mx-2 opacity-30 text-slate-300">|</span>
            <span className="text-slate-900 dark:text-slate-100">{totalItems}</span> registros no total
          </p>

          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="h-9 px-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
            >
              Anterior
            </Button>
            <div className="w-10 h-8 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 border-x border-slate-100 dark:border-slate-800">
              {page}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="h-9 px-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
