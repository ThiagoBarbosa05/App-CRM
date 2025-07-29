import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  FileText,
  Calendar,
  Edit,
  Tag
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Company, Sector } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface CompanyDetailsModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (company: Company) => void;
}

export default function CompanyDetailsModal({
  company,
  isOpen,
  onClose,
  onEdit,
}: CompanyDetailsModalProps) {
  // Buscar setor da empresa se ela tiver um
  const { data: sector } = useQuery<Sector>({
    queryKey: ["/api/sectors", company?.sectorId],
    queryFn: async () => {
      if (!company?.sectorId) return null;
      const response = await fetch(`/api/sectors/${company.sectorId}`);
      if (!response.ok) throw new Error("Failed to fetch sector");
      return response.json();
    },
    enabled: isOpen && !!company?.sectorId,
  });

  if (!company) return null;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">
                {company.nomeFantasia}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {company.razaoSocial}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={company.active ? "default" : "secondary"}>
                {company.active ? "Ativa" : "Inativa"}
              </Badge>
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(company)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                Informações da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.cnpj && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CNPJ</p>
                    <p className="font-mono">{company.cnpj}</p>
                  </div>
                )}
                
                {company.inscricaoEstadual && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Inscrição Estadual</p>
                    <p className="font-mono">{company.inscricaoEstadual}</p>
                  </div>
                )}

                {company.nomeComprador && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome do Comprador</p>
                    <p>{company.nomeComprador}</p>
                  </div>
                )}

                {sector && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Setor</p>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" style={{ color: sector.color }} />
                      <span>{sector.name}</span>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cadastrada em</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(company.createdAt)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contato */}
          {(company.email || company.phone || company.website) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="h-5 w-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {company.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <a 
                          href={`mailto:${company.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {company.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {company.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                        <div className="flex items-center gap-2">
                          <a 
                            href={`tel:${company.phone}`}
                            className="text-blue-600 hover:underline"
                          >
                            {company.phone}
                          </a>
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
                      </div>
                    </div>
                  )}

                  {company.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Website</p>
                        <a 
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {company.website}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Endereço */}
          {(company.address || company.city || company.state || company.cep) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {company.address && (
                    <p>{company.address}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {company.city && <span>{company.city}</span>}
                    {company.city && company.state && <span>-</span>}
                    {company.state && <span>{company.state}</span>}
                    {company.cep && (
                      <>
                        <span>•</span>
                        <span>CEP: {company.cep}</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {company.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{company.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}