import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Trash,
  Download,
  Upload,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CompanyFormModal from "./company-form-modal";
import CompanyDetailsModal from "./company-details-modal";
import CompanyImportModal from "./company-import-modal";
import BulkDealCreationModal from "./bulk-deal-creation-modal";
import { Company } from "@shared/schema";
import { exportCompaniesToExcel } from "@/lib/excel-export";
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
} from "./ui/alert-dialog";

interface CompaniesManagementProps {
  currentUser: any;
}

export function CompaniesManagement({ currentUser }: CompaniesManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [nomeFantasiaFilter, setNomeFantasiaFilter] = useState("");
  const [debouncedNomeFantasiaFilter, setDebouncedNomeFantasiaFilter] =
    useState("");
  const [razaoSocialFilter, setRazaoSocialFilter] = useState("");
  const [debouncedRazaoSocialFilter, setDebouncedRazaoSocialFilter] =
    useState("");
  const [cnpjFilter, setCnpjFilter] = useState("");
  const [debouncedCnpjFilter, setDebouncedCnpjFilter] = useState("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkDealModalOpen, setIsBulkDealModalOpen] = useState(false);
  const [sortField, setSortField] = useState<
    "nomeFantasia" | "razaoSocial" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setDebouncedNomeFantasiaFilter(nomeFantasiaFilter);
      setDebouncedRazaoSocialFilter(razaoSocialFilter);
      setDebouncedCnpjFilter(cnpjFilter);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, nomeFantasiaFilter, razaoSocialFilter, cnpjFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "/api/companies",
      currentUser?.id,
      currentUser?.role,
      debouncedSearchQuery,
      debouncedNomeFantasiaFilter,
      debouncedRazaoSocialFilter,
      debouncedCnpjFilter,
      responsavelFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentUser?.id) params.append("userId", currentUser.id);
      if (currentUser?.role) params.append("userRole", currentUser.role);
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (debouncedNomeFantasiaFilter)
        params.append("nomeFantasia", debouncedNomeFantasiaFilter);
      if (debouncedRazaoSocialFilter)
        params.append("razaoSocial", debouncedRazaoSocialFilter);
      if (debouncedCnpjFilter) params.append("cnpj", debouncedCnpjFilter);
      if (responsavelFilter) params.append("responsavelId", responsavelFilter);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      const response = await fetch(`/api/companies?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: !!currentUser,
  });

  const companies = data?.data || [];
  const totalItems = data?.totalItems || 0;
  const totalPages = data?.totalPages || 1;

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const getResponsavelName = (responsavelId: string | null) => {
    if (!responsavelId) return "-";
    const user = (users as any[]).find((u) => u.id === responsavelId);
    return user ? user.name : "-";
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete company");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setSelectedCompanies([]);
      toast({
        title: "Empresa excluída",
        description: "A empresa foi excluída com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a empresa.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch(`/api/companies`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("Failed to delete companies");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setSelectedCompanies([]);
      toast({
        title: "Empresas excluídas",
        description: `${data.deletedCount} empresa(s) excluída(s) com sucesso.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir as empresas.",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      await exportCompaniesToExcel(companies, users as any[]);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Empresas exportadas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao exportar empresas.",
        variant: "destructive",
      });
    },
  });

  const sortedCompanies = [...companies].sort((a: Company, b: Company) => {
    if (!sortField) return 0;

    const aValue = a[sortField]?.toLowerCase() || "";
    const bValue = b[sortField]?.toLowerCase() || "";

    if (sortDirection === "asc") {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
  };

  const handleCompanyClick = (company: Company) => {
    setSelectedCompany(company);
    setIsDetailsModalOpen(true);
  };

  const handleDetailsModalClose = () => {
    setIsDetailsModalOpen(false);
    setSelectedCompany(null);
  };

  const handleEditFromDetails = (company: Company) => {
    setSelectedCompany(null);
    setIsDetailsModalOpen(false);
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleSelectCompany = (companyId: string, checked: boolean) => {
    if (checked) {
      setSelectedCompanies((prev) => [...prev, companyId]);
    } else {
      setSelectedCompanies((prev) => prev.filter((id) => id !== companyId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanies(
        sortedCompanies.map((company: Company) => company.id)
      );
    } else {
      setSelectedCompanies([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedCompanies.length === 0) return;

    const count = selectedCompanies.length;
    const message = count === 1 ? "esta empresa" : `estas ${count} empresas`;

    if (confirm(`Tem certeza que deseja excluir ${message}?`)) {
      bulkDeleteMutation.mutate(selectedCompanies);
    }
  };

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handleSort = (field: "nomeFantasia" | "razaoSocial") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Empresas</h2>
            <p className="text-gray-600 mt-1">
              Gerencie as empresas cadastradas no sistema
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              className="w-full sm:w-fit"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="w-full sm:w-fit"
            >
              <Download className="mr-2 h-4 w-4" />
              {exportMutation.isPending ? "Gerando..." : "Exportar"}
            </Button>
            {selectedCompanies.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    // TODO: Implementar edição em lote
                    toast({
                      title: "Funcionalidade em desenvolvimento",
                      description: "A edição em lote será implementada em breve.",
                    });
                  }}
                  className="w-full sm:w-fit"
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edição em Lote ({selectedCompanies.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsBulkDealModalOpen(true)}
                  className="w-full sm:w-fit bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Negócios em Lote ({selectedCompanies.length})
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="w-full sm:w-fit"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Excluir Selecionadas ({selectedCompanies.length})
                </Button>
              </>
            )}
            <Button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-fit"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Empresa
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-white shadow-lg p-5 rounded-lg">
        <div className="flex w-full items-center gap-4">
          <div className="relative w-full flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Busca geral..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-full border-gray-400 md:w-[480px]"
            />
          </div>

        </div>
        <div className="grid mt-5 grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Nome Fantasia
            </label>
            <Input
              className="border-gray-400"
              placeholder="Filtrar por Nome Fantasia..."
              value={nomeFantasiaFilter}
              onChange={(e) => setNomeFantasiaFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Razão Social
            </label>
            <Input
              className="border-gray-400"
              placeholder="Filtrar por Razão Social..."
              value={razaoSocialFilter}
              onChange={(e) => setRazaoSocialFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              CNPJ
            </label>
            <Input
              className="border-gray-400"
              placeholder="Filtrar por CNPJ..."
              value={cnpjFilter}
              onChange={(e) => setCnpjFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Responsável
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-gray-400 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={responsavelFilter}
              onChange={(e) => setResponsavelFilter(e.target.value)}
            >
              <option value="">Todos os responsáveis</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(nomeFantasiaFilter ||
          razaoSocialFilter ||
          cnpjFilter ||
          responsavelFilter ||
          searchQuery) && (
          <div className="flex mt-4 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setNomeFantasiaFilter("");
                setRazaoSocialFilter("");
                setCnpjFilter("");
                setResponsavelFilter("");
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        )}

        <div className="mt-10">
          {isLoading || isFetching ? (
            <div className="text-center py-8">
              <p>Carregando empresas...</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedCompanies.length === sortedCompanies.length &&
                          sortedCompanies.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("nomeFantasia")}
                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        Nome Fantasia
                        {sortField === "nomeFantasia" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("razaoSocial")}
                        className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        Razão Social
                        {sortField === "razaoSocial" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </button>
                    </TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <p className="text-muted-foreground">
                          {searchQuery
                            ? "Nenhuma empresa encontrada com os critérios de busca."
                            : "Nenhuma empresa cadastrada."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCompanies.map((company: Company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCompanies.includes(company.id)}
                            onCheckedChange={(checked) =>
                              handleSelectCompany(
                                company.id,
                                checked as boolean
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => handleCompanyClick(company)}
                            className="text-blue-600 max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap hover:text-blue-800 hover:underline transition-colors"
                          >
                            {company.nomeFantasia}
                          </button>
                        </TableCell>
                        <TableCell>{company.razaoSocial}</TableCell>
                        <TableCell>{company.cnpj || "-"}</TableCell>
                        <TableCell>
                          {company.phone ? (
                            <div className="flex items-center gap-2">
                              <span>{company.phone}</span>
                              <a
                                href={`https://wa.me/${company.phone.replace(
                                  /\D/g,
                                  ""
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700 transition-colors"
                                title="Abrir no WhatsApp"
                              >
                                <FaWhatsapp className="h-4 w-4" />
                              </a>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{company.email || "-"}</TableCell>
                        <TableCell>
                          {getResponsavelName(company.responsavelId)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={company.active ? "default" : "secondary"}
                          >
                            {company.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(company)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Deseja excluir esta empresa?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir esta empresa?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(company.id)}
                                  >
                                    Confirmar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center flex-wrap gap-2 justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {companies.length} de {totalItems} empresas.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <CompanyFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        company={editingCompany}
      />

      <CompanyDetailsModal
        company={selectedCompany}
        isOpen={isDetailsModalOpen}
        onClose={handleDetailsModalClose}
        onEdit={handleEditFromDetails}
      />

      <CompanyImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
      />

      <BulkDealCreationModal
        open={isBulkDealModalOpen}
        onOpenChange={setIsBulkDealModalOpen}
        companies={companies.filter(company => selectedCompanies.includes(company.id))}
      />
    </div>
  );
}
