import { useState, useMemo, useTransition } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { format, parseISO, addDays, isValid } from "date-fns";
import type { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { StartBirthdayBot } from "@/components/start-birthday-bot";

// New specialized components
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarStatistics } from "@/components/calendar/calendar-statistics";
import { CalendarView } from "@/components/calendar/calendar-view";
import { UpcomingBirthdays } from "@/components/calendar/upcoming-birthdays";

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

  // Queries
  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ["/api/birthdays/upcoming", "all", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch(`/api/birthdays/upcoming?days=365`, {
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

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Mutations
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

  // Helpers
  const getBirthdayThisYear = (birthday: string): Date | null => {
    const birthdayDate = parseISO(birthday);
    if (!isValid(birthdayDate)) return null;
    const today = new Date();
    return new Date(
      today.getFullYear(),
      birthdayDate.getMonth(),
      birthdayDate.getDate(),
    );
  };

  const birthdayMap = useMemo(() => {
    const map = new Map<string, Client[]>();
    clients.forEach((client: Client) => {
      if (client.birthday) {
        const birthdayThisYear = getBirthdayThisYear(client.birthday);
        if (!birthdayThisYear) return;
        const key = format(birthdayThisYear, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(client);
      }
    });
    return map;
  }, [clients]);

  const getClientsForDate = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    return birthdayMap.get(key) || [];
  };

  const stats = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const getCountForPeriod = (days: number) => {
      let count = 0;
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        count += getClientsForDate(d).length;
      }
      return count;
    };

    return {
      today: getClientsForDate(today).length,
      tomorrow: getClientsForDate(tomorrow).length,
      thisWeek: getCountForPeriod(7),
      thisMonth: getCountForPeriod(30),
    };
  }, [birthdayMap]);

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

  if (isClientsLoading || !user) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <CalendarHeader
        onCreateAutoReminders={() => createAutoRemindersMutation.mutate()}
        isPending={createAutoRemindersMutation.isPending}
      />

      <CalendarStatistics stats={stats} />

      <CalendarView
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          startTransition(() => {
            setSelectedDate(date);
          });
        }}
        clientsForSelectedDate={selectedDateClients}
        birthdayMap={birthdayMap}
        users={users}
        onStartBot={(client) => {
          setClientStartBot(client);
          setBirthdayBot(true);
        }}
        onCreateReminder={(client) => {
          setSelectedClient(client);
          setReminderModalOpen(true);
        }}
      />

      <UpcomingBirthdays upcomingBirthdays={upcomingBirthdays} users={users} />

      {/* Reminder Modal */}
      <Dialog open={reminderModalOpen} onOpenChange={setReminderModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Lembrete de Aniversário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-slate-500 mb-1.5 block">Cliente</Label>
              <Input
                value={selectedClient?.name || ""}
                disabled
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500 mb-1.5 block">
                  Dias de Antecedência
                </Label>
                <Select value={reminderDays} onValueChange={setReminderDays}>
                  <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="1">1 dia antes</SelectItem>
                    <SelectItem value="3">3 dias antes</SelectItem>
                    <SelectItem value="7">1 semana antes</SelectItem>
                    <SelectItem value="15">15 dias antes</SelectItem>
                    <SelectItem value="30">1 mês antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-500 mb-1.5 block">
                  Tipo de Lembrete
                </Label>
                <Select value={reminderType} onValueChange={setReminderType}>
                  <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="notification">Notificação</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-slate-500 mb-1.5 block">
                Mensagem (Opcional)
              </Label>
              <Textarea
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="Ex: Não esquecer de ligar para dar os parabéns!"
                className="rounded-xl border-slate-200 dark:border-slate-700 min-h-[100px]"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => setReminderModalOpen(false)}
                className="rounded-xl px-6"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateReminder}
                disabled={createReminderMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-8 rounded-xl h-11"
              >
                {createReminderMutation.isPending
                  ? "Criando..."
                  : "Criar Lembrete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Birthday Bot Modal */}
      {clientStartBot && (
        <StartBirthdayBot
          open={openBirthdayBot}
          onOpenChange={setBirthdayBot}
          client={clientStartBot}
        />
      )}
    </div>
  );
}
