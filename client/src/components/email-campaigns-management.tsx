
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Send, Eye, Trash2, Calendar, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  templateType: string;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  targetType: string;
  totalRecipients: number;
  sentCount: number;
  createdAt: string;
  creator: { name: string };
}

export default function EmailCampaignsManagement() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    content: "",
    templateType: "custom",
    targetType: "all",
    targetCriteria: "",
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["/api/email-campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/email-campaigns");
      if (!response.ok) throw new Error("Erro ao buscar campanhas");
      return response.json();
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await fetch("/api/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignData),
      });
      if (!response.ok) throw new Error("Erro ao criar campanha");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setIsCreateModalOpen(false);
      setFormData({
        name: "",
        subject: "",
        content: "",
        templateType: "custom",
        targetType: "all",
        targetCriteria: "",
      });
      toast({
        title: "Campanha criada",
        description: "A campanha foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a campanha.",
        variant: "destructive",
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/email-campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Erro ao excluir campanha");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast({
        title: "Campanha excluída",
        description: "A campanha foi excluída com sucesso.",
      });
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/email-campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Erro ao enviar campanha");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      toast({
        title: "Campanha enviada",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a campanha.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
      scheduled: { label: "Agendada", color: "bg-blue-100 text-blue-800" },
      sent: { label: "Enviada", color: "bg-green-100 text-green-800" },
      cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getTemplateTypeLabel = (type: string) => {
    const types = {
      birthday: "Aniversário",
      promotion: "Promoção",
      newsletter: "Newsletter",
      follow_up: "Follow-up",
      custom: "Personalizada",
    };
    return types[type as keyof typeof types] || "Personalizada";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaignMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campanhas de Email</h2>
          <p className="text-gray-600">Gerencie suas campanhas de email marketing</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-wine-600 hover:bg-wine-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha de Email</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome da Campanha</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Promoção de Verão"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="templateType">Tipo de Template</Label>
                  <Select value={formData.templateType} onValueChange={(value) => setFormData(prev => ({ ...prev, templateType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizada</SelectItem>
                      <SelectItem value="birthday">Aniversário</SelectItem>
                      <SelectItem value="promotion">Promoção</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="subject">Assunto do Email</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Assunto atrativo para seu email"
                  required
                />
              </div>

              <div>
                <Label htmlFor="targetType">Público-Alvo</Label>
                <Select value={formData.targetType} onValueChange={(value) => setFormData(prev => ({ ...prev, targetType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    <SelectItem value="category">Por categoria</SelectItem>
                    <SelectItem value="origin">Por origem</SelectItem>
                    <SelectItem value="markers">Por marcadores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="content">Conteúdo do Email</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Digite o conteúdo do seu email..."
                  rows={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {"{nome}"} para inserir o nome do cliente automaticamente
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCampaignMutation.isPending}>
                  {createCampaignMutation.isPending ? "Criando..." : "Criar Campanha"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-gray-600 text-center mb-4">
                Comece criando sua primeira campanha de email marketing
              </p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign: EmailCampaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{campaign.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(campaign.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{getTemplateTypeLabel(campaign.templateType)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>{campaign.totalRecipients} destinatários</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4 text-gray-500" />
                    <span>{campaign.sentCount} enviados</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{formatDate(campaign.createdAt)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Criada por {campaign.creator.name}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                    {campaign.status === "draft" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                          onClick={() => sendCampaignMutation.mutate(campaign.id)}
                          disabled={sendCampaignMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          {sendCampaignMutation.isPending ? "Enviando..." : "Enviar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Visualizar Campanha</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Assunto:</h3>
                <p className="text-gray-700">{selectedCampaign.subject}</p>
              </div>
              <div>
                <h3 className="font-medium">Conteúdo:</h3>
                <div className="bg-gray-50 p-4 rounded border">
                  <p className="whitespace-pre-wrap">{selectedCampaign.content}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
