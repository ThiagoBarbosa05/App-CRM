import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings, Mail, MessageSquare, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Wifi } from "lucide-react";

interface MarketingSettings {
  marketing_sendgrid_api_key?: string;
  marketing_sendgrid_from_email?: string;
  marketing_sendgrid_from_name?: string;
  marketing_sms_from_number?: string;
}

export function MarketingSettingsDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState<MarketingSettings>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: settings, isLoading } = useQuery<MarketingSettings>({
    queryKey: ["/api/marketing/settings"],
    enabled: open,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!open) setTestResult(null);
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async (data: MarketingSettings) => {
      const res = await apiRequest("PUT", "/api/marketing/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/settings"] });
      toast({ title: "Configurações salvas com sucesso!" });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/marketing/test-sendgrid", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Erro desconhecido");
      return data as { ok: boolean; message: string };
    },
    onSuccess: (data) => setTestResult({ ok: true, message: data.message }),
    onError: (err: Error) => setTestResult({ ok: false, message: err.message }),
  });

  const handleSave = () => saveMutation.mutate(form);

  const isEmailConfigured = !!(form.marketing_sendgrid_api_key && form.marketing_sendgrid_from_email);
  const isSmsConfigured = !!form.marketing_sms_from_number;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-3.5 w-3.5" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações de Marketing</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Email — SendGrid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                    <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold">Email — SendGrid</span>
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-medium ${isEmailConfigured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {isEmailConfigured
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Configurado</>
                    : <><AlertCircle className="h-3.5 w-3.5" /> Não configurado</>
                  }
                </div>
              </div>

              <div className="space-y-3 pl-1">
                <div>
                  <Label htmlFor="sg-api-key" className="text-xs">API Key do SendGrid</Label>
                  <div className="relative mt-1">
                    <Input
                      id="sg-api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="SG.xxxxxxxxxxxx"
                      value={form.marketing_sendgrid_api_key ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, marketing_sendgrid_api_key: e.target.value }))}
                      className="pr-9 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sg-from-email" className="text-xs">E-mail remetente</Label>
                    <Input
                      id="sg-from-email"
                      type="email"
                      placeholder="marketing@suaempresa.com"
                      value={form.marketing_sendgrid_from_email ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, marketing_sendgrid_from_email: e.target.value }))}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sg-from-name" className="text-xs">Nome do remetente</Label>
                    <Input
                      id="sg-from-name"
                      placeholder="Grand Cru"
                      value={form.marketing_sendgrid_from_name ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, marketing_sendgrid_from_name: e.target.value }))}
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={!form.marketing_sendgrid_api_key || testMutation.isPending}
                    onClick={() => { setTestResult(null); testMutation.mutate(); }}
                  >
                    {testMutation.isPending
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testando...</>
                      : <><Wifi className="h-3.5 w-3.5" /> Testar conexão</>
                    }
                  </Button>
                  {testResult && (
                    <span className={`flex items-center gap-1 text-xs font-medium ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {testResult.ok
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        : <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      }
                      {testResult.message}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Crie sua API Key em{" "}
                  <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    app.sendgrid.com
                  </a>
                  {" "}com permissão de envio de e-mail.
                </p>
              </div>
            </div>

            <Separator />

            {/* SMS — Twilio */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center">
                    <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-semibold">SMS — Twilio</span>
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-medium ${isSmsConfigured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {isSmsConfigured
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Configurado</>
                    : <><AlertCircle className="h-3.5 w-3.5" /> Não configurado</>
                  }
                </div>
              </div>

              <div className="pl-1">
                <Label htmlFor="sms-from" className="text-xs">Número de origem (SMS)</Label>
                <Input
                  id="sms-from"
                  placeholder="+14782105167"
                  value={form.marketing_sms_from_number ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, marketing_sms_from_number: e.target.value }))}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Use um número Twilio com SMS habilitado. O número de voz brasileiro não suporta SMS.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
