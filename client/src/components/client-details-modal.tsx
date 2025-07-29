import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Tag, 
  FileText, 
  UserCheck,
  Building,
  CreditCard
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Client } from "@shared/schema";

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientDetailsModal({ client, isOpen, onClose }: ClientDetailsModalProps) {
  if (!client) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatBirthday = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "Não informado";
    }
  };

  const formatPhone = (phone: string) => {
    // Remove caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 11) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
    } else if (cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
    }
    
    return phone;
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "Não informado";
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (cleanCPF.length === 11) {
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(9)}`;
    }
    
    return cpf;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-wine-600" />
            {client.name}
          </DialogTitle>
          <DialogDescription>
            Informações detalhadas do cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Telefone</p>
                    <div className="flex items-center gap-2">
                      <a 
                        href={`tel:${client.phone}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title="Clique para ligar"
                      >
                        {formatPhone(client.phone)}
                      </a>
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
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

                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">E-mail</p>
                      <p className="font-medium">{client.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">CPF</p>
                    <p className="font-medium">{formatCPF(client.cpf || "")}</p>
                  </div>
                </div>

                {client.birthday && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Aniversário</p>
                      <p className="font-medium">{formatBirthday(client.birthday)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          {(client.address || client.cep) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {client.address && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">Endereço:</span>
                      <span className="font-medium">
                        {client.address}
                        {client.number && `, ${client.number}`}
                      </span>
                    </p>
                  )}
                  
                  {client.neighborhood && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">Bairro:</span>
                      <span className="font-medium">{client.neighborhood}</span>
                    </p>
                  )}
                  
                  {client.city && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">Cidade:</span>
                      <span className="font-medium">
                        {client.city}{client.state && `, ${client.state}`}
                      </span>
                    </p>
                  )}
                  
                  {client.cep && (
                    <p className="flex items-start gap-2">
                      <span className="text-sm text-gray-600 min-w-[80px]">CEP:</span>
                      <span className="font-medium">{client.cep}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informações Comerciais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-4 w-4" />
                Informações Comerciais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {client.categoria && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Categoria</p>
                    <Badge variant="secondary" className="capitalize">
                      {client.categoria}
                    </Badge>
                  </div>
                )}

                {client.origem && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Origem</p>
                    <Badge variant="outline" className="capitalize">
                      {client.origem}
                    </Badge>
                  </div>
                )}

                {client.responsible && (
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Responsável</p>
                      <p className="font-medium">{client.responsible}</p>
                    </div>
                  </div>
                )}
              </div>

              {client.markers && client.markers.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Marcadores
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {client.markers.map((marker, index) => (
                      <Badge key={index} variant="default" className="text-xs">
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
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Informações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <span className="text-gray-600 min-w-[120px]">Data de cadastro:</span>
                  <span className="font-medium">{formatDate(String(client.createdAt))}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-600 min-w-[120px]">ID do cliente:</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {client.id}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}