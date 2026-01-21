import { useState, useMemo, useEffect } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
  X,
  Check,
  ChevronDown,
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

const STEP_CONFIG = [
  { num: 1, label: "Info", icon: MessageSquare },
  { num: 2, label: "Contatos", icon: Users },
  { num: 3, label: "Canal", icon: MessageSquare },
  { num: 4, label: "Bot", icon: Bot },
  { num: 5, label: "Agenda", icon: Clock },
];

export default function CreateCampaignPage() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Form data
  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [debouncedTagSearchQuery, setDebouncedTagSearchQuery] = useState("");
  const [exclusiveTagFilter, setExclusiveTagFilter] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedBot, setSelectedBot] = useState("");
  const [botSearchQuery, setBotSearchQuery] = useState("");
  const [debouncedBotSearchQuery, setDebouncedBotSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("14:00");
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [cancelUpon, setCancelUpon] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [fetchAllContacts, setFetchAllContacts] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50); // Limite de contatos exibidos na lista

  // Debounce search queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTagSearchQuery(tagSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [tagSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBotSearchQuery(botSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [botSearchQuery]);

  // Queries
  const { data: tagsData, isLoading: isLoadingTags } = useUmblerTags({
    query: debouncedTagSearchQuery,
  });
  const { data: contactsData, isLoading: isLoadingContacts } =
    useUmblerContacts({
      tagIds: selectedTags,
      exclusiveTag: exclusiveTagFilter,
      fetchAll: fetchAllContacts,
    });
  const {
    data: botsData,
    isLoading: isLoadingBots,
    error: botsError,
  } = useUmblerBots({
    hidden: false,
    query: debouncedBotSearchQuery,
  });
  const { data: channelsData, isLoading: isLoadingChannels } =
    useUmblerChannels();

  const createCampaignMutation = useCreateCampaign();

  // Check if any critical data is still loading (only initial load, not search)
  const isInitialLoading = isLoadingChannels;

  // Memoized data
  const tags = useMemo(() => tagsData?.items || [], [tagsData]);
  const contacts = useMemo(() => contactsData?.items || [], [contactsData]);
  const bots = useMemo(() => botsData?.result || [], [botsData]);
  const channels = useMemo(() => channelsData || [], [channelsData]);

  // Contatos exibidos na lista (limitado para performance)
  const displayedContacts = useMemo(
    () => contacts.slice(0, displayLimit),
    [contacts, displayLimit],
  );

  const selectedBotData = useMemo(
    () => bots.find((b) => b.botId === selectedBot),
    [bots, selectedBot],
  );

  const selectedChannelData = useMemo(
    () => channels.find((c) => c.id === selectedChannel),
    [channels, selectedChannel],
  );

  const activeChannels = useMemo(
    () => channels.filter((c) => c.state === "Live"),
    [channels],
  );

  // Auto-selecionar todos os contatos quando a lista mudar (APENAS no modo rápido)
  useEffect(() => {
    // Só auto-seleciona se não estiver em modo fetchAll (para evitar travamento com muitos contatos)
    if (contacts.length > 0 && !fetchAllContacts) {
      const contactIds = contacts.map((c: any) => c.id);
      setSelectedContacts(contactIds);
    } else if (contacts.length === 0) {
      setSelectedContacts([]);
    }
  }, [contacts, fetchAllContacts]);

  // Resetar fetchAllContacts quando as tags mudarem
  useEffect(() => {
    setFetchAllContacts(false);
  }, [selectedTags, exclusiveTagFilter]);

  // Simular progresso durante o carregamento de contatos
  useEffect(() => {
    if (isLoadingContacts) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev; // Para em 90% até terminar de fato
          return prev + Math.random() * 15;
        });
      }, 300);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100);
      const timeout = setTimeout(() => setLoadingProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoadingContacts]);

  // Validation
  const canProceedStep1 = title.trim().length > 0;
  const canProceedStep2 =
    selectedTags.length > 0 && selectedContacts.length > 0;
  const canProceedStep3 = selectedChannel.length > 0;
  const canProceedStep4 = selectedBot.length > 0;
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
    // Validações
    if (!title.trim()) {
      alert("Título da campanha é obrigatório");
      return;
    }

    if (selectedTags.length === 0) {
      alert("Selecione pelo menos uma tag");
      return;
    }

    if (selectedContacts.length === 0) {
      alert("Selecione pelo menos um contato para receber a campanha");
      return;
    }

    if (!selectedChannel) {
      alert("Selecione um canal de envio");
      return;
    }

    if (!selectedBot) {
      alert("Selecione um bot");
      return;
    }

    if (!selectedDate || !selectedTime) {
      alert("Data e horário de envio são obrigatórios");
      return;
    }

    if (intervalSeconds < 1 || intervalSeconds > 60) {
      alert("Intervalo entre mensagens deve estar entre 1 e 60 segundos");
      return;
    }

    if (!isDateTimeValid()) {
      alert("O horário de envio deve ser no mínimo 2 minutos no futuro");
      return;
    }

    if (!selectedChannelData?.phoneNumber) {
      alert("Canal selecionado não possui número de telefone configurado");
      return;
    }

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    try {
      await createCampaignMutation.mutateAsync({
        title: title.trim(),
        tagIds: selectedTags,
        contactIds: selectedContacts, // Enviar apenas os contatos selecionados
        exclusiveTagFilter,
        botId: selectedBot,
        botTriggerName: "Início", // triggerName é sempre "Início"
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
      alert(
        `Erro ao criar campanha: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`,
      );
    }
  };

  const renderStep1 = () => (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
        <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-slate-100">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          Informações da Campanha
        </CardTitle>
        <CardDescription className="text-base text-gray-600 dark:text-slate-400">
          Defina o nome e objetivo da sua campanha
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <Label
            htmlFor="title"
            className="text-base font-semibold text-gray-900 dark:text-slate-100"
          >
            Nome da Campanha *
          </Label>
          <Input
            id="title"
            placeholder="Ex: Promoção Black Friday 2025"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 text-base"
            maxLength={100}
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Escolha um nome descritivo para identificar sua campanha
            </p>
            <span className="text-xs text-gray-500 dark:text-slate-500 shrink-0 ml-2">
              {title.length}/100
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => {
    const toggleTag = (tagId: string) => {
      setSelectedTags((prev) =>
        prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId],
      );
    };

    return (
      <Card className="shadow-sm">
        <CardHeader className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-slate-100">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Seleção de Contatos
          </CardTitle>
          <CardDescription className="text-base dark:text-slate-400">
            Escolha as tags para filtrar os destinatários da campanha
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-base font-semibold text-gray-900 dark:text-slate-100">
                Tags *
              </Label>
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {selectedTags.length}{" "}
                  {selectedTags.length === 1
                    ? "tag selecionada"
                    : "tags selecionadas"}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {/* Tags selecionadas */}
              {selectedTags.length > 0 && (
                <div className="relative">
                  <div className="absolute -top-2 left-3 px-2 bg-background dark:bg-slate-900 z-10">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                      Tags Selecionadas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
                    {selectedTags.map((tagId) => {
                      const tag = Array.isArray(tags)
                        ? tags.find((t: Tag) => t.id === tagId)
                        : null;
                      if (!tag) return null;
                      return (
                        <Badge
                          key={tagId}
                          variant="default"
                          className="cursor-pointer hover:opacity-80 transition-opacity pl-3 pr-2 py-1.5 text-sm shadow-sm"
                          onClick={() => toggleTag(tagId)}
                        >
                          {tag.name}
                          <X className="ml-1.5 h-3.5 w-3.5" />
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Command para pesquisar tags */}
              <div className="relative">
                <div className="absolute -top-2 left-3 px-2 bg-background dark:bg-slate-900 z-10">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                    Buscar Tags
                  </span>
                </div>
                <Command
                  shouldFilter={false}
                  className="border-2 border-gray-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="relative">
                    <CommandInput
                      placeholder="Digite para pesquisar tags..."
                      value={tagSearchQuery}
                      onValueChange={setTagSearchQuery}
                      className="h-12 text-base dark:text-slate-200"
                    />
                    {isLoadingTags &&
                      tagSearchQuery !== debouncedTagSearchQuery && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                  </div>
                  <CommandEmpty className="py-6 text-center text-sm text-gray-600 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                      <p>Nenhuma tag encontrada</p>
                    </div>
                  </CommandEmpty>
                  <CommandGroup className="p-2">
                    <ScrollArea className="h-64">
                      {isLoadingTags &&
                      tagSearchQuery === debouncedTagSearchQuery ? (
                        <div className="flex items-center justify-center gap-2 py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            Buscando tags...
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {tags.map((tag: Tag) => {
                            const isSelected = selectedTags.includes(tag.id);
                            return (
                              <CommandItem
                                key={tag.id}
                                onSelect={() => toggleTag(tag.id)}
                                className={cn(
                                  "cursor-pointer rounded-lg px-3 py-3 transition-all",
                                  isSelected &&
                                    "bg-blue-50 dark:bg-blue-950/30",
                                )}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div
                                    className={cn(
                                      "h-5 w-5 border-2 rounded-md flex items-center justify-center transition-all shadow-sm",
                                      isSelected
                                        ? "bg-primary border-primary scale-110"
                                        : "border-muted-foreground/50 hover:border-primary/50",
                                    )}
                                  >
                                    {isSelected && (
                                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                    )}
                                  </div>
                                  <span
                                    className={cn(
                                      "text-sm",
                                      isSelected && "font-medium",
                                    )}
                                  >
                                    {tag.name}
                                  </span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-start space-x-3 p-4 bg-muted/50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
            <Checkbox
              id="exclusive"
              checked={exclusiveTagFilter}
              onCheckedChange={(checked) =>
                setExclusiveTagFilter(checked === true)
              }
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="exclusive"
                className="text-sm font-medium text-gray-900 dark:text-slate-100 cursor-pointer leading-relaxed flex items-center gap-2"
              >
                Filtro exclusivo de tags
                {exclusiveTagFilter && (
                  <Badge variant="default" className="text-xs">
                    Ativo
                  </Badge>
                )}
              </Label>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                {exclusiveTagFilter
                  ? "✓ Apenas contatos que possuem SOMENTE as tags selecionadas (sem tags extras)"
                  : "Contatos que possuem PELO MENOS uma das tags selecionadas (podem ter outras tags)"}
              </p>
            </div>
          </div>

          {selectedTags.length > 0 && (
            <>
              <Separator />
              {isLoadingContacts ? (
                <div className="space-y-4 p-8 border border-gray-200 dark:border-slate-700 rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-background dark:bg-slate-900" />
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                        Buscando todos os contatos...
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        Carregando em páginas de 220 contatos
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
                      <span>Progresso</span>
                      <span className="font-mono font-semibold">
                        {Math.round(loadingProgress)}%
                      </span>
                    </div>
                    <Progress value={loadingProgress} className="h-2" />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-blue-400 animate-pulse" />
                    <span>Aguarde enquanto processamos sua solicitação...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {selectedContacts.length}
                          </span>
                          <span className="text-sm text-green-700/80 dark:text-green-400/80">
                            de {contacts.length} selecionado
                            {selectedContacts.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {exclusiveTagFilter && (
                          <div className="flex items-center gap-1.5 text-xs text-green-700/70 dark:text-green-400/70">
                            <Check className="h-3 w-3" />
                            <span>Filtro exclusivo ativo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!fetchAllContacts) {
                            // Ativar busca paginada completa
                            setFetchAllContacts(true);
                          } else {
                            // Já tem todos, só selecionar
                            const allIds = contacts.map((c: any) => c.id);
                            setSelectedContacts(allIds);
                          }
                        }}
                        disabled={
                          isLoadingContacts ||
                          (fetchAllContacts &&
                            selectedContacts.length === contacts.length)
                        }
                        className="h-8"
                      >
                        {isLoadingContacts && fetchAllContacts ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          "Selecionar Todos"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedContacts([])}
                        disabled={selectedContacts.length === 0}
                        className="h-8"
                      >
                        Limpar Seleção
                      </Button>
                    </div>
                  </div>

                  {/* Metadados de performance */}
                  {contactsData?.metadata && (
                    <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                      <AlertDescription className="text-xs text-gray-600 dark:text-slate-400">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span>
                            ✓ Carregado em {contactsData.metadata.pages} página
                            {contactsData.metadata.pages !== 1 ? "s" : ""}
                          </span>
                          {contactsData.metadata.fetchedCount !==
                            contactsData.metadata.filteredCount && (
                            <span>
                              • {contactsData.metadata.fetchedCount} contatos
                              buscados
                            </span>
                          )}
                          {!fetchAllContacts &&
                            contactsData.totalCount >= 220 && (
                              <span className="text-orange-600 dark:text-orange-400 font-medium">
                                • Clique em "Selecionar Todos" para carregar
                                mais contatos
                              </span>
                            )}
                          <span>• Processado com sucesso</span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Lista de contatos encontrados */}
                  {contacts.length > 0 && (
                    <div className="relative">
                      <div className="absolute -top-2 left-3 px-2 bg-background dark:bg-slate-900 z-10">
                        <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                          Destinatários da Campanha
                        </span>
                      </div>
                      <div className="border-2 border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                          <span className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                            Lista de Contatos
                          </span>
                          <Badge variant="outline" className="font-mono">
                            {contacts.length}
                          </Badge>
                        </div>
                        <ScrollArea className="h-80">
                          <div className="p-3 space-y-2">
                            {displayedContacts.map(
                              (contact: any, index: number) => {
                                const isSelected = selectedContacts.includes(
                                  contact.id,
                                );
                                return (
                                  <div
                                    key={contact.id}
                                    onClick={() => {
                                      setSelectedContacts((prev) =>
                                        prev.includes(contact.id)
                                          ? prev.filter(
                                              (id) => id !== contact.id,
                                            )
                                          : [...prev, contact.id],
                                      );
                                    }}
                                    className={cn(
                                      "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group",
                                      isSelected
                                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                                        : "hover:bg-muted/70 border-transparent hover:border-border",
                                    )}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => {
                                          setSelectedContacts((prev) =>
                                            prev.includes(contact.id)
                                              ? prev.filter(
                                                  (id) => id !== contact.id,
                                                )
                                              : [...prev, contact.id],
                                          );
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0"
                                      />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span
                                          className={cn(
                                            "font-medium text-sm truncate transition-colors",
                                            isSelected &&
                                              "text-green-700 dark:text-green-400",
                                          )}
                                        >
                                          {contact.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground dark:text-slate-200 font-mono truncate">
                                          {contact.phoneNumber}
                                        </span>

                                        {contact.tags &&
                                          contact.tags.length > 0 && (
                                            <div>
                                              {contact.tags.map((tag) => (
                                                <Badge
                                                  variant="outline"
                                                  key={tag.id}
                                                >
                                                  {tag.name}
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                    {contact.tags &&
                                      contact.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[40%] ml-2">
                                          {contact.tags.map((tagId: string) => {
                                            const tag = Array.isArray(tags)
                                              ? tags.find(
                                                  (t: Tag) => t.id === tagId,
                                                )
                                              : null;
                                            return tag ? (
                                              <Badge
                                                key={tagId}
                                                variant={
                                                  selectedTags.includes(tagId)
                                                    ? "default"
                                                    : "outline"
                                                }
                                                className="text-xs px-2 py-0.5"
                                              >
                                                {tag.name}
                                              </Badge>
                                            ) : null;
                                          })}
                                        </div>
                                      )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </ScrollArea>

                        {/* Virtual rendering controls */}
                        {contacts.length > displayLimit && (
                          <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-muted/30 dark:bg-slate-800/30">
                            <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">
                              Exibindo {displayLimit} de {contacts.length}{" "}
                              contatos
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setDisplayLimit((prev) => prev + 50)
                              }
                              className="w-full"
                            >
                              <ChevronDown className="w-3 h-3 mr-1" />
                              Carregar mais 50 contatos
                            </Button>
                          </div>
                        )}
                        {contacts.length > 0 &&
                          displayLimit >= contacts.length && (
                            <div className="p-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-center text-gray-600 dark:text-slate-400">
                                Exibindo todos os {contacts.length} contatos
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep3 = () => {
    return (
      <Card className="shadow-sm">
        <CardHeader className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20">
          <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-slate-100">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            Canal de Envio
          </CardTitle>
          <CardDescription className="text-base dark:text-slate-400">
            Selecione o canal WhatsApp para enviar as mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isLoadingChannels ? (
            <div className="flex items-center gap-3 p-8 justify-center border rounded-xl bg-muted/30">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Carregando canais disponíveis...
              </span>
            </div>
          ) : activeChannels.length === 0 ? (
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum canal ativo encontrado. Configure um canal WhatsApp antes
                de criar campanhas.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-base font-semibold text-gray-900 dark:text-slate-100">
                  Canal *
                </Label>
                <Badge variant="secondary" className="font-normal">
                  {activeChannels.length}{" "}
                  {activeChannels.length === 1
                    ? "canal disponível"
                    : "canais disponíveis"}
                </Badge>
              </div>
              <Select
                value={selectedChannel}
                onValueChange={setSelectedChannel}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione um canal WhatsApp" />
                </SelectTrigger>
                <SelectContent>
                  {activeChannels.map((channel) => (
                    <SelectItem
                      key={channel.id}
                      value={channel.id}
                      className="py-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{channel.name}</span>
                        {channel.phoneNumber && (
                          <span className="text-xs text-muted-foreground">
                            {channel.phoneNumber}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedChannelData && (
                <Alert className="border-2 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-sm">
                    Canal selecionado:{" "}
                    <strong>{selectedChannelData.name}</strong>
                    {selectedChannelData.phoneNumber && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        Número: {selectedChannelData.phoneNumber}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep4 = () => {
    return (
      <Card className="shadow-sm">
        <CardHeader className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-slate-100">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Bot className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            Bot e Mensagem
          </CardTitle>
          <CardDescription className="text-base dark:text-slate-400">
            Escolha o bot e o gatilho para iniciar a conversa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {botsError ? (
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Erro ao carregar bots:</strong>{" "}
                {botsError instanceof Error
                  ? botsError.message
                  : "Erro desconhecido"}
                <br />
                <span className="text-xs mt-2 block">
                  Verifique o console do navegador e do servidor para mais
                  detalhes.
                </span>
              </AlertDescription>
            </Alert>
          ) : isLoadingBots ? (
            <div className="flex items-center gap-3 p-8 justify-center border rounded-xl bg-muted/30">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Carregando bots disponíveis...
              </span>
            </div>
          ) : bots.length === 0 ? (
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum bot encontrado. Crie um bot antes de configurar
                campanhas.
                {botsData && (
                  <span className="text-xs mt-2 block">
                    Debug: botsData = {JSON.stringify(botsData)}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-base font-semibold text-gray-900 dark:text-slate-100">
                    Bot *
                  </Label>
                  <Badge variant="secondary" className="font-normal">
                    {bots.length}{" "}
                    {bots.length === 1 ? "bot disponível" : "bots disponíveis"}
                  </Badge>
                </div>

                {/* Selected Bot Display */}
                {selectedBot && selectedBotData && (
                  <div className="relative">
                    <div className="absolute -top-2 left-3 px-2 bg-background z-10">
                      <span className="text-xs font-medium dark:text-slate-300 text-muted-foreground">
                        Bot Selecionado
                      </span>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                            <Bot className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold dark:text-slate-200 text-base">
                              {selectedBotData.botTitle}
                            </span>
                            <span className="text-xs dark:text-slate-400">
                              Gatilho: Início
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBot("");
                          }}
                          className="h-8 hover:bg-orange-100 dark:hover:bg-orange-900"
                        >
                          <X className="h-4 w-4 dark:text-slate-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bot Search Command */}
                {!selectedBot && (
                  <div className="relative">
                    <div className="absolute -top-2 left-3 px-2 bg-background z-10">
                      <span className="text-xs font-medium dark:text-slate-300 text-muted-foreground">
                        Selecionar Bot
                      </span>
                    </div>
                    <div className="border-2 rounded-xl dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="p-3 border-b bg-muted/30">
                        <div className="relative">
                          <Input
                            placeholder="Digite para pesquisar bots..."
                            value={botSearchQuery}
                            onChange={(e) => setBotSearchQuery(e.target.value)}
                            className="h-10"
                          />
                          {isLoadingBots &&
                            botSearchQuery !== debouncedBotSearchQuery && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-slate-400" />
                              </div>
                            )}
                        </div>
                      </div>
                      {isLoadingBots &&
                      botSearchQuery === debouncedBotSearchQuery ? (
                        <div className="py-8 flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground dark:text-slate-400">
                            Buscando bots...
                          </span>
                        </div>
                      ) : bots.length === 0 ? (
                        <div className="py-8 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8 text-muted-foreground/50 dark:text-slate-400" />
                            <p className="text-sm text-muted-foreground dark:text-slate-400">
                              {botSearchQuery
                                ? "Nenhum bot encontrado com este nome"
                                : "Nenhum bot disponível"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <ScrollArea className="h-64">
                          <div className="p-2 space-y-1">
                            {bots.map((bot) => (
                              <div
                                key={bot.botId}
                                onClick={() => {
                                  setSelectedBot(bot.botId);
                                }}
                                className="cursor-pointer rounded-lg px-3 py-3 transition-all hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-transparent hover:border-orange-200 dark:hover:border-orange-800 group"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg group-hover:scale-110 transition-transform">
                                    <Bot className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium text-sm dark:text-slate-200 truncate">
                                      {bot.botTitle}
                                    </span>
                                    <span className="text-xs dark:text-slate-400">
                                      Gatilho: Início
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStep5 = () => (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20">
        <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-slate-100">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
            <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          Agendamento
        </CardTitle>
        <CardDescription className="text-base text-gray-600 dark:text-slate-400">
          Defina quando e como as mensagens serão enviadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Data de Início *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal text-base",
                    !selectedDate && "text-muted-foreground",
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
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="time"
              className="text-base font-semibold text-gray-900 dark:text-slate-100"
            >
              Horário *
            </Label>
            <Input
              id="time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="h-12 text-base"
            />
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-slate-400 bg-muted/50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
          💡 As mensagens começarão a ser enviadas na data e horário
          especificados
        </p>

        {!isDateTimeValid() && selectedDate && selectedTime && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O horário de envio deve ser no mínimo 2 minutos no futuro
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="space-y-3">
          <Label
            htmlFor="interval"
            className="text-base font-semibold text-gray-900 dark:text-slate-100"
          >
            Intervalo entre mensagens
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="interval"
              type="number"
              min="1"
              max="60"
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              className="h-12 text-base max-w-[120px]"
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">
              segundos
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-400">
            ⏱️ Tempo de espera entre cada mensagem (recomendado: 5-10 segundos)
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Cancelar envio automaticamente quando:
          </Label>
          <div className="space-y-3 p-4 bg-muted/50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
            {[
              { value: "contato", label: "Contato responder", icon: "💬" },
              { value: "atendente", label: "Atendente responder", icon: "👤" },
              {
                value: "conversa_finalizada",
                label: "Conversa finalizada",
                icon: "✅",
              },
            ].map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-3 p-2 hover:bg-background rounded-lg transition-colors"
              >
                <Checkbox
                  id={option.value}
                  checked={cancelUpon.includes(option.value)}
                  onCheckedChange={(checked) => {
                    setCancelUpon((prev) =>
                      checked
                        ? [...prev, option.value]
                        : prev.filter((v) => v !== option.value),
                    );
                  }}
                />
                <Label
                  htmlFor={option.value}
                  className="text-sm font-normal cursor-pointer flex items-center gap-2 flex-1"
                >
                  <span>{option.icon}</span>
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
      <Card className="shadow-lg border-2 border-green-200 dark:border-green-800">
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">
            Campanha Criada com Sucesso!
          </CardTitle>
          <CardDescription className="text-center text-base">
            Sua campanha foi agendada e as mensagens serão enviadas
            automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Título</p>
              <p className="font-medium">{result.campaign.title}</p>
            </div>
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
              <p className="font-medium text-lg">
                {result.campaign.totalContacts}
              </p>
            </div>
            <div className="space-y-1 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground">
                Mensagens Agendadas
              </p>
              <p className="font-bold text-lg text-green-600 dark:text-green-400">
                {result.campaign.scheduledMessages}
              </p>
            </div>
            {result.campaign.failedMessages > 0 && (
              <div className="space-y-1 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="font-bold text-lg text-red-600 dark:text-red-400">
                  {result.campaign.failedMessages}
                </p>
              </div>
            )}
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Início</p>
              <p className="font-medium">
                {format(new Date(result.campaign.startDate), "PPp", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Término Estimado</p>
              <p className="font-medium">
                {format(new Date(result.campaign.endDate), "PPp", {
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => setLocation("/umbler/campaigns")}
              className="h-12"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Ver Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCurrentStep(1);
                setTitle("");
                setSelectedTags([]);
                setSelectedContacts([]);
                setSelectedBot("");
                setSelectedChannel("");
                setSelectedDate(undefined);
                setSelectedTime("14:00");
                setIntervalSeconds(5);
                setCancelUpon([]);
                createCampaignMutation.reset();
              }}
              className="h-12"
            >
              <Send className="mr-2 h-4 w-4" />
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
      <Card className="shadow-sm sticky top-6">
        <CardHeader className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
          <CardTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-slate-100">
            <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            Resumo da Campanha
          </CardTitle>
          <CardDescription className="text-base dark:text-slate-400">
            Revise as informações antes de confirmar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Título
              </p>
              <p className="font-medium text-gray-900 dark:text-slate-100">
                {title}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Tags Selecionadas
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tagId) => {
                  const tag = Array.isArray(tags)
                    ? tags.find((t: Tag) => t.id === tagId)
                    : null;
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Contatos Selecionados
                </p>
                <Badge variant="secondary" className="font-mono">
                  {selectedContacts.length}
                </Badge>
              </div>
              {selectedContacts.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                  <div className="divide-y">
                    {selectedContacts.map((contactId) => {
                      const contact = contacts.find(
                        (c: any) => c.id === contactId,
                      );
                      if (!contact) return null;
                      return (
                        <div
                          key={contactId}
                          className="px-3 py-2 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate dark:text-slate-200">
                                {contact.name}
                              </p>
                              <p className="text-xs text-muted-foreground dark:text-slate-400 font-mono">
                                {contact.phoneNumber}
                              </p>
                            </div>
                            {contact.tags && contact.tags.length > 0 && (
                              <div className="flex gap-1 flex-wrap justify-end">
                                {contact.tags.slice(0, 2).map((tagId: any) => {
                                  const tagIdStr =
                                    typeof tagId === "string"
                                      ? tagId
                                      : tagId.id;
                                  const tag = tags.find(
                                    (t: Tag) => t.id === tagIdStr,
                                  );
                                  return tag ? (
                                    <Badge
                                      key={tagIdStr}
                                      variant="outline"
                                      className="text-xs px-1.5 py-0"
                                    >
                                      {tag.name}
                                    </Badge>
                                  ) : null;
                                })}
                                {contact.tags.length > 2 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-1.5 py-0"
                                  >
                                    +{contact.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-slate-400">Canal</p>
              <p className="font-medium text-gray-900 dark:text-slate-100">
                {selectedChannelData?.name}
              </p>
              {selectedChannelData?.phoneNumber && (
                <p className="text-xs text-gray-600 dark:text-slate-400 font-mono">
                  {selectedChannelData.phoneNumber}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground dark:text-slate-200">
                Bot
              </p>
              {selectedBotData && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg shrink-0">
                      <Bot className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate dark:text-slate-200">
                        {selectedBotData.botTitle}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">
                        Gatilho: Início
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground dark:text-slate-200">
                Início do Envio
              </p>
              <p className="font-medium dark:text-slate-400">
                {format(scheduledDateTime, "PPp", { locale: ptBR })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground dark:text-slate-200">
                Intervalo
              </p>
              <p className="font-medium dark:text-slate-400">
                {intervalSeconds} segundos entre mensagens
              </p>
            </div>
          </div>

          <Separator />

          <Button
            onClick={handleCreateCampaign}
            disabled={createCampaignMutation.isPending || !isDateTimeValid()}
            className="w-full h-12 text-base"
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
    <div className="container mx-auto py-4 md:py-6 space-y-6 max-w-7xl px-4">
      <div className="flex items-center gap-3 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/umbler/contacts")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 dark:text-slate-100" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-slate-100 font-bold truncate">
            Criar Campanha
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 md:text-base">
            Configure e agende mensagens em massa para seus contatos
          </p>
        </div>
      </div>

      {/* Loading inicial */}
      {isInitialLoading ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-slate-100">
                Carregando informações...
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Preparando tags, canais e bots disponíveis
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Steps Progress */}
          <div className="flex items-center p-4 justify-between overflow-x-auto pb-2 scrollbar-hide">
            {STEP_CONFIG.map((step, index) => (
              <div key={step.num} className="flex items-center shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                      currentStep >= step.num
                        ? "border-primary dark:border-slate-500 bg-primary text-primary-foreground shadow-lg scale-110"
                        : "border-muted-foreground/50 dark:border-slate-400 dark:text-slate-400  text-muted-foreground",
                      currentStep === step.num && "ring-4 ring-primary/20",
                    )}
                  >
                    {currentStep > step.num ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.num
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden md:block",
                      currentStep >= step.num
                        ? "text-primary dark:text-blue-400"
                        : "text-muted-foreground dark:text-slate-400",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEP_CONFIG.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-8 md:w-16 mx-2 transition-all",
                      currentStep > step.num
                        ? "bg-primary"
                        : "bg-muted-foreground/50",
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
            <div className="flex gap-3 bg-background/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 -mx-4 border-t border-gray-200 dark:border-slate-700 shadow-lg">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
                  className="h-12 min-w-[120px]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                  <span className="sm:hidden">Voltar</span>
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
                  className="ml-auto h-12 min-w-[120px]"
                >
                  <span className="hidden sm:inline">Próximo</span>
                  <span className="sm:hidden">Avançar</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
