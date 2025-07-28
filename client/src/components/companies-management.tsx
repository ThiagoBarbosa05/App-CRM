
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Plus, Search, Edit, Trash2, Building2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import CompanyFormModal from "./company-form-modal";
import type { Company } from "@shared/schema";

async function fetchCompanies(): Promise<Company[]> {
  const response = await fetch("/api/companies");
  if (!response.ok) {
    throw new Error("Erro ao buscar empresas");
  }
  return response.json();
}

async function deleteCompany(id: string): Promise<void> {
  const response = await fetch(`/api/companies/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Erro ao excluir empresa");
  }
}

export default function CompaniesManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir empresa",
        variant: "destructive",
      });
    },
  });

  const filteredCompanies = companies.filter((company) =>
    company.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj.includes(searchTerm) ||
    company.areaAtuacao.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompany(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Building2 className="h-6 w-6 text-wine-600" />
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-wine-600 hover:bg-wine-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Empresas</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar empresas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="text-gray-500">Carregando empresas...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Área de Atuação</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        {company.razaoSocial}
                      </TableCell>
                      <TableCell>{company.nomeFantasia || "-"}</TableCell>
                      <TableCell>{company.cnpj}</TableCell>
                      <TableCell>{company.areaAtuacao}</TableCell>
                      <TableCell>{company.telefone || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={company.isActive === "true" ? "default" : "secondary"}
                        >
                          {company.isActive === "true" ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(company)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(company.id)}
                            className="text-red-600 hover:text-red-700"
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
      </Card>

      <CompanyFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        company={editingCompany}
      />
    </div>
  );
}
