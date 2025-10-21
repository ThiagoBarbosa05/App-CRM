import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Tag,
  Wine,
  MessageSquare,
  Target,
  HelpCircle,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Company, Sector } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import CompanyWineListModal from "./company-wine-list-modal";
import CompanyInteractionsTab from "./company-interactions-tab";
import CompanyFunnelsTab from "./company-funnels-tab";
import CompanyAnsweredQuestionsTab from "./company-answered-questions-tab";

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
  const [isWineListOpen, setIsWineListOpen] = useState(false);

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

  // Buscar carta de vinhos da empresa para mostrar resumo
  const { data: companyProducts = [] } = useQuery({
    queryKey: ["/api/companies", company?.id, "products"],
    queryFn: async () => {
      if (!company?.id) return [];
      const response = await fetch(`/api/companies/${company.id}/products`);
      if (!response.ok) throw new Error("Failed to fetch company products");
      return response.json();
    },
    enabled: isOpen && !!company?.id,
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-100 bg-gray-50 -m-6 mb-6 p-6">
          <div className="flex items-center flex-col sm:flex-row gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  {company.nomeFantasia}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-1">
                  {company.razaoSocial}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={company.active ? "default" : "secondary"}
                className={
                  company.active
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }
              >
                {company.active ? "Ativa" : "Inativa"}
              </Badge>
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(company)}
                  className="border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 mr-2">
                    <Edit className="h-3 w-3 text-gray-600" />
                  </div>
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 bg-gray-50 p-1 rounded-lg gap-1 sm:gap-0">
            <TabsTrigger
              value="info"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
            >
              <Building2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden lg:inline">
                Informações
              </span>
              <span className="xs:hidden sm:inline lg:hidden">Info</span>
            </TabsTrigger>
            <TabsTrigger
              value="carta"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
            >
              <Wine className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden lg:inline">
                Carta de Vinhos
              </span>
              <span className="xs:hidden sm:inline lg:hidden">Carta</span>
            </TabsTrigger>
            <TabsTrigger
              value="questions"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
            >
              <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden lg:inline">
                Perguntas
              </span>
              <span className="xs:hidden sm:inline lg:hidden">Q&A</span>
            </TabsTrigger>
            <TabsTrigger
              value="interactions"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
            >
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Interações</span>
            </TabsTrigger>
            <TabsTrigger
              value="funnels"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
            >
              <Target className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:hidden lg:inline">
                Funis
              </span>
              <span className="xs:hidden sm:inline lg:hidden">Meta</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6 mt-6">
            <div className="space-y-6">
              {/* Informações básicas */}
              <Card>
                <CardHeader className="border-b border-gray-100 bg-gray-50">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-gray-900">
                      Informações da Empresa
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {company.cnpj && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          CNPJ
                        </p>
                        <p className="font-mono">{company.cnpj}</p>
                      </div>
                    )}

                    {company.inscricaoEstadual && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Inscrição Estadual
                        </p>
                        <p className="font-mono">{company.inscricaoEstadual}</p>
                      </div>
                    )}

                    {company.nomeComprador && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Nome do Comprador
                        </p>
                        <p>{company.nomeComprador}</p>
                      </div>
                    )}

                    {sector && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Setor
                        </p>
                        <div className="flex items-center gap-2">
                          <Tag
                            className="h-4 w-4"
                            style={{ color: sector.color }}
                          />
                          <span>{sector.name}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Cadastrada em
                      </p>
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
                  <CardHeader className="border-b border-gray-100 bg-gray-50">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100">
                        <Phone className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="font-semibold text-gray-900">
                        Contato
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 mt-2">
                    <div className="grid grid-cols-1 gap-4">
                      {company.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Email
                            </p>
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
                            <p className="text-sm font-medium text-muted-foreground">
                              Celular
                            </p>
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${company.phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {company.phone}
                              </a>
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
                          </div>
                        </div>
                      )}

                      {company.website && (
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Website
                            </p>
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
              {(company.address ||
                company.city ||
                company.state ||
                company.cep) && (
                <Card>
                  <CardHeader className="border-b border-gray-100 bg-gray-50">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
                        <MapPin className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="font-semibold text-gray-900">
                        Endereço
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {company.address && <p>{company.address}</p>}
                      {company.neighborhood && (
                        <p className="text-sm text-muted-foreground">
                          Bairro: {company.neighborhood}
                        </p>
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
                  <CardHeader className="border-b border-gray-100 bg-gray-50">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-100">
                        <FileText className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="font-semibold text-gray-900">
                        Observações
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{company.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="carta" className="space-y-6 mt-6">
            {/* Carta de Vinhos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wine className="h-5 w-5 text-wine-600" />
                  Carta de Vinhos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!companyProducts || companyProducts.length === 0 ? (
                  <div className="text-center py-4">
                    <Wine className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">
                      Nenhum vinho na carta ainda
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsWineListOpen(true)}
                      className="mt-2 text-wine-600 border-wine-600 hover:bg-wine-50"
                    >
                      Adicionar vinhos
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {companyProducts.length} vinho(s) na carta
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsWineListOpen(true)}
                        className="text-wine-600 border-wine-600 hover:bg-wine-50"
                      >
                        Ver carta completa
                      </Button>
                    </div>

                    {/* Mostrar até 3 produtos como preview */}
                    <div className="space-y-2">
                      {companyProducts.slice(0, 3).map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {item.product?.name || "Nome não disponível"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.product?.country || "País não informado"} -{" "}
                              {item.product?.volume || "Volume não informado"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">
                                Tabela: R${" "}
                                {parseFloat(
                                  item.product?.tablePrice || "0"
                                ).toFixed(2)}
                              </span>
                              <span className="text-xs text-blue-600">
                                Padrão: R${" "}
                                {parseFloat(
                                  item.product?.negotiatedPrice || "0"
                                ).toFixed(2)}
                              </span>
                              <span className="text-xs text-green-600 font-semibold">
                                Cliente: R${" "}
                                {parseFloat(
                                  item.customNegotiatedPrice ||
                                    item.product?.negotiatedPrice ||
                                    "0"
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs ml-2">
                            {item.product?.type || "Tipo não informado"}
                          </Badge>
                        </div>
                      ))}

                      {companyProducts.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          e mais {companyProducts.length - 3} vinho(s)...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="mt-6">
            <CompanyAnsweredQuestionsTab company={company} />
          </TabsContent>

          <TabsContent value="interactions" className="mt-6">
            <CompanyInteractionsTab company={company} />
          </TabsContent>

          <TabsContent value="funnels" className="mt-6">
            <CompanyFunnelsTab company={company} />
          </TabsContent>
        </Tabs>

        {/* Wine List Modal */}
        <CompanyWineListModal
          company={company}
          isOpen={isWineListOpen}
          onClose={() => setIsWineListOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
