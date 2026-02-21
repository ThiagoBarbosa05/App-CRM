import { useState, useEffect } from "react";
import {
  Plus,
  Building2,
  ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CompanyFormModal from "./company-form-modal";
import CompanyDetailsModal from "./company-details-modal";
import CompanyImportModal from "./company-import-modal";
import BulkDealCreationModal from "./bulk-deal-creation-modal";
import { Company } from "@shared/schema";
import { exportCompaniesToExcel } from "@/lib/excel-export";

// Extracted Components
import { CompaniesHeader } from "./companies/companies-header";
import { CompaniesFilters } from "./companies/companies-filters";
import { CompaniesTable } from "./companies/companies-table";

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

    const aValue = (a[sortField as keyof Company] as string | undefined | null)?.toLowerCase() || "";
    const bValue = (b[sortField as keyof Company] as string | undefined | null)?.toLowerCase() || "";

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
      setSelectedCompanies((prev: string[]) => [...prev, companyId]);
    } else {
      setSelectedCompanies((prev: string[]) => prev.filter((id: string) => id !== companyId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanies(
        sortedCompanies.map((company: Company) => company.id),
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
    <div className="space-y-6">
      <CompaniesHeader
        onImportClick={() => setIsImportModalOpen(true)}
        onExportClick={handleExport}
        onNewCompanyClick={() => setIsModalOpen(true)}
        onBulkEditClick={() => {
          toast({
            title: "Funcionalidade em desenvolvimento",
            description: "A edição em lote será implementada em breve.",
          });
        }}
        onBulkDealClick={() => setIsBulkDealModalOpen(true)}
        onBulkDeleteClick={handleBulkDelete}
        isExportPending={exportMutation.isPending}
        isBulkDeletePending={bulkDeleteMutation.isPending}
        selectedCount={selectedCompanies.length}
      />

      <CompaniesFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        nomeFantasiaFilter={nomeFantasiaFilter}
        setNomeFantasiaFilter={setNomeFantasiaFilter}
        razaoSocialFilter={razaoSocialFilter}
        setRazaoSocialFilter={setRazaoSocialFilter}
        cnpjFilter={cnpjFilter}
        setCnpjFilter={setCnpjFilter}
        responsavelFilter={responsavelFilter}
        setResponsavelFilter={setResponsavelFilter}
        markerFilter={markerFilter}
        setMarkerFilter={setMarkerFilter}
        users={users as any[]}
        markers={markers as any[]}
        onClearFilters={() => {
          setSearchQuery("");
          setNomeFantasiaFilter("");
          setRazaoSocialFilter("");
          setCnpjFilter("");
          setResponsavelFilter("");
          setMarkerFilter("");
        }}
      />

      <CompaniesTable
        companies={sortedCompanies}
        isLoading={isLoading}
        isFetching={isFetching}
        selectedCompanies={selectedCompanies}
        onSelectCompany={handleSelectCompany}
        onSelectAll={handleSelectAll}
        onSort={handleSort}
        sortField={sortField}
        sortDirection={sortDirection}
        getResponsavelName={getResponsavelName}
        onCompanyClick={handleCompanyClick}
        onEdit={handleEdit}
        onDelete={handleDelete}
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        setPage={setPage}
      />

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
          selectedCompanies.includes(company.id),
        )}
      />
    </div>
  );
}
