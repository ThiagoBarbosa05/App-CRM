import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Client } from "@shared/schema";
import { User, Phone, Mail, MapPin, Calendar, Tag, Edit, MessageSquare, History } from "lucide-react";
import { formatDate } from "@/lib/utils";
import ClientInteractionsTab from "./client-interactions-tab";

interface ClientDetailsCardProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (client: Client) => void;
}

export default function ClientDetailsCard({ client, open, onOpenChange, onEdit }: ClientDetailsCardProps) {
  if (!client) return null;

  const formatPhone = (phone: string) => {
    // Remove caracteres não numéricos
    const numbers = phone.replace(/\D/g, '');
    // Aplica máscara (11) 99999-9999
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatCPF = (cpf: string | null | undefined) => {
    if (!cpf) return "Não informado";
    // Remove caracteres não numéricos
    const numbers = cpf.replace(/\D/g, '');
    // Aplica máscara 999.999.999-99
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatAddress = () => {
    return `${client.address}, ${client.number} - ${client.neighborhood}, ${client.city}/${client.state} - CEP: ${client.cep}`;
  };

  const formatBirthday = (birthday: string | null | undefined) => {
    if (!birthday) return "Não informado";
    try {
      // Assumindo formato YYYY-MM-DD
      const [year, month, day] = birthday.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return birthday;
    }
  };

  const getMarkerColors = (markers: string[]) => {
    const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800'];
    return markers.map((_, index) => colors[index % colors.length]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-wine-600" />
              {client.name}
            </div>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(client)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="interactions" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6 overflow-y-auto max-h-[65vh]">
            <div className="space-y-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Pessoais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-gray-600">CPF: {formatCPF(client.cpf)}</p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Telefone:</strong> 
                        <a 
                          href={`tel:${client.phone}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer ml-1"
                          title="Clique para ligar"
                        >
                          {formatPhone(client.phone)}
                        </a>
                      </span>
                    </div>

                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          <strong>E-mail:</strong> {client.email}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Aniversário:</strong> {formatBirthday(client.birthday)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">
                        <strong>Responsável:</strong> {client.responsible}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{formatAddress()}</p>
                </CardContent>
              </Card>

              {/* Classificação e Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Classificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Categoria:</p>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {client.categoria}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Origem:</p>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {client.origem}
                      </Badge>
                    </div>
                  </div>

                  {client.markers && client.markers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Marcadores:</p>
                      <div className="flex flex-wrap gap-2">
                        {client.markers.map((marker, index) => (
                          <Badge 
                            key={marker} 
                            variant="secondary" 
                            className={getMarkerColors(client.markers)[index]}
                          >
                            {marker}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Informações do Sistema */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    <p><strong>Cliente desde:</strong> {formatDate(client.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="interactions" className="mt-6 h-[65vh] overflow-hidden">
            <ClientInteractionsTab client={client} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}