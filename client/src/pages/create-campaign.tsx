import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Calendar as CalendarIcon,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Users,
  Bot,
  MessageSquare,
  Clock,
  Send,
} from "lucide-react";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useUmblerBots } from "@/hooks/use-umbler-bots";
import { useUmblerChannels } from "@/hooks/use-umbler-channels";
import { useCreateCampaign } from "@/hooks/use-create-campaign";
import { useUmblerTags } from "@/hooks/use-umbler-tags";
import { useUmblerContacts } from "@/hooks/use-umbler-contacts";

interface Tag {
  id: string;
  name: string;
  color?: string;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const ORGANIZATION_ID = "aGx7Jh43-au36EGi";

export default function CreateCampaignPage() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Form data
  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [exclusiveTagFilter, setExclusiveTagFilter] = useState(true);
  const [selectedBot, setSelectedBot] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("14:00");
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [cancelUpon, setCancelUpon] = useState<string[]>([]);

  // Queries
  const { data: tagsData, isLoading: isLoadingTags } = useUmblerTags();
  const { data: contactsData, isLoading: isLoadingContacts } =
    useUmblerContacts({
      tagIds: selectedTags,
      exclusiveTag: exclusiveTagFilter,
    });
  const { data: botsData, isLoading: isLoadingBots } = useUmblerBots({
    hidden: false,
  });
  const { data: channelsData, isLoading: isLoadingChannels } =
    useUmblerChannels();

  const createCampaignMutation = useCreateCampaign();

  const tags = tagsData?.items || [];
  const contacts = contactsData?.items || [];
  const bots = botsData?.items || [];
  const channels = channelsData?.items || [];

  const selectedBotData = bots.find((b) => b.id === selectedBot);
  const selectedChannelData = channels.find((c) => c.id === selectedChannel);

  const canProceedStep1 = title.trim().length > 0;
  const canProceedStep2 = selectedTags.length > 0 && contacts.length > 0;
  const canProceedStep3 = selectedChannel.length > 0;
  const canProceedStep4 = selectedBot.length > 0 && selectedTrigger.length > 0;
  const canProceedStep5 = selectedDate && selectedTime;

  const getMinDateTime = () => {
    const now = new Date();
    return addMinutes(now, 2);
  };

  const isDateTimeValid = () => {
    if (!selectedDate || !selectedTime) return false;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    return scheduledDateTime >= getMinDateTime();
  };

  const handleCreateCampaign = async () => {
    if (!selectedDate || !selectedTime || !selectedChannelData?.phoneNumber)
      return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    try {
      await createCampaignMutation.mutateAsync({
        title,
        tagIds: selectedTags,
        exclusiveTagFilter,
        botId: selectedBot,
        botTriggerName: selectedTrigger,
        channelId: selectedChannel,
        fromPhone: selectedChannelData.phoneNumber,
        scheduledDate: scheduledDateTime.toISOString(),
        intervalSeconds,
        cancelUpon,
        organizationId: ORGANIZATION_ID,
      });

      setCurrentStep(6);
    } catch (error) {
      console.error("Erro ao criar campanha:", error);
    }
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Informações da Campanha
        </CardTitle>
        <CardDescription>
          Defina o nome e objetivo da sua campanha
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Nome da Campanha *</Label>
          <Input
            id="title"
            placeholder="Ex: Promoção Black Friday 2025"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Escolha um nome descritivo para identificar sua campanha
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Seleção de Contatos
        </CardTitle>
        <CardDescription>
          Escolha as tags para filtrar os destinatários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Tags *</Label>
          {isLoadingTags ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Carregando tags...
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.items.map((tag: Tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedTags((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="exclusive"
            checked={exclusiveTagFilter}
            onCheckedChange={(checked) =>
              setExclusiveTagFilter(checked === true)
            }
          />
          <Label
            htmlFor="exclusive"
            className="text-sm font-normal cursor-pointer"
          >
            Filtro exclusivo (contatos devem ter APENAS as tags selecionadas)
          </Label>
        </div>

        {isLoadingContacts ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              Carregando contatos...
            </span>
          </div>
        ) : (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              <strong>{contacts.length}</strong> contatos serão incluídos nesta
              campanha
              {exclusiveTagFilter && selectedTags.length > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Filtro exclusivo ativo - sem duplicatas
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Canal de Envio
        </CardTitle>
        <CardDescription>
          Selecione o canal WhatsApp para enviar as mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingChannels ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              Carregando canais...
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Canal *</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um canal" />
              </SelectTrigger>
              <SelectContent>
                {channels
                  .filter((c) => c.isActive)
                  .map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}{" "}
                      {channel.phoneNumber && `(${channel.phoneNumber})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Bot e Mensagem
        </CardTitle>
        <CardDescription>
          Escolha o bot e o gatilho para iniciar a conversa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingBots ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              Carregando bots...
            </span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Bot *</Label>
              <Select
                value={selectedBot}
                onValueChange={(value) => {
                  setSelectedBot(value);
                  setSelectedTrigger("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um bot" />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBotData && selectedBotData.manualStarts.length > 0 && (
              <div className="space-y-2">
                <Label>Gatilho *</Label>
                <Select
                  value={selectedTrigger}
                  onValueChange={setSelectedTrigger}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um gatilho" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedBotData.manualStarts.map((trigger) => (
                      <SelectItem key={trigger.id} value={trigger.name}>
                        {trigger.name}
                        {trigger.description && (
                          <span className="text-xs text-muted-foreground ml-2">
                            - {trigger.description}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  const renderStep5 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Agendamento
        </CardTitle>
        <CardDescription>
          Defina quando as mensagens serão enviadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate
                  ? format(selectedDate, "PPP", { locale: ptBR })
                  : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time">Horário *</Label>
          <Input
            id="time"
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            As mensagens começarão a ser enviadas neste horário
          </p>
        </div>

        {!isDateTimeValid() && selectedDate && selectedTime && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O horário de envio deve ser no mínimo 2 minutos no futuro
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="interval">Intervalo entre mensagens (segundos)</Label>
          <Input
            id="interval"
            type="number"
            min="1"
            max="60"
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Tempo de espera entre cada mensagem enviada (1-60 segundos)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Cancelar envio quando:</Label>
          <div className="space-y-2">
            {[
              { value: "contato", label: "Contato responder" },
              { value: "atendente", label: "Atendente responder" },
              { value: "conversa_finalizada", label: "Conversa finalizada" },
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={option.value}
                  checked={cancelUpon.includes(option.value)}
                  onCheckedChange={(checked) => {
                    setCancelUpon((prev) =>
                      checked
                        ? [...prev, option.value]
                        : prev.filter((v) => v !== option.value)
                    );
                  }}
                />
                <Label
                  htmlFor={option.value}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep6 = () => {
    const result = createCampaignMutation.data;

    if (!result) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Campanha Criada com Sucesso!
          </CardTitle>
          <CardDescription>
            Sua campanha foi agendada e as mensagens serão enviadas
            automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Título</p>
              <p className="font-medium">{result.campaign.title}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
              <p className="font-medium">{result.campaign.totalContacts}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Mensagens Agendadas
              </p>
              <p className="font-medium text-green-600">
                {result.campaign.scheduledMessages}
              </p>
            </div>
            {result.campaign.failedMessages > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="font-medium text-red-600">
                  {result.campaign.failedMessages}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Início</p>
              <p className="font-medium">
                {format(new Date(result.campaign.startDate), "PPp", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Término Estimado</p>
              <p className="font-medium">
                {format(new Date(result.campaign.endDate), "PPp", {
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              onClick={() => setLocation("/umbler/contacts")}
              className="w-full"
            >
              Voltar para Contatos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCurrentStep(1);
                setTitle("");
                setSelectedTags([]);
                setSelectedBot("");
                setSelectedTrigger("");
                setSelectedChannel("");
                setSelectedDate(undefined);
                setSelectedTime("14:00");
                setIntervalSeconds(5);
                setCancelUpon([]);
                createCampaignMutation.reset();
              }}
              className="w-full"
            >
              Criar Nova Campanha
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSummary = () => {
    if (!selectedDate || !selectedTime) return null;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Campanha</CardTitle>
          <CardDescription>
            Revise as informações antes de confirmar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Título</p>
              <p className="font-medium">{title}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tags Selecionadas</p>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tagId) => {
                  const tag = tags.find((t: Tag) => t.id === tagId);
                  return tag ? (
                    <Badge key={tagId} variant="secondary">
                      {tag.name}
                    </Badge>
                  ) : null;
                })}
              </div>
              {exclusiveTagFilter && (
                <Badge variant="outline" className="mt-1">
                  Filtro exclusivo ativo
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
              <p className="font-medium">{contacts.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Canal</p>
              <p className="font-medium">{selectedChannelData?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Bot</p>
              <p className="font-medium">{selectedBotData?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Gatilho</p>
              <p className="font-medium">{selectedTrigger}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Início do Envio</p>
              <p className="font-medium">
                {format(scheduledDateTime, "PPp", { locale: ptBR })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Intervalo</p>
              <p className="font-medium">
                {intervalSeconds} segundos entre mensagens
              </p>
            </div>
          </div>

          <Button
            onClick={handleCreateCampaign}
            disabled={createCampaignMutation.isPending || !isDateTimeValid()}
            className="w-full"
          >
            {createCampaignMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando campanha...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Confirmar e Criar Campanha
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/umbler/contacts")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Criar Campanha</h1>
          <p className="text-muted-foreground">
            Configure e agende mensagens em massa para seus contatos
          </p>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                currentStep >= step
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/50 text-muted-foreground"
              )}
            >
              {step}
            </div>
            {step < 5 && (
              <div
                className={cn(
                  "h-0.5 w-12 mx-2",
                  currentStep > step ? "bg-primary" : "bg-muted-foreground/50"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
      {currentStep === 5 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>{renderStep5()}</div>
          <div>{renderSummary()}</div>
        </div>
      )}
      {currentStep === 6 && renderStep6()}

      {/* Navigation Buttons */}
      {currentStep < 6 && (
        <div className="flex gap-2">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
          )}
          {currentStep < 5 && (
            <Button
              onClick={() => setCurrentStep((prev) => (prev + 1) as Step)}
              disabled={
                (currentStep === 1 && !canProceedStep1) ||
                (currentStep === 2 && !canProceedStep2) ||
                (currentStep === 3 && !canProceedStep3) ||
                (currentStep === 4 && !canProceedStep4)
              }
              className="ml-auto"
            >
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
