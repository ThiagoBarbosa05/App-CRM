
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

interface ClientWithProduct {
  clientId: string;
  clientName: string;
  clientRazaoSocial: string;
  clientCnpj: string;
  clientPhone: string;
  clientEmail: string;
  clientCity: string;
  clientState: string;
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
  const { data: clientsWithProduct = [], isLoading } = useQuery({
    queryKey: [`/api/products/${productId}/clients`],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/clients`);
      if (!response.ok) throw new Error("Failed to fetch clients with product");
      return response.json();
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
            Clientes com o produto: {productName}
          </DialogTitle>
          <DialogDescription>
            Lista de clientes que possuem este produto em sua carta de vinhos
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine-600"></div>
          </div>
        ) : clientsWithProduct.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Nenhum cliente possui este produto em sua carta de vinhos
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <strong>{clientsWithProduct.length}</strong> cliente(s) encontrado(s)
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clientsWithProduct.map((client: ClientWithProduct) => (
                <Card key={client.clientId} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-wine-700 line-clamp-2">
                          {client.clientName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {client.clientRazaoSocial}
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {client.clientCnpj && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{client.clientCnpj}</span>
                        </div>
                      )}
                      
                      {client.clientPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{client.clientPhone}</span>
                        </div>
                      )}
                      
                      {client.clientEmail && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="truncate">{client.clientEmail}</span>
                        </div>
                      )}
                      
                      {(client.clientCity || client.clientState) && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>
                            {[client.clientCity, client.clientState]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                      
                      {client.responsibleName && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{client.responsibleName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {client.sectorName && (
                        <Badge variant="secondary" className="text-xs">
                          {client.sectorName}
                        </Badge>
                      )}
                      
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          client.customPrice ? 'border-green-500 text-green-700' : 'border-blue-500 text-blue-700'
                        }`}
                      >
                        {formatCurrency(client.customPrice)}
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-500 border-t pt-2">
                      Adicionado em: {formatDate(client.addedAt)}
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
