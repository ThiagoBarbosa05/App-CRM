import { User, Phone, Mail, CreditCard, Calendar, MapPin, Building, Tag, FileText, Edit, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type Client } from "@shared/schema";

interface ClientInfoTabProps {
  client: Client;
  onEdit?: (client: Client) => void;
  onClose: () => void;
}

export function ClientInfoTab({ client, onEdit, onClose }: ClientInfoTabProps) {
  const formatDate = (dateString: string) => {
    try {
      const date =
        typeof dateString === "string"
          ? parseISO(dateString)
          : new Date(dateString);
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
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 11) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(
        2,
        7,
      )}-${cleanPhone.slice(7)}`;
    } else if (cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(
        2,
        6,
      )}-${cleanPhone.slice(6)}`;
    }
    return phone;
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "Não informado";
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length === 11) {
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(
        6,
        9,
      )}-${cleanCPF.slice(9)}`;
    }
    return cpf;
  };

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="flex items-center text-slate-800 dark:text-slate-200 gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              Informações Pessoais
            </div>
            <Button
              onClick={() => {
                if (onEdit) {
                  onEdit(client);
                  onClose();
                }
              }}
              className="flex items-center gap-2 mt-4 sm:mt-0 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-sm transition-all focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              size="sm"
            >
              <Edit className="h-4 w-4" />
              <span>Editar</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                <Phone className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Telefone
                </p>
                <a
                  href={`tel:${client.phone}`}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                  title="Clique para ligar"
                >
                  {formatPhone(client.phone)}
                </a>
              </div>
            </div>

            {client.email && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <Mail className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    E-mail
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-slate-200">
                    {client.email}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                <CreditCard className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  CPF
                </p>
                <p className="font-semibold text-slate-900 dark:text-slate-200">
                  {formatCPF(client.cpf || "")}
                </p>
              </div>
            </div>

            {client.birthday && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Aniversário
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-slate-200">
                    {formatBirthday(client.birthday)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(client.address || client.cep) && (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg flex text-slate-800 dark:text-slate-200 items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {client.address && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium min-w-[80px] pt-0.5">
                    Endereço:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {client.address}
                    {client.number && `, ${client.number}`}
                  </span>
                </div>
              )}

              {client.neighborhood && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium min-w-[80px] pt-0.5">
                    Bairro:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {client.neighborhood}
                  </span>
                </div>
              )}

              {client.city && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium min-w-[80px] pt-0.5">
                    Cidade:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {client.city}
                    {client.state && ` - ${client.state}`}
                  </span>
                </div>
              )}

              {client.cep && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium min-w-[80px] pt-0.5">
                    CEP:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {client.cep}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const addressParts = [
                    client.address,
                    client.number && `${client.number}`,
                    client.neighborhood,
                    client.city,
                    client.state,
                    client.cep && `CEP: ${client.cep}`,
                  ].filter(Boolean);

                  const fullAddress = addressParts.join(", ");
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    fullAddress,
                  )}`;
                  window.open(mapsUrl, "_blank");
                }}
                className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <MapPin className="h-4 w-4 text-slate-500" />
                Ver no Mapa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-lg flex text-slate-800 dark:text-slate-200 items-center gap-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            Informações Comerciais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {client.categoria && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-2">
                  Categoria
                </p>
                <Badge variant="secondary" className="capitalize bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 border-none">
                  {client.categoria}
                </Badge>
              </div>
            )}

            {client.origem && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-2">
                  Origem
                </p>
                <Badge variant="outline" className="capitalize border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300">
                  {client.origem}
                </Badge>
              </div>
            )}
          </div>

          {client.markers && client.markers.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Marcadores
              </p>
              <div className="flex flex-wrap gap-2">
                {client.markers.map((marker, index) => (
                  <Badge
                    key={index}
                    variant="default"
                    className="text-xs bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 shadow-sm"
                  >
                    {marker}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-lg flex text-slate-800 dark:text-slate-200 items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 font-medium min-w-[120px]">
                Data de cadastro:
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {formatDate(String(client.createdAt))}
              </span>
            </p>
            <p className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 font-medium min-w-[120px]">
                ID do cliente:
              </span>
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md text-slate-700 dark:text-slate-300">
                {client.id}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
