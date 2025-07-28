import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Gift, Phone, Mail, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client } from "@shared/schema";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Filtrar clientes que têm aniversário
  const clientsWithBirthdays = clients.filter(client => client.birthday);

  // Função para obter a data do aniversário deste ano
  const getBirthdayThisYear = (birthday: string) => {
    const birthdayDate = parseISO(birthday);
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, birthdayDate.getMonth(), birthdayDate.getDate());
  };

  // Função para verificar se uma data tem aniversários
  const getClientsForDate = (date: Date) => {
    return clientsWithBirthdays.filter(client => {
      if (!client.birthday) return false;
      const birthdayThisYear = getBirthdayThisYear(client.birthday);
      return isSameDay(birthdayThisYear, date);
    });
  };

  // Função para destacar datas com aniversários no calendário
  const dayModifiers = {
    birthday: (date: Date) => getClientsForDate(date).length > 0
  };

  const dayModifiersClassNames = {
    birthday: "bg-wine-100 text-wine-800 font-semibold relative after:content-['🎂'] after:absolute after:bottom-0 after:right-0 after:text-xs"
  };

  const selectedDateClients = getClientsForDate(selectedDate);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gray-200 rounded"></div>
            <div className="h-80 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Calendário de Aniversários</h2>
            <p className="text-gray-600 mt-1">Visualize e acompanhe os aniversários dos seus clientes</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-wine-600" />
              Calendário
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={ptBR}
              modifiers={dayModifiers}
              modifiersClassNames={dayModifiersClassNames}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Detalhes da data selecionada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-600" />
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateClients.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">
                  Nenhum aniversário nesta data
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="default" className="bg-amber-100 text-amber-800">
                    {selectedDateClients.length} aniversariante{selectedDateClients.length > 1 ? 's' : ''}
                  </Badge>
                </div>

                {selectedDateClients.map((client) => {
                  const birthdayDate = parseISO(client.birthday!);
                  const age = new Date().getFullYear() - birthdayDate.getFullYear();

                  return (
                    <div
                      key={client.id}
                      className="p-4 bg-gradient-to-r from-amber-50 to-wine-50 rounded-lg border border-amber-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {client.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Completando {age} anos 🎉
                          </p>

                          <div className="space-y-2">
                            {client.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-gray-500" />
                                <a 
                                  href={`tel:${client.phone}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                  title="Clique para ligar"
                                >
                                  {client.phone}
                                </a>
                              </div>
                            )}

                            {client.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <a 
                                  href={`mailto:${client.email}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                  title="Clique para enviar email"
                                >
                                  {client.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                            <Gift className="h-6 w-6 text-amber-600" />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {format(birthdayDate, "dd/MM", { locale: ptBR })}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {client.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => window.open(`tel:${client.phone}`, '_self')}
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Ligar
                          </Button>
                        )}

                        {client.email && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => window.open(`mailto:${client.email}`, '_blank')}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            const message = `Parabéns, ${client.name}! Feliz aniversário! 🎉🎂`;
                            window.open(`https://wa.me/${client.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                        >
                          <Gift className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas dos próximos aniversários */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-wine-600" />
            Próximos Aniversários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Hoje', 'Amanhã', 'Esta semana', 'Este mês'].map((period, index) => {
              const today = new Date();
              let count = 0;
              let startDate = new Date(today);
              let endDate = new Date(today);

              switch (index) {
                case 0: // Hoje
                  count = getClientsForDate(today).length;
                  break;
                case 1: // Amanhã
                  const tomorrow = new Date(today);
                  tomorrow.setDate(today.getDate() + 1);
                  count = getClientsForDate(tomorrow).length;
                  break;
                case 2: // Esta semana
                  endDate.setDate(today.getDate() + 7);
                  count = clientsWithBirthdays.filter(client => {
                    const birthdayThisYear = getBirthdayThisYear(client.birthday!);
                    return birthdayThisYear >= startDate && birthdayThisYear <= endDate;
                  }).length;
                  break;
                case 3: // Este mês
                  endDate.setDate(today.getDate() + 30);
                  count = clientsWithBirthdays.filter(client => {
                    const birthdayThisYear = getBirthdayThisYear(client.birthday!);
                    return birthdayThisYear >= startDate && birthdayThisYear <= endDate;
                  }).length;
                  break;
              }

              return (
                <div key={period} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-wine-600">{count}</div>
                  <div className="text-sm text-gray-600">{period}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}