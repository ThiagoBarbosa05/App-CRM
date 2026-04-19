import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Edit,
  Trash2,
  Users,
  Wine,
  ChevronLeft,
  ChevronRight,
  User,
  MoreVertical,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: string;
  name: string;
  category?: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
  imageUrl?: string | null;
}

interface ProductsTableProps {
  products: Product[];
  isFetching: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onViewClients: (product: Product) => void;
  onViewDetail: (product: Product) => void;
  getCountryFlag: (country: string) => string;
  getTypeColor: (type: string) => string;
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  setCurrentPage: (page: number) => void;
}

function isWineProduct(category?: string) {
  return (
    category
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .startsWith("VINHO") ?? false
  );
}

export function ProductsTable({
  products,
  isFetching,
  onEdit,
  onDelete,
  onViewClients,
  onViewDetail,
  getCountryFlag,
  getTypeColor,
  currentPage,
  totalPages,
  totalProducts,
  setCurrentPage,
}: ProductsTableProps) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
      <div className="overflow-x-auto grow">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60 hover:bg-transparent">
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Produto
              </TableHead>
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:table-cell">
                País
              </TableHead>
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden md:table-cell">
                Volume
              </TableHead>
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">
                Categoria
              </TableHead>
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">
                Tipo
              </TableHead>
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Preço
              </TableHead>
              <TableHead className="py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden lg:table-cell">
                Alcance
              </TableHead>
              <TableHead className="text-right py-5 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="wait">
              {isFetching ? (
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <TableCell colSpan={8} className="text-center py-32">
                    <div className="flex flex-col items-center gap-5">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-14 w-14 border-[3px] border-blue-500/20 border-t-blue-600" />
                        <Wine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-blue-600/80" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          Carregando catálogo...
                        </p>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Só um instante enquanto preparamos a lista
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </motion.tr>
              ) : products.length === 0 ? (
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <TableCell colSpan={8} className="text-center py-32">
                    <div className="flex flex-col items-center gap-5">
                      <div className="p-5 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/80 dark:to-slate-900 rounded-3xl shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                        <Wine className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div className="space-y-1 max-w-xs">
                        <p className="font-extrabold text-slate-800 dark:text-slate-200 tracking-tight text-lg">
                          Adega vazia
                        </p>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Não encontramos nenhum vinho com os filtros atuais.
                          Tente ajustar sua busca.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </motion.tr>
              ) : (
                products.map((product, index) => (
                  <motion.tr
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.3 }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-200 group"
                  >
                    <TableCell className="py-5 px-6">
                      <div
                        className="flex items-center gap-4 cursor-pointer"
                        onClick={() => onViewDetail(product)}
                      >
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 flex items-center justify-center shrink-0 border border-blue-100/60 dark:border-slate-700/60 group-hover:scale-105 group-hover:shadow-md group-hover:from-blue-100 group-hover:to-indigo-100 transition-all duration-300 overflow-hidden relative">
                          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal relative z-10"
                            />
                          ) : (
                            <Wine className="h-5 w-5 text-blue-600/70 dark:text-blue-400 relative z-10" />
                          )}
                        </div>
                        <div className="min-w-0 pr-4">
                          <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm sm:text-base">
                            {product.name}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider mt-1">
                            REF: {product.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 px-6 hidden sm:table-cell">
                      {!isWineProduct(product.category) ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl leading-none filter drop-shadow-sm">
                            {getCountryFlag(product.country)}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                            {product.country}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-5 px-6 hidden md:table-cell">
                      {!isWineProduct(product.category) ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-bold border-0"
                        >
                          {product.volume}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-5 px-6 hidden lg:table-cell">
                      {product.category ? (
                        <Badge
                          variant="secondary"
                          className="bg-violet-100/80 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold border-0 text-[10px] uppercase tracking-widest"
                        >
                          {product.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-5 px-6 hidden lg:table-cell">
                      {!isWineProduct(product.category) ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <Badge
                          className={`font-black uppercase text-[10px] tracking-widest shadow-sm ${getTypeColor(
                            product.type,
                          )} border-0 px-2.5 py-1`}
                        >
                          {product.type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-5 px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-emerald-700 dark:text-emerald-400 font-black text-[15px]">
                          R${" "}
                          {parseFloat(product.negotiatedPrice).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Unidade
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 px-6 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center justify-center min-w-[54px] gap-2 px-2.5 py-1.5 bg-blue-50/80 dark:bg-blue-500/10 border border-blue-100/80 dark:border-blue-500/20 rounded-xl cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors group/clients shadow-sm"
                          onClick={() => onViewClients(product)}
                        >
                          <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 group-hover/clients:scale-110 transition-transform" />
                          <span className="text-sm font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">
                            {product.clientCount}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-5 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(product)}
                          className="h-10 w-10 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                        >
                          <Edit className="h-[18px] w-[18px]" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-slate-200/60 dark:border-slate-800/60 p-8">
                            <AlertDialogHeader className="gap-2">
                              <div className="mx-auto bg-red-100 dark:bg-red-900/30 p-3 rounded-full mb-2">
                                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-500" />
                              </div>
                              <AlertDialogTitle className="font-extrabold text-2xl text-center text-slate-900 dark:text-white">
                                Excluir Produto?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500 font-medium text-center text-base">
                                Tem certeza que deseja remover o vinho
                                <strong className="text-slate-900 dark:text-slate-100 font-bold mx-1">
                                  {product.name}
                                </strong>
                                ?
                                <br className="hidden sm:block" />
                                Isso o removerá de todas as cartas vinculadas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-3 sm:justify-center mt-6">
                              <AlertDialogCancel className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold h-12 px-6">
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(product.id)}
                                className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-xl font-bold h-12 px-6 border-0 shadow-md shadow-red-500/20"
                              >
                                Sim, excluir vinho
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

      {/* Modern Footer with Pagination */}
      <div className="bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200/60 dark:border-slate-800/60 p-4 px-6 md:p-6 mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-2xl shadow-inner border border-blue-200/50 dark:border-blue-800/50">
              <Wine className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Vinhos Monitorados</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </p>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                Mostrando{" "}
                <span className="text-slate-700 dark:text-slate-300 font-black">
                  {products.length}
                </span>{" "}
                de{" "}
                <span className="text-slate-700 dark:text-slate-300 font-black">
                  {totalProducts}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm p-1.5 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isFetching}
                className="h-10 px-4 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl disabled:opacity-40 transition-all group"
              >
                <ChevronLeft className="h-4.5 w-4.5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-bold text-sm hidden xs:inline">
                  Anterior
                </span>
              </Button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <span className="px-4 font-black text-slate-700 dark:text-slate-200 text-sm whitespace-nowrap tabular-nums tracking-wide">
                <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                  Pág {currentPage}
                </span>{" "}
                <span className="text-slate-400 font-medium">/</span>{" "}
                {totalPages}
              </span>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages || isFetching}
                className="h-9 px-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all group"
              >
                <span className="font-bold text-sm hidden xs:inline">
                  Próxima
                </span>
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
