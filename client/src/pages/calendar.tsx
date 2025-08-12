import { useState, useMemo, useTransition } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  Gift,
  Phone,
  Mail,
  Bell,
  MessageSquare,
  User,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [reminderDays, setReminderDays] = useState("1");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderType, setReminderType] = useState("email");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ["/api/upcoming-birthdays", "all"],
    queryFn: async () => {
      const response = await fetch(`/api/upcoming-birthdays`);
      if (!response.ok) throw new Error("Failed to fetch all birthdays");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: ["/api/upcoming-birthdays", 30],
    queryFn: async () => {
      const response = await fetch("/api/upcoming-birthdays?days=30");
      if (!response.ok) throw new Error("Failed to fetch upcoming birthdays");
      return response.json();
    },
  });

  // Query para buscar usuários (para mostrar o responsável)
  const { data: users = [] } = useQuery<
    { id: string; name: string; email: string }[]
  >({
    queryKey: ["/api/users"],
  });

  const createReminderMutation = useMutation({
    mutationFn: async (reminderData: any) => {
      const response = await fetch("/api/birthday-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminderData),
      });
      if (!response.ok) throw new Error("Failed to create reminder");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lembrete criado",
        description: "Lembrete de aniversário criado com sucesso!",
      });
      setReminderModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/birthday-reminders"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar lembrete",
        variant: "destructive",
      });
    },
  });

  const createAutoRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/birthday-reminders/create-automatic", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to create automatic reminders");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lembretes automáticos criados",
        description: `${data.remindersCreated} lembretes foram criados automaticamente!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/birthday-reminders"] });
    },
  });

  // Função para obter a data do aniversário deste ano
  const getBirthdayThisYear = (birthday: string) => {
    const birthdayDate = parseISO(birthday);
    const currentYear = new Date().getFullYear();
    return new Date(
      currentYear,
      birthdayDate.getMonth(),
      birthdayDate.getDate(),
    );
  };

  const birthdayMap = useMemo(() => {
    const map = new Map<string, Client[]>();
    clients.forEach((client: Client) => {
      if (client.birthday) {
        const birthdayThisYear = getBirthdayThisYear(client.birthday);
        const key = format(birthdayThisYear, "yyyy-MM-dd");
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(client);
      }
    });
    return map;
  }, [clients]);

  const getClientsForDate = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    return birthdayMap.get(key) || [];
  };

  // Função para destacar datas com aniversários
  const dayModifiers = {
    birthday: (date: Date) => getClientsForDate(date).length > 0,
  };

  const dayModifiersClassNames = {
    birthday:
      "bg-wine-100 text-wine-800 font-semibold relative after:content-['🎂'] after:absolute after:bottom-0 after:right-0 after:text-xs",
  };

  const selectedDateClients = useMemo(
    () => getClientsForDate(selectedDate),
    [selectedDate, birthdayMap],
  );

  const handleCreateReminder = () => {
    if (!selectedClient) return;

    const birthdayDate = parseISO(selectedClient.birthday!);
    const currentYear = new Date().getFullYear();
    const thisYearBirthday = new Date(
      currentYear,
      birthdayDate.getMonth(),
      birthdayDate.getDate(),
    );
    const reminderDate = addDays(thisYearBirthday, -parseInt(reminderDays));

    createReminderMutation.mutate({
      clientId: selectedClient.id,
      reminderDate: reminderDate.toISOString(),
      reminderType,
      daysBeforeBirthday: parseInt(reminderDays),
      customMessage: reminderMessage || undefined,
    });
  };

  const isLoading = isClientsLoading || !user;

  if (isLoading) {
    return (
      <div className="flex">
        <div className="flex-1 overflow-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 bg-gray-200 rounded"></div>
              <div className="h-80 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-8 w-8 text-wine-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Aniversários
                </h1>
                <p className="text-gray-600">
                  Visualize os aniversários dos seus clientes
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createAutoRemindersMutation.mutate()}
                disabled={createAutoRemindersMutation.isPending}
                className="flex items-center gap-2"
              >
                <Bell className="h-4 w-4" />
                {createAutoRemindersMutation.isPending
                  ? "Criando..."
                  : "Criar Lembretes Automáticos"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1  lg:grid-cols-2 gap-6">
            {/* Calendário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-wine-600" />
                  Aniversários
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center max-h-[480px] overflow-y-auto">
                <UICalendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      startTransition(() => {
                        setSelectedDate(date);
                      });
                    }
                  }}
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
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[480px] overflow-y-auto">
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
                      <Badge
                        variant="default"
                        className="bg-amber-100 text-amber-800"
                      >
                        {selectedDateClients.length} aniversariante
                        {selectedDateClients.length > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {selectedDateClients.map((client: Client) => {
                      const birthdayDate = parseISO(client.birthday!);
                      const age =
                        new Date().getFullYear() - birthdayDate.getFullYear();

                      return (
                        <div
                          key={client.id}
                          className="p-4 bg-gradient-to-r from-amber-50 to-wine-50 rounded-lg border border-amber-200"
                        >
                          <div className="flex items-start flex-col sm:flex-row gap-y-2 justify-between">
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

                                {/* Nome do responsável */}
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="h-4 w-4 text-gray-500" />
                                  <span className="text-gray-600">
                                    Responsável:{" "}
                                    {(() => {
                                      const user = users.find(
                                        (u) => u.id === client.responsavelId,
                                      );
                                      return user
                                        ? user.name
                                        : client.responsavelId
                                          ? "Usuário não encontrado"
                                          : "Não atribuído";
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-center flex sm:flex-col gap-1 items-center">
                              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <Gift className="h-6 w-6 text-amber-600" />
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {formatDate(client.birthday!)}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
                            {client.phone && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() =>
                                  window.open(`tel:${client.phone}`, "_self")
                                }
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
                                onClick={() =>
                                  window.open(
                                    `mailto:${client.email}`,
                                    "_blank",
                                  )
                                }
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
                                window.open(
                                  `https://wa.me/${client.phone?.replace(
                                    /\D/g,
                                    "",
                                  )}?text=${encodeURIComponent(message)}`,
                                  "_blank",
                                );
                              }}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              WhatsApp
                            </Button>

                            <Dialog
                              open={reminderModalOpen}
                              onOpenChange={setReminderModalOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => setSelectedClient(client)}
                                >
                                  <Bell className="h-3 w-3 mr-1" />
                                  Lembrete
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Criar Lembrete de Aniversário
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Cliente</Label>
                                    <Input
                                      value={selectedClient?.name || ""}
                                      disabled
                                    />
                                  </div>

                                  <div>
                                    <Label>Dias antes do aniversário</Label>
                                    <Select
                                      value={reminderDays}
                                      onValueChange={setReminderDays}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">
                                          1 dia antes
                                        </SelectItem>
                                        <SelectItem value="3">
                                          3 dias antes
                                        </SelectItem>
                                        <SelectItem value="7">
                                          1 semana antes
                                        </SelectItem>
                                        <SelectItem value="15">
                                          15 dias antes
                                        </SelectItem>
                                        <SelectItem value="30">
                                          1 mês antes
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>Tipo de lembrete</Label>
                                    <Select
                                      value={reminderType}
                                      onValueChange={setReminderType}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="email">
                                          Email
                                        </SelectItem>
                                        <SelectItem value="notification">
                                          Notificação
                                        </SelectItem>
                                        <SelectItem value="both">
                                          Ambos
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>
                                      Mensagem personalizada (opcional)
                                    </Label>
                                    <Textarea
                                      value={reminderMessage}
                                      onChange={(e) =>
                                        setReminderMessage(e.target.value)
                                      }
                                      placeholder="Digite uma mensagem personalizada para o lembrete..."
                                    />
                                  </div>

                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        setReminderModalOpen(false)
                                      }
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      onClick={handleCreateReminder}
                                      disabled={
                                        createReminderMutation.isPending
                                      }
                                    >
                                      {createReminderMutation.isPending
                                        ? "Criando..."
                                        : "Criar Lembrete"}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-wine-600" />
                  Estatísticas
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[480px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  {["Hoje", "Amanhã", "Esta semana", "Este mês"].map(
                    (period, index) => {
                      const today = new Date();
                      let count = 0;

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
                          for (let i = 0; i < 7; i++) {
                            const date = new Date(today);
                            date.setDate(today.getDate() + i);
                            count += getClientsForDate(date).length;
                          }
                          break;
                        case 3: // Este mês
                          for (let i = 0; i < 30; i++) {
                            const date = new Date(today);
                            date.setDate(today.getDate() + i);
                            count += getClientsForDate(date).length;
                          }
                          break;
                      }

                      return (
                        <div
                          key={period}
                          className="text-center p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="text-2xl font-bold text-wine-600">
                            {count}
                          </div>
                          <div className="text-sm text-gray-600">{period}</div>
                        </div>
                      );
                    },
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="max-h-[480px] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-600" />
                  Próximos Aniversários (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {upcomingBirthdays.slice(0, 10).map((client: any) => {
                    const birthdayDate = parseISO(client.birthday);
                    const age =
                      new Date().getFullYear() - birthdayDate.getFullYear();
                    const daysUntil = Math.ceil(
                      (new Date(client.nextBirthday).getTime() -
                        new Date().getTime()) /
                        (1000 * 60 * 60 * 24),
                    );

                    return (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {client.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatDate(client.birthday!)} - {age} anos
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Responsável:{" "}
                            {(() => {
                              const user = users.find(
                                (u) => u.id === client.responsavelId,
                              );
                              return user
                                ? user.name
                                : client.responsavelId
                                  ? "Usuário não encontrado"
                                  : "Não atribuído";
                            })()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-amber-600">
                            {daysUntil === 0
                              ? "Hoje!"
                              : daysUntil === 1
                                ? "Amanhã"
                                : `${daysUntil} dias`}
                          </div>
                          {client.phone && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs p-1 h-auto"
                              onClick={() => {
                                const message = `Parabéns, ${client.name}! Feliz aniversário! 🎉🎂`;
                                window.open(
                                  `https://wa.me/${client.phone?.replace(
                                    /\D/g,
                                    "",
                                  )}?text=${encodeURIComponent(message)}`,
                                  "_blank",
                                );
                              }}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {upcomingBirthdays.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum aniversário nos próximos 30 dias
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas e próximos aniversários */}
        </div>
      </div>
    </div>
  );
}
