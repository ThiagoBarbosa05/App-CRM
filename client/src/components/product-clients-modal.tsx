
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Phone, Mail, User } from "lucide-react";

interface ProductClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

interface CompanyWithProduct {
  companyId: string;
  companyName: string;
  companyRazaoSocial: string;
  companyCnpj: string;
  companyPhone: string;
  companyEmail: string;
  companyCity: string;
  companyState: string;
  responsibleName: string;
  customPrice: string;
  addedAt: string;
  sectorName: string;
}

export function ProductClientsModal({ 
  open, 
  onOpenChange, 
  productId, 
  productName 
}: ProductClientsModalProps) {
  const { data: companiesWithProduct = [], isLoading, error } = useQuery({
    queryKey: [`/api/products/${productId}/companies`],
    queryFn: async () => {
      console.log(`Fetching companies for product ${productId}`);
      const response = await fetch(`/api/products/${productId}/companies`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to fetch companies with product");
      }
      const data = await response.json();
      console.log("Companies data received:", data);
      return data;
    },
    enabled: open && !!productId,
  });

  const formatCurrency = (value: string) => {
    if (!value) return "Preço padrão";
    return `R$ ${parseFloat(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas com o produto: {productName}
          </DialogTitle>
          <DialogDescription>
            Lista de empresas que possuem este produto em sua carta de vinhos
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine-600"></div>
            <span className="ml-2 text-gray-600">Carregando clientes...</span>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Building2 className="h-12 w-12 text-red-400 mb-4" />
              <p className="text-red-500 text-center">
                Erro ao carregar clientes: {error.message}
              </p>
            </CardContent>
          </Card>
        ) : companiesWithProduct.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Nenhuma empresa possui este produto em sua carta de vinhos
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <strong>{companiesWithProduct.length}</strong> empresa(s) encontrada(s)
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companiesWithProduct.map((company: CompanyWithProduct) => (
                <Card key={company.companyId} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-wine-700 line-clamp-2">
                          {company.companyName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {company.companyRazaoSocial}
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {company.companyCnpj && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{company.companyCnpj}</span>
                        </div>
                      )}
                      
                      {company.companyPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{company.companyPhone}</span>
                        </div>
                      )}
                      
                      {company.companyEmail && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="truncate">{company.companyEmail}</span>
                        </div>
                      )}
                      
                      {(company.companyCity || company.companyState) && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>
                            {[company.companyCity, company.companyState]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                      
                      {company.responsibleName && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{company.responsibleName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {company.sectorName && (
                        <Badge variant="secondary" className="text-xs">
                          {company.sectorName}
                        </Badge>
                      )}
                      
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          company.customPrice ? 'border-green-500 text-green-700' : 'border-blue-500 text-blue-700'
                        }`}
                      >
                        {formatCurrency(company.customPrice)}
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-500 border-t pt-2">
                      Adicionado em: {formatDate(company.addedAt)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
