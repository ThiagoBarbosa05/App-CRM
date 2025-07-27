import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Save, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BirthdayReminderSettings } from "@shared/schema";

export function BirthdaySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<BirthdayReminderSettings>({
    queryKey: ["/api/birthday-reminder-settings"],
  });

  const [formData, setFormData] = useState({
    isEnabled: true,
    defaultDaysBeforeBirthday: 1,
    reminderTime: "09:00",
    emailTemplate: "Olá! Lembre-se que o aniversário de {{clientName}} é amanhã ({{birthdayDate}}). Que tal enviar uma mensagem especial? 🎉",
    smsTemplate: "Lembrete: Aniversário de {{clientName}} é amanhã! 🎂",
  });

  // Update form when settings load
  useState(() => {
    if (settings) {
      setFormData({
        isEnabled: settings.isEnabled === "true",
        defaultDaysBeforeBirthday: settings.defaultDaysBeforeBirthday,
        reminderTime: settings.reminderTime,
        emailTemplate: settings.emailTemplate || "Olá! Lembre-se que o aniversário de {clientName} é amanhã ({birthdayDate}). Que tal enviar uma mensagem especial? 🎉",
        smsTemplate: settings.smsTemplate || "Lembrete: Aniversário de {clientName} é amanhã! 🎂",
      });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/birthday-reminder-settings", "PUT", data),
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "As configurações dos lembretes foram atualizadas com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/birthday-reminder-settings"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar as configurações",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateSettingsMutation.mutate({
      isEnabled: formData.isEnabled ? "true" : "false",
      defaultDaysBeforeBirthday: formData.defaultDaysBeforeBirthday,
      reminderTime: formData.reminderTime,
      emailTemplate: formData.emailTemplate,
      smsTemplate: formData.smsTemplate,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações dos Lembretes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-wine-600" />
          Configurações dos Lembretes de Aniversário
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="isEnabled" className="text-base font-medium">
                Ativar lembretes automáticos
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Ative para receber lembretes automáticos de aniversários
              </p>
            </div>
            <Switch
              id="isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
            />
          </div>

          {/* Days before birthday */}
          <div className="space-y-2">
            <Label htmlFor="defaultDaysBeforeBirthday">
              Dias antes do aniversário para lembrar
            </Label>
            <Input
              id="defaultDaysBeforeBirthday"
              type="number"
              min="0"
              max="30"
              value={formData.defaultDaysBeforeBirthday}
              onChange={(e) => setFormData({ 
                ...formData, 
                defaultDaysBeforeBirthday: parseInt(e.target.value) || 1 
              })}
              className="w-32"
            />
            <p className="text-sm text-gray-600">
              Número de dias antes do aniversário para criar o lembrete
            </p>
          </div>

          {/* Reminder time */}
          <div className="space-y-2">
            <Label htmlFor="reminderTime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário dos lembretes
            </Label>
            <Input
              id="reminderTime"
              type="time"
              value={formData.reminderTime}
              onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
              className="w-40"
            />
            <p className="text-sm text-gray-600">
              Horário em que os lembretes serão processados
            </p>
          </div>

          {/* Email template */}
          <div className="space-y-2">
            <Label htmlFor="emailTemplate">
              Modelo de email
            </Label>
            <Textarea
              id="emailTemplate"
              value={formData.emailTemplate}
              onChange={(e) => setFormData({ ...formData, emailTemplate: e.target.value })}
              placeholder="Digite o modelo do email..."
              rows={4}
              className="resize-none"
            />
            <p className="text-sm text-gray-600">
              Use {"{"}clientName{"}"} para o nome do cliente e {"{"}birthdayDate{"}"} para a data do aniversário
            </p>
          </div>

          {/* SMS template */}
          <div className="space-y-2">
            <Label htmlFor="smsTemplate">
              Modelo de SMS
            </Label>
            <Textarea
              id="smsTemplate"
              value={formData.smsTemplate}
              onChange={(e) => setFormData({ ...formData, smsTemplate: e.target.value })}
              placeholder="Digite o modelo do SMS..."
              rows={3}
              className="resize-none"
            />
            <p className="text-sm text-gray-600">
              Use {"{"}clientName{"}"} para o nome do cliente
            </p>
          </div>

          {/* Submit button */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="bg-wine-600 hover:bg-wine-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>

          {/* Last processed info */}
          {settings?.lastProcessedDate && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Última verificação:</strong>{" "}
                {new Date(settings.lastProcessedDate).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}