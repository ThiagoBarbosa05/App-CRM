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
  Building2,
  FileText,
  CreditCard,
  Phone,
  Mail,
  User,
  Settings,
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
  const [markerFilter, setMarkerFilter] = useState("");
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
      debouncedSearchQuery,
      debouncedNomeFantasiaFilter,
      debouncedRazaoSocialFilter,
      debouncedCnpjFilter,
      responsavelFilter,
      markerFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (debouncedNomeFantasiaFilter)
        params.append("nomeFantasia", debouncedNomeFantasiaFilter);
      if (debouncedRazaoSocialFilter)
        params.append("razaoSocial", debouncedRazaoSocialFilter);
      if (debouncedCnpjFilter) params.append("cnpj", debouncedCnpjFilter);
      if (responsavelFilter) params.append("responsavelId", responsavelFilter);
      if (markerFilter) params.append("marker", markerFilter);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      const response = await fetch(`/api/companies?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: !!currentUser,
  });

  const companies = data?.data || [];
  const totalItems = data?.totalItems || companies.length;
  const totalPages = data?.totalPages || Math.ceil(totalItems / pageSize);

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const { data: markers = [] } = useQuery({
    queryKey: ["/api/tags/markers"],
    queryFn: async () => {
      const response = await fetch("/api/tags/markers");
      if (!response.ok) throw new Error("Failed to fetch markers");
      const allMarkers = await response.json();
      return allMarkers.filter((marker: any) => marker.type === "marcador");
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
          <div className="flex items-center gap-4">
            <Building2 className="size-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Empresas</h2>
              <p className="text-gray-600 mt-1">
                Gerencie as empresas cadastradas no sistema
              </p>
            </div>
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
                      description:
                        "A edição em lote será implementada em breve.",
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
              data-testid="input-filter-nomefantasia"
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
              data-testid="input-filter-razaosocial"
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
              data-testid="input-filter-cnpj"
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
              data-testid="select-filter-responsavel"
            >
              <option value="">Todos os responsáveis</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Marcador
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-gray-400 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={markerFilter}
              onChange={(e) => setMarkerFilter(e.target.value)}
              data-testid="select-filter-marker"
            >
              <option value="">Todos os marcadores</option>
              {markers.map((marker: any) => (
                <option key={marker.id} value={marker.name}>
                  {marker.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(nomeFantasiaFilter ||
          razaoSocialFilter ||
          cnpjFilter ||
          responsavelFilter ||
          markerFilter ||
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
                setMarkerFilter("");
              }}
              data-testid="button-clear-filters"
            >
              Limpar Filtros
            </Button>
          </div>
        )}

        <div className="mt-10 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {isLoading || isFetching ? (
            <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-gray-50 to-blue-50">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600 font-medium">
                Carregando empresas...
              </p>
              <p className="text-gray-500 text-sm mt-1">Aguarde um momento</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-blue-100 hover:bg-gradient-to-r hover:from-gray-100 hover:to-blue-100">
                      <TableHead className="w-12 py-4 px-6">
                        <Checkbox
                          checked={
                            selectedCompanies.length ===
                              sortedCompanies.length &&
                            sortedCompanies.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                          className="border-2 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </TableHead>
                      <TableHead className="py-4 px-6">
                        <button
                          onClick={() => handleSort("nomeFantasia")}
                          className="flex items-center gap-2 font-semibold text-gray-700 hover:text-blue-600 transition-all duration-200 group"
                        >
                          <Building2 className="h-4 w-4 text-blue-500 group-hover:text-blue-600" />
                          Nome Fantasia
                          {sortField === "nomeFantasia" &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ))}
                        </button>
                      </TableHead>
                      <TableHead className="py-4 px-6">
                        <button
                          onClick={() => handleSort("razaoSocial")}
                          className="flex items-center gap-2 font-semibold text-gray-700 hover:text-blue-600 transition-all duration-200 group"
                        >
                          <FileText className="h-4 w-4 text-purple-500 group-hover:text-purple-600" />
                          Razão Social
                          {sortField === "razaoSocial" &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ))}
                        </button>
                      </TableHead>
                      <TableHead className="py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-green-500" />
                          CNPJ
                        </div>
                      </TableHead>
                      <TableHead className="py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-orange-500" />
                          Celular
                        </div>
                      </TableHead>
                      <TableHead className="py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-indigo-500" />
                          Email
                        </div>
                      </TableHead>
                      <TableHead className="py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-cyan-500" />
                          Responsável
                        </div>
                      </TableHead>
                      <TableHead className="py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          <Badge className="h-4 w-4 text-emerald-500" />
                          Status
                        </div>
                      </TableHead>
                      <TableHead className="py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center gap-2">
                          <Badge className="h-4 w-4 text-purple-500" />
                          Marcadores
                        </div>
                      </TableHead>
                      <TableHead className="text-right py-4 px-6 font-semibold text-gray-700">
                        <div className="flex items-center justify-end gap-2">
                          <Settings className="h-4 w-4 text-gray-500" />
                          Ações
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCompanies.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={10} className="text-center py-16">
                          <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-gray-100 rounded-full">
                              <Building2 className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-gray-900 font-medium text-lg mb-2">
                                {searchQuery
                                  ? "Nenhuma empresa encontrada"
                                  : "Nenhuma empresa cadastrada"}
                              </p>
                              <p className="text-gray-500">
                                {searchQuery
                                  ? "Tente ajustar os filtros de busca para encontrar o que procura."
                                  : "Comece criando sua primeira empresa no sistema."}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedCompanies.map((company: Company, index: number) => (
                        <TableRow
                          key={company.id}
                          className={`transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-b border-gray-100 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          } ${
                            selectedCompanies.includes(company.id)
                              ? "bg-blue-50 border-blue-200"
                              : ""
                          }`}
                        >
                          <TableCell className="py-4 px-6">
                            <Checkbox
                              checked={selectedCompanies.includes(company.id)}
                              onCheckedChange={(checked) =>
                                handleSelectCompany(
                                  company.id,
                                  checked as boolean
                                )
                              }
                              className="border-2 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <button
                              onClick={() => handleCompanyClick(company)}
                              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all duration-200 text-left max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap block"
                            >
                              {company.nomeFantasia}
                            </button>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-gray-700 font-medium">
                            {company.razaoSocial}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {company.cnpj ? (
                              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                                {company.cnpj}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {company.phone ? (
                              <div className="flex items-center gap-3">
                                <span className="text-gray-700">
                                  {company.phone}
                                </span>
                                <a
                                  href={`https://wa.me/${company.phone.replace(
                                    /\D/g,
                                    ""
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg text-green-600 hover:text-green-700 transition-all duration-200 hover:scale-110"
                                  title="Abrir no WhatsApp"
                                >
                                  <FaWhatsapp className="h-4 w-4" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 px-6 text-gray-700">
                            {company.email ? (
                              <a
                                href={`mailto:${company.email}`}
                                className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
                              >
                                {company.email}
                              </a>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-cyan-100 rounded-lg">
                                <User className="h-3 w-3 text-cyan-600" />
                              </div>
                              <span className="text-gray-700 font-medium">
                                {getResponsavelName(company.responsavelId)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge
                              className={`px-3 py-1 font-semibold ${
                                company.active
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : "bg-red-100 text-red-800 border-red-200"
                              }`}
                              variant="outline"
                            >
                              {company.active ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {company.markers && company.markers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {company.markers.map((marker, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="bg-purple-100 text-purple-800 hover:bg-purple-200 text-xs"
                                    data-testid={`badge-marker-${company.id}-${idx}`}
                                  >
                                    {marker}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-4 px-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(company)}
                                className="p-2 hover:bg-blue-100 hover:text-blue-700 transition-all duration-200 rounded-lg"
                                title="Editar empresa"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-2 hover:bg-red-100 hover:text-red-700 transition-all duration-200 rounded-lg"
                                    title="Excluir empresa"
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
                                      Tem certeza que deseja excluir esta
                                      empresa? Esta ação não pode ser desfeita.
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
              </div>
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        Mostrando {companies.length} de {totalItems} empresas
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedCompanies.length > 0 &&
                          `${selectedCompanies.length} selecionada(s)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 shadow-sm p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-2 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
                        <span className="hidden sm:inline ml-1">Anterior</span>
                      </Button>

                      <div className="px-4 py-2 bg-blue-50 rounded text-sm font-semibold text-blue-700 border border-blue-200">
                        {page} de {totalPages}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                        className="px-3 py-2 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <span className="hidden sm:inline mr-1">Próxima</span>
                        <ChevronUp className="h-4 w-4 rotate-90" />
                      </Button>
                    </div>
                  </div>
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
        companies={companies.filter((company: Company) =>
          selectedCompanies.includes(company.id)
        )}
      />
    </div>
  );
}
