import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Wine,
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Copy,
  Check,
  Settings,
  Save,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GeneratedMessage {
  id: string;
  type: string;
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedMessages, setGeneratedMessages] = useState<
    GeneratedMessage[]
  >([]);
  const [messageType, setMessageType] = useState("prospeccao");
  const [clientName, setClientName] = useState("");
  const [messageContext, setMessageContext] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState({
    personality: "profissional", // profissional, amigavel, formal, casual
    messageLength: "medio", // curto, medio, longo
    creativity: 70, // 0-100
    useEmojis: true,
    wineExpertise: "intermediario", // iniciante, intermediario, especialista
    customPrompt: "",
    temperature: 0.7, // 0-1
    maxTokens: 500,
    responseStyle: "consultivo", // consultivo, vendas, educativo
  });

  const { toast } = useToast();

  const saveAiConfig = () => {
    // Salvar configuração no localStorage
    localStorage.setItem("ai-config", JSON.stringify(aiConfig));
    toast({
      title: "Configuração salva!",
      description: "As configurações da IA foram atualizadas com sucesso.",
    });
  };

  // Carregar configuração ao inicializar
  useEffect(() => {
    const savedConfig = localStorage.getItem("ai-config");
    if (savedConfig) {
      setAiConfig(JSON.parse(savedConfig));
    }
  }, []);

  // Simulação de respostas do assistente de vinhos
  const wineKnowledge = {
    harmonizacao:
      "Para harmonizar vinhos, considere: carnes vermelhas combinam com tintos encorpados, peixes com brancos secos, queijos com tintos suaves ou brancos aromáticos.",
    temperatura:
      "Temperaturas ideais: tintos jovens 16-18°C, tintos maduros 18-20°C, brancos secos 8-12°C, espumantes 6-8°C.",
    guarda:
      "Para guarda adequada: local escuro, umidade 70%, temperatura constante 12-14°C, garrafas deitadas.",
    regioes:
      "Principais regiões: Bordeaux (França) - tintos elegantes, Toscana (Itália) - Chianti, Vale do Douro (Portugal) - vinhos fortificados, Serra Gaúcha (Brasil) - espumantes.",
    tipos:
      "Tipos de vinho: tintos (fermentação com casca), brancos (sem casca), rosés (pouco contato com casca), espumantes (segunda fermentação).",
  };

  const handleWineChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    const currentInput = chatInput;
    setChatInput("");

    try {
      // Chamar API de IA real
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          context: "wine_expert",
          conversationHistory: chatMessages.slice(-5), // Últimas 5 mensagens para contexto
          aiConfig: aiConfig, // Enviar configurações da IA
        }),
      });

      if (!response.ok) {
        throw new Error("Falha na comunicação com a IA");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content:
          data.response ||
          "Desculpe, não consegui processar sua pergunta no momento.",
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Erro ao chamar IA:", error);

      // Fallback para conhecimento local
      let response =
        "Desculpe, estou com dificuldades técnicas. Posso ajudar com harmonizações, temperaturas de serviço, guarda de vinhos, regiões produtoras ou tipos de vinho.";

      const input = currentInput.toLowerCase();
      if (input.includes("harmoniza") || input.includes("combina")) {
        response = wineKnowledge.harmonizacao;
      } else if (input.includes("temperatura")) {
        response = wineKnowledge.temperatura;
      } else if (input.includes("guarda") || input.includes("armazen")) {
        response = wineKnowledge.guarda;
      } else if (input.includes("região") || input.includes("origem")) {
        response = wineKnowledge.regioes;
      } else if (input.includes("tipo") || input.includes("categoria")) {
        response = wineKnowledge.tipos;
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMessage = async () => {
    if (!clientName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Gerar mensagem com IA
      const response = await fetch("/api/ai/generate-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName,
          messageType,
          context: messageContext,
          industry: "wine_business",
          aiConfig: aiConfig, // Enviar configurações da IA
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao gerar mensagem");
      }

      const data = await response.json();

      const newMessage: GeneratedMessage = {
        id: Date.now().toString(),
        type: messageType,
        content: data.message,
        timestamp: new Date(),
      };

      setGeneratedMessages((prev) => [newMessage, ...prev]);

      toast({
        title: "Mensagem gerada com IA!",
        description: "Sua mensagem personalizada foi criada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar mensagem:", error);

      // Fallback para templates estáticos
      const messageTemplates = {
        prospeccao: `Olá ${clientName}! 🍷\n\nSou especialista em vinhos e gostaria de apresentar nossa seleção exclusiva de rótulos premium. Temos opções que se adequam a diferentes paladares e ocasiões especiais.\n\nPodemos agendar uma conversa para conhecer suas preferências? Tenho certeza que encontraremos o vinho perfeito para você!\n\nUm brinde aos bons momentos! 🥂`,

        followup: `Oi ${clientName}! 😊\n\nEspero que esteja aproveitando o vinho que adquiriu conosco! Como foi a experiência?\n\n${
          messageContext
            ? `Lembrei que você mencionou interesse em ${messageContext}, `
            : ""
        }Tenho algumas novidades que podem te interessar:\n\n🍷 Novos rótulos chegaram\n🎯 Ofertas especiais para clientes fiéis\n📚 Dicas de harmonização\n\nQue tal conversarmos sobre suas próximas escolhas?`,

        oferta: `${clientName}, oportunidade especial! 🌟\n\nTemos uma seleção limitada de vinhos premium com condições exclusivas:\n\n🍷 Descontos especiais\n📦 Frete grátis para compras acima de R$ 200\n🎁 Brinde surpresa\n\n${
          messageContext ? `Considerando seu gosto por ${messageContext}, ` : ""
        }Separei algumas opções que vão te surpreender!\n\nOferta válida por tempo limitado. Vamos conversar?`,

        aniversario: `Parabéns, ${clientName}! 🎉🍷\n\nUm brinde ao seu dia especial! Para celebrar esta data única, que tal um vinho excepcional?\n\nTenho sugestões perfeitas para tornar sua comemoração ainda mais especial:\n\n🥂 Espumantes premium\n🍾 Vinhos de safras especiais\n🎁 Embalagem gift exclusiva\n\nSeu aniversário merece um brinde à altura! Vamos escolher juntos?`,
      };

      const newMessage: GeneratedMessage = {
        id: Date.now().toString(),
        type: messageType,
        content: messageTemplates[messageType as keyof typeof messageTemplates],
        timestamp: new Date(),
      };

      setGeneratedMessages((prev) => [newMessage, ...prev]);

      toast({
        title: "Mensagem gerada!",
        description: "Usando template padrão devido a problemas técnicos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Copiado!",
        description: "Mensagem copiada para a área de transferência.",
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar a mensagem.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex">
      <div className="flex-1">
        <div className="space-y-6">
          <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-4">
                <Sparkles className="size-6 shrink-0 text-blue-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Assistente de IA
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Ferramentas inteligentes para seu negócio de vinhos
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="wine-assistant" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <TabsTrigger
                value="wine-assistant"
                className="group flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2 text-center font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-white dark:hover:bg-gray-700/50 hover:shadow-sm min-w-0"
              >
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg  group-data-[state=active]:bg-white/20 transition-colors shrink-0">
                  <Wine className="h-4 w-4 text-purple-600 dark:text-purple-400 group-data-[state=active]:text-white" />
                </div>
                <span className="truncate text-sm sm:text-base">
                  Assistente Virtual do Vinho
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="message-generator"
                className="group flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2 text-center font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-white dark:hover:bg-gray-700/50 hover:shadow-sm min-w-0"
              >
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg  group-data-[state=active]:bg-white/20 transition-colors shrink-0">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 group-data-[state=active]:text-white" />
                </div>
                <span className="truncate text-sm sm:text-base">
                  Gerador de Mensagens
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="ai-config"
                className="group flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2 text-center font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-white dark:hover:bg-gray-700/50 hover:shadow-sm min-w-0"
              >
                <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg  group-data-[state=active]:bg-white/20 transition-colors shrink-0">
                  <Settings className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-data-[state=active]:text-white" />
                </div>
                <span className="truncate text-sm sm:text-base">
                  Configurações da IA
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Assistente Virtual do Vinho */}
            <TabsContent value="wine-assistant">
              <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-t-xl border-b border-purple-100 dark:border-purple-800/30 pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-xl p-2.5 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                      <Wine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    Assistente Virtual do Vinho 🍷
                  </CardTitle>
                  <CardDescription className="text-purple-700/70 dark:text-purple-300/70 font-medium">
                    Tire suas dúvidas sobre vinhos, harmonizações, temperaturas
                    e muito mais!
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {/* Chat Messages */}
                    <ScrollArea className="h-96 w-full bg-white dark:bg-gray-800/50 border border-purple-200 dark:border-purple-800/30 rounded-xl p-4 shadow-sm">
                      {chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-purple-600/70 dark:text-purple-400/70">
                          <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-4 mb-4">
                            <Bot className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                          </div>
                          <p className="text-center font-medium">
                            Olá! Sou seu assistente especializado em vinhos.
                            <br />
                            Pergunte sobre harmonizações, temperaturas, guarda
                            ou regiões!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chatMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex gap-3 ${
                                message.type === "user"
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              {message.type === "assistant" && (
                                <div className="flex-shrink-0">
                                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2">
                                    <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                  </div>
                                </div>
                              )}
                              <div
                                className={`max-w-[80%] rounded-xl p-4 shadow-sm ${
                                  message.type === "user"
                                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white"
                                    : "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white border border-purple-100 dark:border-purple-800/30"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                  {message.content}
                                </p>
                                <p className="text-xs opacity-70 mt-2 font-medium">
                                  {message.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                              {message.type === "user" && (
                                <div className="flex-shrink-0">
                                  <div className="bg-purple-600 rounded-full p-2">
                                    <User className="h-6 w-6 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {isLoading && (
                            <div className="flex gap-3 justify-start">
                              <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2">
                                <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 shadow-sm border border-purple-100 dark:border-purple-800/30">
                                <div className="flex space-x-2">
                                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                                  <div
                                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                                    style={{ animationDelay: "0.1s" }}
                                  ></div>
                                  <div
                                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                                    style={{ animationDelay: "0.2s" }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>

                    {/* Chat Input */}
                    <div className="flex gap-3 p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-purple-200 dark:border-purple-800/30 shadow-sm">
                      <Input
                        placeholder="Digite sua pergunta sobre vinhos..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleWineChat()
                        }
                        disabled={isLoading}
                        className="border-purple-200 dark:border-purple-800/30 focus:border-purple-400 dark:focus:border-purple-600 rounded-lg"
                      />
                      <Button
                        onClick={handleWineChat}
                        disabled={!chatInput.trim() || isLoading}
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg px-4 shadow-md transition-all duration-200"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Sugestões */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 rounded-xl border border-purple-100 dark:border-purple-800/30">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                          <MessageCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                          Tópicos Sugeridos
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 rounded-lg px-3 py-1"
                          onClick={() =>
                            setChatInput(
                              "Como harmonizar vinho tinto com carne?"
                            )
                          }
                        >
                          Harmonização
                        </Badge>
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 rounded-lg px-3 py-1"
                          onClick={() =>
                            setChatInput(
                              "Qual a temperatura ideal para servir vinho branco?"
                            )
                          }
                        >
                          Temperatura
                        </Badge>
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 rounded-lg px-3 py-1"
                          onClick={() =>
                            setChatInput("Como guardar vinhos corretamente?")
                          }
                        >
                          Armazenamento
                        </Badge>
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 rounded-lg px-3 py-1"
                          onClick={() =>
                            setChatInput(
                              "Quais regiões produzem os melhores vinhos tintos?"
                            )
                          }
                        >
                          Regiões
                        </Badge>
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 rounded-lg px-3 py-1"
                          onClick={() =>
                            setChatInput(
                              "Qual vinho combina com comida japonesa?"
                            )
                          }
                        >
                          Culinária
                        </Badge>
                        <Badge
                          variant="outline"
                          className="cursor-pointer border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 rounded-lg px-3 py-1"
                          onClick={() =>
                            setChatInput(
                              "Como identificar um vinho de qualidade?"
                            )
                          }
                        >
                          Qualidade
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Gerador de Mensagens */}
            <TabsContent value="message-generator">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário */}
                <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl border-b border-blue-100 dark:border-blue-800/30 pb-4">
                    <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-2.5 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                        <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      Gerador de Mensagens 📱
                    </CardTitle>
                    <CardDescription className="text-blue-700/70 dark:text-blue-300/70 font-medium">
                      Crie mensagens personalizadas para seus clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Nome do Cliente *
                      </label>
                      <Input
                        placeholder="Ex: João Silva"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="border-blue-200 dark:border-blue-800/30 focus:border-blue-400 dark:focus:border-blue-600 rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Tipo de Mensagem
                      </label>
                      <select
                        className="w-full p-3 border border-blue-200 dark:border-blue-800/30 rounded-lg bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-600 transition-colors"
                        value={messageType}
                        onChange={(e) => setMessageType(e.target.value)}
                      >
                        <option value="prospeccao">Prospecção</option>
                        <option value="followup">Follow-up</option>
                        <option value="oferta">Oferta Especial</option>
                        <option value="aniversario">Aniversário</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Contexto Adicional (opcional)
                      </label>
                      <Textarea
                        placeholder="Ex: vinhos tintos, orçamento de R$ 100, ocasião especial..."
                        value={messageContext}
                        onChange={(e) => setMessageContext(e.target.value)}
                        rows={3}
                        className="border-blue-200 dark:border-blue-800/30 focus:border-blue-400 dark:focus:border-blue-600 rounded-lg"
                      />
                    </div>

                    <Button
                      onClick={generateMessage}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg px-6 py-3 shadow-md transition-all duration-200"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Mensagem
                    </Button>
                  </CardContent>
                </Card>

                {/* Mensagens Geradas */}
                <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl border-b border-blue-100 dark:border-blue-800/30 pb-4">
                    <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-2.5 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                        <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      Mensagens Geradas
                    </CardTitle>
                    <CardDescription className="text-blue-700/70 dark:text-blue-300/70 font-medium">
                      Suas mensagens personalizadas aparecerão aqui
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ScrollArea className="h-96 w-full bg-white dark:bg-gray-800/50 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 shadow-sm">
                      {generatedMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-blue-600/70 dark:text-blue-400/70">
                          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 mb-4">
                            <MessageSquare className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-center font-medium">
                            Nenhuma mensagem gerada ainda.
                            <br />
                            Preencha o formulário e clique em "Gerar Mensagem"
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {generatedMessages.map((message, index) => (
                            <div key={message.id}>
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 shadow-sm hover:shadow-md transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                  <Badge
                                    variant="outline"
                                    className="capitalize border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded-lg px-3 py-1 font-medium"
                                  >
                                    {message.type}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyToClipboard(
                                        message.content,
                                        message.id
                                      )
                                    }
                                    className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                  >
                                    {copiedId === message.id ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-white mb-3 leading-relaxed">
                                  {message.content}
                                </p>
                                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium">
                                  {message.timestamp.toLocaleString()}
                                </p>
                              </div>
                              {index < generatedMessages.length - 1 && (
                                <Separator className="my-4 border-blue-200 dark:border-blue-800/30" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Configurações da IA */}
            <TabsContent value="ai-config">
              <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-white dark:bg-gray-900/50">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-t-xl border-b border-gray-200 dark:border-gray-700 pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-2.5 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                      <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </div>
                    Configurações da IA 🤖
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400 font-medium">
                    Personalize o comportamento e respostas do assistente de IA
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Personalidade */}
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Personalidade da IA
                      </Label>
                      <Select
                        value={aiConfig.personality}
                        onValueChange={(value) =>
                          setAiConfig({ ...aiConfig, personality: value })
                        }
                      >
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="profissional">
                            Profissional
                          </SelectItem>
                          <SelectItem value="amigavel">Amigável</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tamanho da Mensagem */}
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Tamanho das Respostas
                      </Label>
                      <Select
                        value={aiConfig.messageLength}
                        onValueChange={(value) =>
                          setAiConfig({ ...aiConfig, messageLength: value })
                        }
                      >
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="curto">
                            Curto (50-100 palavras)
                          </SelectItem>
                          <SelectItem value="medio">
                            Médio (100-200 palavras)
                          </SelectItem>
                          <SelectItem value="longo">
                            Longo (200+ palavras)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Nível de Expertise */}
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Wine className="h-4 w-4" />
                        Nível de Expertise em Vinhos
                      </Label>
                      <Select
                        value={aiConfig.wineExpertise}
                        onValueChange={(value) =>
                          setAiConfig({ ...aiConfig, wineExpertise: value })
                        }
                      >
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iniciante">
                            Iniciante (linguagem simples)
                          </SelectItem>
                          <SelectItem value="intermediario">
                            Intermediário
                          </SelectItem>
                          <SelectItem value="especialista">
                            Especialista (técnico)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Estilo de Resposta */}
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Estilo de Resposta
                      </Label>
                      <Select
                        value={aiConfig.responseStyle}
                        onValueChange={(value) =>
                          setAiConfig({ ...aiConfig, responseStyle: value })
                        }
                      >
                        <SelectTrigger className="border-gray-200 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consultivo">Consultivo</SelectItem>
                          <SelectItem value="vendas">Vendas</SelectItem>
                          <SelectItem value="educativo">Educativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Criatividade */}
                  <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Criatividade: {aiConfig.creativity}%
                    </Label>
                    <Slider
                      value={[aiConfig.creativity]}
                      onValueChange={(value) =>
                        setAiConfig({ ...aiConfig, creativity: value[0] })
                      }
                      max={100}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 font-medium">
                      <span>Conservador</span>
                      <span>Criativo</span>
                    </div>
                  </div>

                  {/* Temperatura */}
                  <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Temperatura (OpenAI): {aiConfig.temperature}
                    </Label>
                    <Slider
                      value={[aiConfig.temperature * 100]}
                      onValueChange={(value) =>
                        setAiConfig({
                          ...aiConfig,
                          temperature: value[0] / 100,
                        })
                      }
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 font-medium">
                      <span>Determinístico (0.0)</span>
                      <span>Aleatório (1.0)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Máximo de Tokens
                    </Label>
                    <Input
                      type="number"
                      value={aiConfig.maxTokens}
                      onChange={(e) =>
                        setAiConfig({
                          ...aiConfig,
                          maxTokens: parseInt(e.target.value),
                        })
                      }
                      min={100}
                      max={2000}
                      step={50}
                      className="border-gray-200 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-500"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      Controla o tamanho máximo das respostas (100-2000)
                    </p>
                  </div>

                  {/* Switch para Emojis */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Usar Emojis
                      </Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        Incluir emojis nas respostas para torná-las mais
                        expressivas
                      </p>
                    </div>
                    <Switch
                      checked={aiConfig.useEmojis}
                      onCheckedChange={(checked) =>
                        setAiConfig({ ...aiConfig, useEmojis: checked })
                      }
                    />
                  </div>

                  {/* Prompt Personalizado */}
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Prompt Personalizado (Opcional)
                    </Label>
                    <Textarea
                      placeholder="Ex: Sempre mencione a região de origem dos vinhos, foque em harmonizações com comida brasileira..."
                      value={aiConfig.customPrompt}
                      onChange={(e) =>
                        setAiConfig({
                          ...aiConfig,
                          customPrompt: e.target.value,
                        })
                      }
                      rows={4}
                      className="border-gray-200 dark:border-gray-700 focus:border-gray-400 dark:focus:border-gray-500"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      Instruções específicas que serão adicionadas ao contexto
                      da IA
                    </p>
                  </div>

                  {/* Botão Salvar */}
                  <div className="flex justify-end pt-6">
                    <Button
                      onClick={saveAiConfig}
                      className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 rounded-lg px-6 py-3 shadow-md transition-all duration-200"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Configurações
                    </Button>
                  </div>

                  {/* Preview da Configuração */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1.5">
                        <Settings className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                      </div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-200">
                        Prévia da Configuração:
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Personalidade:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {aiConfig.personality}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Tamanho:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {aiConfig.messageLength}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Expertise:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {aiConfig.wineExpertise}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Estilo:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {aiConfig.responseStyle}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Criatividade:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {aiConfig.creativity}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Emojis:
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {aiConfig.useEmojis ? "Sim" : "Não"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
