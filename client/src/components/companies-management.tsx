import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit2, Trash2, Trash } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import CompanyFormModal from "./company-form-modal";
import CompanyDetailsModal from "./company-details-modal";
import { Company } from "@shared/schema";

interface CompaniesManagementProps {
  currentUser: any;
}

export function CompaniesManagement({ currentUser }: CompaniesManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

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

  const filteredCompanies = companies.filter((company: Company) =>
    company.nomeFantasia.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.razaoSocial.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (company.cnpj && company.cnpj.includes(searchQuery))
  );

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta empresa?")) {
      deleteMutation.mutate(id);
    }
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
      setSelectedCompanies(prev => [...prev, companyId]);
    } else {
      setSelectedCompanies(prev => prev.filter(id => id !== companyId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanies(filteredCompanies.map((company: Company) => company.id));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresas</CardTitle>
        <CardDescription>
          Gerencie as empresas cadastradas no sistema
        </CardDescription>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por Nome Fantasia, Razão Social ou CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {selectedCompanies.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash className="mr-2 h-4 w-4" />
                Excluir Selecionadas ({selectedCompanies.length})
              </Button>
            )}
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <p>Carregando empresas...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedCompanies.length === filteredCompanies.length && filteredCompanies.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "Nenhuma empresa encontrada com os critérios de busca."
                        : "Nenhuma empresa cadastrada."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company: Company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedCompanies.includes(company.id)}
                        onCheckedChange={(checked) => handleSelectCompany(company.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <button 
                        onClick={() => handleCompanyClick(company)}
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
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
                            href={`https://wa.me/${company.phone.replace(/\D/g, '')}`}
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
                      <Badge variant={company.active ? "default" : "secondary"}>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(company.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

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
    </Card>
  );
}