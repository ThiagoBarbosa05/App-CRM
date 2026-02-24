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
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
}

interface ProductsTableProps {
  products: Product[];
  isFetching: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onViewClients: (product: Product) => void;
  getCountryFlag: (country: string) => string;
  getTypeColor: (type: string) => string;
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  setCurrentPage: (page: number) => void;
}

export function ProductsTable({
  products,
  isFetching,
  onEdit,
  onDelete,
  onViewClients,
  getCountryFlag,
  getTypeColor,
  currentPage,
  totalPages,
  totalProducts,
  setCurrentPage,
}: ProductsTableProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <div className="overflow-x-auto grow">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <TableHead className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">
                Nome do Vinho
              </TableHead>
              <TableHead className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200 hidden sm:table-cell">
                Origem
              </TableHead>
              <TableHead className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200 hidden md:table-cell">
                Volume
              </TableHead>
              <TableHead className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200 hidden lg:table-cell">
                Variação
              </TableHead>
              <TableHead className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">
                Preço
              </TableHead>
              <TableHead className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200 hidden lg:table-cell">
                Alcance
              </TableHead>
              <TableHead className="text-right py-4 px-6 font-bold text-slate-800 dark:text-slate-200">
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
                  <TableCell colSpan={7} className="text-center py-24">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-500" />
                        <Wine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-blue-500/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300">Carregando estoque...</p>
                        <p className="text-sm text-slate-400">Só um instante enquanto preparamos a lista</p>
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
                  <TableCell colSpan={7} className="text-center py-24">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full">
                        <Wine className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Adega vazia</p>
                        <p className="text-sm text-slate-400">Nenhum produto encontrado com os filtros atuais.</p>
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
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800 transition-colors group"
                  >
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-blue-100/50 dark:border-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                          <Wine className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">
                            {product.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                            REF: {product.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">
                          {getCountryFlag(product.country)}
                        </span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                          {product.country}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 hidden md:table-cell">
                      <Badge
                        variant="outline"
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold"
                      >
                        {product.volume}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-6 hidden lg:table-cell">
                      <Badge
                        className={`font-black uppercase text-[10px] shadow-sm ${getTypeColor(
                          product.type,
                        )} border-0`}
                      >
                        {product.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                          R${" "}
                          {parseFloat(product.negotiatedPrice).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Preço Un.</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 hidden lg:table-cell">
                      <div className="flex items-center gap-3">
                        <div 
                          className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors group/clients"
                          onClick={() => onViewClients(product)}
                        >
                          <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 group-hover/clients:scale-110 transition-transform" />
                          <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                            {product.clientCount}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Vínculos</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-4 px-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(product)}
                          className="h-9 w-9 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-bold text-xl">Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500 font-medium">
                                Tem certeza que deseja remover o produto 
                                <span className="text-slate-900 dark:text-slate-100 font-bold ml-1 italic">
                                  "{product.name}"
                                </span>? 
                                <br />Essa ação removerá o produto de todas as cartas de vinhos vinculadas e não poderá ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(product.id)}
                                className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-xl font-bold"
                              >
                                Confirmar Exclusão
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
      <div className="bg-slate-50/50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 p-5 px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl shadow-inner">
              <Wine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                Estoque Monitorado
              </p>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                Exibindo {products.length} vinhos de {totalProducts}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isFetching}
                className="h-9 px-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all group"
              >
                <ChevronLeft className="h-4 w-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-bold text-sm hidden xs:inline">Anterior</span>
              </Button>
              
              <div className="flex items-center px-4 font-black text-sm text-slate-700 dark:text-slate-300">
                <span className="text-blue-600 dark:text-blue-400">{currentPage}</span>
                <span className="mx-1 text-slate-300">/</span>
                <span>{totalPages}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || isFetching}
                className="h-9 px-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all group"
              >
                <span className="font-bold text-sm hidden xs:inline">Próxima</span>
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
