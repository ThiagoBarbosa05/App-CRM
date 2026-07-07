import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Send, Trash2, Calendar, Users, Zap, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SmsCampaign {
  id: string;
  name: string;
  message: string;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  targetType: string;
  totalRecipients: number;
  sentCount: number;
  createdAt: string;
  creator: { name: string } | null;
}

const STATUS_CONFIG: Record<SmsCampaign["status"], { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Enviando", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  sent: { label: "Enviada", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const EMPTY_FORM = { name: "", message: "", targetType: "all", targetCriteria: "" };
const EMPTY_INDIVIDUAL = { to: "", message: "" };
const SMS_MAX_LENGTH = 320;

export function MarketingSmsTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isIndividualOpen, setIsIndividualOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [individualData, setIndividualData] = useState(EMPTY_INDIVIDUAL);
  const [sentSuccess, setSentSuccess] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<SmsCampaign[]>({
    queryKey: ["/api/sms-campaigns"],
  });

  const individualMutation = useMutation({
    mutationFn: async (data: typeof individualData) => {
      const res = await apiRequest("POST", "/api/sms-campaigns/send-individual", data);
      return res.json();
    },
    onSuccess: () => {
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        setIsIndividualOpen(false);
        setIndividualData(EMPTY_INDIVIDUAL);
      }, 1800);
      toast({ title: "SMS enviado!", description: "Mensagem entregue com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/sms-campaigns", {
        ...data,
        targetCriteria: data.targetType === "all" ? null : data.targetCriteria,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      setIsCreateOpen(false);
      setFormData(EMPTY_FORM);
      toast({ title: "Campanha criada", description: "Campanha de SMS salva como rascunho." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sms-campaigns/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/summary"] });
      toast({ title: "Campanha enfileirada", description: "O envio será processado em background." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sms-campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      toast({ title: "Campanha excluída" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Campanhas de SMS via Twilio.</p>
        <div className="flex items-center gap-2">

          {/* Envio Individual */}
          <Dialog open={isIndividualOpen} onOpenChange={(v) => { setIsIndividualOpen(v); if (!v) { setIndividualData(EMPTY_INDIVIDUAL); setSentSuccess(false); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Zap className="h-3.5 w-3.5" />
                Envio individual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar SMS Individual</DialogTitle>
              </DialogHeader>

              {sentSuccess ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">SMS enviado com sucesso!</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); individualMutation.mutate(individualData); }}
                  className="space-y-4 pt-1"
                >
                  <div>
                    <Label htmlFor="ind-to">Destinatário</Label>
                    <Input
                      id="ind-to"
                      placeholder="(21) 99999-9999 ou +5521999999999"
                      value={individualData.to}
                      onChange={(e) => setIndividualData((p) => ({ ...p, to: e.target.value }))}
                      className="mt-1"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Digite o número do cliente com DDD ou no formato internacional.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="ind-message">Mensagem</Label>
                    <Textarea
                      id="ind-message"
                      placeholder="Digite sua mensagem..."
                      value={individualData.message}
                      onChange={(e) => setIndividualData((p) => ({ ...p, message: e.target.value.slice(0, SMS_MAX_LENGTH) }))}
                      rows={4}
                      className="mt-1 resize-none"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {individualData.message.length}/{SMS_MAX_LENGTH}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsIndividualOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" disabled={individualMutation.isPending} className="gap-2">
                      <Send className="h-3.5 w-3.5" />
                      {individualMutation.isPending ? "Enviando..." : "Enviar SMS"}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Separator orientation="vertical" className="h-5" />

          {/* Nova Campanha */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova campanha de SMS</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                <div>
                  <Label htmlFor="sms-name">Nome da campanha</Label>
                  <Input
                    id="sms-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Promoção de Verão"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sms-target-type">Público-alvo</Label>
                    <Select
                      value={formData.targetType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, targetType: value, targetCriteria: "" }))}
                    >
                      <SelectTrigger id="sms-target-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clientes</SelectItem>
                        <SelectItem value="category">Por categoria</SelectItem>
                        <SelectItem value="origin">Por origem</SelectItem>
                        <SelectItem value="markers">Por marcador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.targetType !== "all" && (
                    <div>
                      <Label htmlFor="sms-target-criteria">
                        {formData.targetType === "category" && "Categoria"}
                        {formData.targetType === "origin" && "Origem"}
                        {formData.targetType === "markers" && "Marcador"}
                      </Label>
                      <Input
                        id="sms-target-criteria"
                        value={formData.targetCriteria}
                        onChange={(e) => setFormData((prev) => ({ ...prev, targetCriteria: e.target.value }))}
                        placeholder="Valor exato cadastrado no cliente"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="sms-message">Mensagem</Label>
                  <Textarea
                    id="sms-message"
                    value={formData.message}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value.slice(0, SMS_MAX_LENGTH) }))}
                    placeholder="Digite a mensagem de SMS..."
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {formData.message.length}/{SMS_MAX_LENGTH}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar campanha"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && campaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha de SMS ainda</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar campanha
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {campaigns.map((campaign) => {
          const cfg = STATUS_CONFIG[campaign.status];
          return (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{campaign.message}</p>
                  </div>
                  <Badge className={cfg.color}>{cfg.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {campaign.totalRecipients} destinatários
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    {campaign.sentCount} enviados
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(campaign.createdAt)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Criada por {campaign.creator?.name ?? "—"}
                  </span>
                  {campaign.status === "draft" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800"
                        onClick={() => sendMutation.mutate(campaign.id)}
                        disabled={sendMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Enviar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(campaign.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
