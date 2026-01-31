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
  Calendar,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { StartBirthdayBot } from "@/components/start-birthday-bot";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [reminderDays, setReminderDays] = useState("1");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderType, setReminderType] = useState("email");

  const [openBirthdayBot, setBirthdayBot] = useState(false);
  const [clientStartBot, setClientStartBot] = useState<Client | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ["/api/birthdays/upcoming", "all", user?.id, user?.role],
    queryFn: async () => {
      // Admin vê todos os clientes, outros só os seus
      const url =
        user?.role === "admin" || user?.role === "administrador"
          ? `/api/birthdays/upcoming?days=365`
          : `/api/birthdays/upcoming?days=365`;

      const response = await fetch(url, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch all birthdays");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: ["/api/birthdays/upcoming", 30, user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch("/api/birthdays/upcoming?days=30", {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch upcoming birthdays");
      return response.json();
    },
    enabled: !!user,
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
      "bg-wine-100 dark:bg-slate-600 dark:text-slate-100 text-wine-800 font-semibold relative after:content-['🎂'] after:absolute after:bottom-0 after:right-0 after:text-xs",
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
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 bg-gray-200 dark:bg-slate-700 rounded"></div>
              <div className="h-80 bg-gray-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 w-full">
        <div className="flex-1 overflow-auto">
          <div className="space-y-6 ">
            <div className="bg-white dark:bg-slate-950 dark:border dark:border-slate-700 border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 flex-wrap justify-between">
                <div className="flex items-center gap-4">
                  <Calendar className="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      Aniversários
                    </h2>
                    <p className="text-gray-600 mt-1 dark:text-gray-400">
                      Visualize os aniversários dos seus clientes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
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
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
              {/* Calendário */}
              <Card className="border border-gray-200 dark:bg-slate-800 dark:shadow-sm dark:shadow-black dark:border-slate-700 dark:hover:border-slate-600 transition-colors min-w-0 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-wine-100 dark:bg-slate-700">
                      <CalendarIcon className="h-4 w-4 text-wine-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Calendário
                      </div>
                      <div className="text-sm text-gray-600 font-normal dark:text-gray-400">
                        Selecione uma data
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center max-h-[480px] overflow-y-auto p-4 sm:p-6 min-w-0">
                  <div className="max-w-full overflow-hidden">
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
                      className="rounded-md border dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 max-w-full"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Detalhes da data selecionada */}
              <Card className="border border-gray-200 dark:border-slate-700 dark:hover:border-slate-600 dark:bg-slate-800 dark:shadow-sm dark:shadow-black transition-colors min-w-0 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-700">
                      <Gift className="h-4 w-4 text-amber-600 dark:text-amber-100" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                      </div>
                      <div className="text-sm text-gray-600 font-normal dark:text-gray-400">
                        {format(selectedDate, "yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-[480px] overflow-y-auto p-4 sm:p-6">
                  {selectedDateClients.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 flex-shrink-0">
                          <Gift className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                            Nenhum aniversário
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 ">
                            Não há aniversários nesta data
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Badge
                          variant="default"
                          className="bg-amber-100 dark:bg-amber-700 text-amber-800 dark:text-amber-100 border border-amber-200 dark:border-amber-600"
                        >
                          <div className="flex h-3 w-3 items-center justify-center rounded bg-amber-200 dark:bg-amber-600 mr-1">
                            <Gift className="h-2 w-2 text-amber-700 dark:text-amber-100" />
                          </div>
                          {selectedDateClients.length} aniversariante
                          {selectedDateClients.length > 1 ? "s" : ""}
                        </Badge>
                      </div>

                      {selectedDateClients.map((client: Client) => {
                        const birthdayDate = parseISO(client.birthday!);
                        const age =
                          new Date().getFullYear() - birthdayDate.getFullYear();

                        return (
                          <>
                            <div
                              key={client.id}
                              className="p-4 sm:p-6 bg-gradient-to-r from-amber-50 dark:from-slate-950 dark:to-slate-950 to-wine-50 hover:from-amber-100 hover:to-wine-100 rounded-lg border border-amber-200 dark:border-amber-700 hover:border-amber-300 transition-all duration-200 hover:shadow-sm min-w-0 overflow-hidden"
                            >
                              <div className="flex items-start flex-col sm:flex-row gap-3 sm:gap-4 justify-between">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-700 border-2 border-amber-200 dark:border-amber-600 flex-shrink-0">
                                    <Gift className="h-6 w-6 text-amber-600 dark:text-amber-100" />
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div>
                                      <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
                                        {client.name}
                                      </h3>
                                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        🎉 Completando {age} anos
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      {client.phone && (
                                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                                          <div className="flex h-3 w-3 items-center justify-center rounded bg-green-100 dark:bg-green-700">
                                            <Phone className="h-2 w-2 text-green-600 dark:text-green-100" />
                                          </div>
                                          <a
                                            href={`tel:${client.phone}`}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-600 hover:underline truncate transition-colors"
                                            title="Clique para ligar"
                                          >
                                            {client.phone}
                                          </a>
                                        </div>
                                      )}

                                      {client.email && (
                                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                                          <div className="flex h-3 w-3 items-center justify-center rounded bg-blue-100 dark:bg-blue-700">
                                            <Mail className="h-2 w-2 text-blue-600 dark:text-blue-100" />
                                          </div>
                                          <a
                                            href={`mailto:${client.email}`}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-600 hover:underline truncate transition-colors"
                                            title="Clique para enviar email"
                                          >
                                            {client.email}
                                          </a>
                                        </div>
                                      )}

                                      {/* Nome do responsável */}
                                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                                        <div className="flex h-3 w-3 items-center justify-center rounded bg-gray-100 dark:bg-gray-700">
                                          <User className="h-2 w-2 text-gray-600 dark:text-gray-100" />
                                        </div>
                                        <span className="text-gray-600 dark:text-gray-400 truncate">
                                          Responsável:{" "}
                                          {(() => {
                                            const user = users.find(
                                              (u) =>
                                                u.id === client.responsavelId,
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
                                </div>

                                <div className="flex flex-col items-center gap-2 sm:items-end">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-amber-100 dark:bg-amber-700 text-amber-700 dark:text-amber-100 border border-amber-200 dark:border-amber-700"
                                  >
                                    <div className="flex h-3 w-3 items-center justify-center rounded bg-amber-200 dark:bg-amber-700 mr-1">
                                      <CalendarIcon className="h-2 w-2 text-amber-700 dark:text-amber-100" />
                                    </div>
                                    {formatDate(client.birthday!)}
                                  </Badge>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 border-t border-gray-100 dark:border-gray-700 pt-4 min-w-0">
                                {client.phone && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                                    onClick={() =>
                                      window.open(
                                        `tel:${client.phone}`,
                                        "_self",
                                      )
                                    }
                                  >
                                    <div className="flex h-3 w-3 items-center justify-center rounded  mr-1.5">
                                      <Phone className="h-2 w-2 text-green-600 dark:text-green-100" />
                                    </div>
                                    Ligar
                                  </Button>
                                )}

                                {client.email && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                                    onClick={() =>
                                      window.open(
                                        `mailto:${client.email}`,
                                        "_blank",
                                      )
                                    }
                                  >
                                    <div className="flex h-3 w-3 items-center justify-center rounded  mr-1.5">
                                      <Mail className="h-2 w-2 text-blue-600 dark:text-blue-100" />
                                    </div>
                                    Email
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                                  onClick={() => {
                                    setClientStartBot(client);
                                    setBirthdayBot(true);
                                  }}
                                >
                                  <div className="flex h-3 w-3 items-center justify-center rounded  mr-1.5">
                                    <MessageSquare className="h-2 w-2 text-green-600 dark:text-green-100" />
                                  </div>
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
                                      className="text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                                      onClick={() => setSelectedClient(client)}
                                    >
                                      <div className="flex h-3 w-3 items-center justify-center rounded mr-1.5">
                                        <Bell className="h-2 w-2 text-amber-600 dark:text-amber-100" />
                                      </div>
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
                                        <Label className="dark:text-slate-200">
                                          Cliente
                                        </Label>
                                        <Input
                                          value={selectedClient?.name || ""}
                                          disabled
                                        />
                                      </div>

                                      <div>
                                        <Label className="dark:text-slate-200">
                                          Dias antes do aniversário
                                        </Label>
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
                                        <Label className="dark:text-slate-200">
                                          Tipo de lembrete
                                        </Label>
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
                                        <Label className="dark:text-slate-200">
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
                          </>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 dark:bg-slate-800 dark:shadow-sm dark:shadow-black transition-colors min-w-0 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-wine-100 dark:bg-slate-700">
                      <Gift className="h-4 w-4 text-wine-600 dark:text-wine-100" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-slate-200">
                        Estatísticas
                      </div>
                      <div className="text-sm text-gray-600  dark:text-slate-400 font-normal">
                        Resumo de aniversários
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-[480px] overflow-y-auto p-4 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                            className="text-center p-3 sm:p-4 bg-gradient-to-br from-gray-50 dark:from-slate-700 dark:to-slate-700 dark:shadow-md dark:shadow-slate-900 dark:border-slate-700 to-gray-100 hover:from-wine-50 hover:to-wine-100 rounded-lg border border-gray-200 hover:border-wine-200 transition-all duration-200 hover:shadow-sm"
                          >
                            <div className="flex justify-center mb-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wine-100 dark:bg-slate-500 dark:text-slate-200 border border-wine-200">
                                <Gift className="h-4 w-4 text-wine-600 dark:text-wine-100" />
                              </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-wine-600 dark:text-slate-200 mb-1">
                              {count}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 font-medium">
                              {period}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="max-h-[480px] overflow-y-auto border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:shadow-md dark:shadow-black hover:border-gray-300 dark:hover:border-slate-600 transition-colors min-w-0 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 dark:bg-slate-600">
                      <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-slate-200">
                        Próximos Aniversários
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-400  font-normal">
                        30 dias
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
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
                          className="flex flex-col sm:flex-row items-start dark:from-amber-700 dark:to-orange-800 sm:items-center justify-between gap-3 p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 rounded-lg border dark:border-amber-700 border-amber-200 hover:border-amber-300 transition-all duration-200 hover:shadow-sm min-w-0 overflow-hidden"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 border-2 border-amber-200 flex-shrink-0">
                              <Gift className="h-5 w-5 text-amber-700" />
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-slate-100 truncate">
                                {client.name}
                              </div>

                              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-slate-300">
                                <div className="flex h-3 w-3 items-center justify-center rounded bg-blue-100 dark:bg-amber-700">
                                  <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="truncate">
                                  {formatDate(client.birthday!)} - {age} anos
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                                <div className="flex h-3 w-3 items-center justify-center rounded bg-gray-100 dark:bg-amber-700">
                                  <User className="h-3 w-3 text-gray-600 dark:text-slate-300" />
                                </div>
                                <span className="truncate dark:text-slate-300">
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

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="flex flex-col items-start sm:items-end">
                              <div
                                className={`text-xs sm:text-sm font-semibold px-2 py-1 rounded-full ${
                                  daysUntil === 0
                                    ? "bg-red-100 text-red-700 border border-red-200"
                                    : daysUntil <= 3
                                      ? "bg-orange-100 text-orange-700 border border-orange-200"
                                      : "bg-amber-100 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {daysUntil === 0
                                  ? "🎉 Hoje!"
                                  : daysUntil === 1
                                    ? "🎂 Amanhã"
                                    : `⏰ ${daysUntil} dias`}
                              </div>
                            </div>

                            {client.phone && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 border-green-200 dark:hover:bg-amber-900 hover:bg-green-50 hover:border-green-300 transition-colors"
                                onClick={() => {
                                  setClientStartBot(client);
                                  setBirthdayBot(true);
                                }}
                                title="Enviar mensagem de aniversário via WhatsApp"
                              >
                                <div className="flex h-4 w-4 items-center justify-center rounded bg-green-100 dark:bg-amber-800">
                                  <MessageSquare className="h-3 w-3 text-green-600 dark:text-green-400" />
                                </div>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {upcomingBirthdays.length === 0 && (
                      <div className="text-center py-8 px-4">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                            <Bell className="h-6 w-6 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              Nenhum aniversário próximo
                            </p>
                            <p className="text-xs text-gray-500">
                              Não há aniversários nos próximos 30 dias
                            </p>
                          </div>
                        </div>
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
      {clientStartBot && (
        <StartBirthdayBot
          client={clientStartBot}
          isOpen={openBirthdayBot}
          onOpenChange={setBirthdayBot}
        />
      )}
    </>
  );
}
