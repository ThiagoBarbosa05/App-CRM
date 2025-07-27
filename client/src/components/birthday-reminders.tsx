import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Gift, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Client, BirthdayReminderWithClient } from "@shared/schema";

interface BirthdayRemindersProps {
  showUpcoming?: boolean;
  showToday?: boolean;
}

export function BirthdayReminders({ showUpcoming = true, showToday = true }: BirthdayRemindersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: upcomingBirthdays = [], isLoading: isLoadingBirthdays } = useQuery<Client[]>({
    queryKey: ["/api/upcoming-birthdays"],
    enabled: showUpcoming,
  });

  const { data: todayReminders = [], isLoading: isLoadingReminders } = useQuery<BirthdayReminderWithClient[]>({
    queryKey: ["/api/birthday-reminders/today"],
    enabled: showToday,
  });

  const createAutomaticRemindersMutation = useMutation({
    mutationFn: () => apiRequest("/api/birthday-reminders/create-automatic", "POST", {}),
    onSuccess: (data: any) => {
      toast({
        title: "Lembretes criados",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/birthday-reminders"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar lembretes automáticos",
        variant: "destructive",
      });
    },
  });

  const markAsSentMutation = useMutation({
    mutationFn: (reminderId: string) => apiRequest(`/api/birthday-reminders/${reminderId}/mark-sent`, "PUT", {}),
    onSuccess: () => {
      toast({
        title: "Lembrete marcado",
        description: "Lembrete marcado como enviado",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/birthday-reminders/today"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao marcar lembrete como enviado",
        variant: "destructive",
      });
    },
  });

  const formatBirthdayDate = (birthday: Date | string) => {
    const date = new Date(birthday);
    const today = new Date();
    const thisYearBirthday = new Date(today.getFullYear(), date.getMonth(), date.getDate());
    
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    return format(thisYearBirthday, "dd/MM");
  };

  const getDaysUntilBirthday = (birthday: Date | string) => {
    const date = new Date(birthday);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisYearBirthday = new Date(today.getFullYear(), date.getMonth(), date.getDate());
    
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = thisYearBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  if (isLoadingBirthdays || isLoadingReminders) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {showUpcoming && upcomingBirthdays.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Gift className="h-5 w-5 text-wine-600" />
              Próximos Aniversários
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => createAutomaticRemindersMutation.mutate()}
              disabled={createAutomaticRemindersMutation.isPending}
              className="text-xs"
            >
              <Clock className="h-4 w-4 mr-1" />
              Criar Lembretes
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBirthdays.slice(0, 5).map((client) => {
                const daysUntil = getDaysUntilBirthday(client.birthday!);
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-wine-50 to-amber-50 rounded-lg border border-wine-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-wine-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-wine-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-600">
                          {formatBirthdayDate(client.birthday!)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={daysUntil === 0 ? "default" : daysUntil <= 3 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {daysUntil === 0 ? "HOJE!" : 
                         daysUntil === 1 ? "Amanhã" : 
                         `${daysUntil} dias`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showToday && todayReminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Lembretes de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Gift className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{reminder.client.name}</p>
                      <p className="text-sm text-gray-600">
                        Aniversário {reminder.daysBeforeBirthday === 0 ? "hoje" : `em ${reminder.daysBeforeBirthday} dias`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {reminder.reminderType}
                    </Badge>
                    {reminder.isSent === "false" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsSentMutation.mutate(reminder.id)}
                        disabled={markAsSentMutation.isPending}
                        className="text-xs"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Marcar Enviado
                      </Button>
                    )}
                    {reminder.isSent === "true" && (
                      <Badge variant="secondary" className="text-xs">
                        Enviado
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showUpcoming && upcomingBirthdays.length === 0 && showToday && todayReminders.length === 0 && (
        <Card>
          <CardContent className="py-6">
            <div className="text-center text-gray-500">
              <Gift className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nenhum aniversário próximo</p>
              <p className="text-sm">Quando houver aniversários próximos, eles aparecerão aqui</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}