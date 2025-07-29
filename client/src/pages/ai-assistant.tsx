
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
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
  const [generatedMessages, setGeneratedMessages] = useState<GeneratedMessage[]>([]);
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
    responseStyle: "consultivo" // consultivo, vendas, educativo
  });
  
  const { toast } = useToast();

  const saveAiConfig = () => {
    // Salvar configuração no localStorage
    localStorage.setItem('ai-config', JSON.stringify(aiConfig));
    toast({
      title: "Configuração salva!",
      description: "As configurações da IA foram atualizadas com sucesso.",
    });
  };

  // Carregar configuração ao inicializar
  useState(() => {
    const savedConfig = localStorage.getItem('ai-config');
    if (savedConfig) {
      setAiConfig(JSON.parse(savedConfig));
    }
  });

  // Simulação de respostas do assistente de vinhos
  const wineKnowledge = {
    harmonizacao: "Para harmonizar vinhos, considere: carnes vermelhas combinam com tintos encorpados, peixes com brancos secos, queijos com tintos suaves ou brancos aromáticos.",
    temperatura: "Temperaturas ideais: tintos jovens 16-18°C, tintos maduros 18-20°C, brancos secos 8-12°C, espumantes 6-8°C.",
    guarda: "Para guarda adequada: local escuro, umidade 70%, temperatura constante 12-14°C, garrafas deitadas.",
    regioes: "Principais regiões: Bordeaux (França) - tintos elegantes, Toscana (Itália) - Chianti, Vale do Douro (Portugal) - vinhos fortificados, Serra Gaúcha (Brasil) - espumantes.",
    tipos: "Tipos de vinho: tintos (fermentação com casca), brancos (sem casca), rosés (pouco contato com casca), espumantes (segunda fermentação)."
  };

  const handleWineChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    const currentInput = chatInput;
    setChatInput("");

    try {
      // Chamar API de IA real
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          context: 'wine_expert',
          conversationHistory: chatMessages.slice(-5), // Últimas 5 mensagens para contexto
          aiConfig: aiConfig // Enviar configurações da IA
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com a IA');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response || "Desculpe, não consegui processar sua pergunta no momento.",
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao chamar IA:', error);
      
      // Fallback para conhecimento local
      let response = "Desculpe, estou com dificuldades técnicas. Posso ajudar com harmonizações, temperaturas de serviço, guarda de vinhos, regiões produtoras ou tipos de vinho.";
      
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
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMessage = async () => {
    if (!clientName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Gerar mensagem com IA
      const response = await fetch('/api/ai/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          messageType,
          context: messageContext,
          industry: 'wine_business',
          aiConfig: aiConfig // Enviar configurações da IA
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar mensagem');
      }

      const data = await response.json();

      const newMessage: GeneratedMessage = {
        id: Date.now().toString(),
        type: messageType,
        content: data.message,
        timestamp: new Date()
      };

      setGeneratedMessages(prev => [newMessage, ...prev]);
      
      toast({
        title: "Mensagem gerada com IA!",
        description: "Sua mensagem personalizada foi criada com sucesso.",
      });

    } catch (error) {
      console.error('Erro ao gerar mensagem:', error);
      
      // Fallback para templates estáticos
      const messageTemplates = {
        prospeccao: `Olá ${clientName}! 🍷\n\nSou especialista em vinhos e gostaria de apresentar nossa seleção exclusiva de rótulos premium. Temos opções que se adequam a diferentes paladares e ocasiões especiais.\n\nPodemos agendar uma conversa para conhecer suas preferências? Tenho certeza que encontraremos o vinho perfeito para você!\n\nUm brinde aos bons momentos! 🥂`,
        
        followup: `Oi ${clientName}! 😊\n\nEspero que esteja aproveitando o vinho que adquiriu conosco! Como foi a experiência?\n\n${messageContext ? `Lembrei que você mencionou interesse em ${messageContext}, ` : ''}Tenho algumas novidades que podem te interessar:\n\n🍷 Novos rótulos chegaram\n🎯 Ofertas especiais para clientes fiéis\n📚 Dicas de harmonização\n\nQue tal conversarmos sobre suas próximas escolhas?`,
        
        oferta: `${clientName}, oportunidade especial! 🌟\n\nTemos uma seleção limitada de vinhos premium com condições exclusivas:\n\n🍷 Descontos especiais\n📦 Frete grátis para compras acima de R$ 200\n🎁 Brinde surpresa\n\n${messageContext ? `Considerando seu gosto por ${messageContext}, ` : ''}Separei algumas opções que vão te surpreender!\n\nOferta válida por tempo limitado. Vamos conversar?`,
        
        aniversario: `Parabéns, ${clientName}! 🎉🍷\n\nUm brinde ao seu dia especial! Para celebrar esta data única, que tal um vinho excepcional?\n\nTenho sugestões perfeitas para tornar sua comemoração ainda mais especial:\n\n🥂 Espumantes premium\n🍾 Vinhos de safras especiais\n🎁 Embalagem gift exclusiva\n\nSeu aniversário merece um brinde à altura! Vamos escolher juntos?`
      };

      const newMessage: GeneratedMessage = {
        id: Date.now().toString(),
        type: messageType,
        content: messageTemplates[messageType as keyof typeof messageTemplates],
        timestamp: new Date()
      };

      setGeneratedMessages(prev => [newMessage, ...prev]);
      
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
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-wine-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assistente de IA</h1>
          <p className="text-gray-600">Ferramentas inteligentes para seu negócio de vinhos</p>
        </div>
      </div>

      <Tabs defaultValue="wine-assistant" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wine-assistant" className="flex items-center gap-2">
            <Wine className="h-4 w-4" />
            Assistente Virtual do Vinho
          </TabsTrigger>
          <TabsTrigger value="message-generator" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Gerador de Mensagens
          </TabsTrigger>
          <TabsTrigger value="ai-config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações da IA
          </TabsTrigger>
        </TabsList>

        {/* Assistente Virtual do Vinho */}
        <TabsContent value="wine-assistant">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wine className="h-5 w-5 text-wine-600" />
                Assistente Virtual do Vinho 🍷
              </CardTitle>
              <CardDescription>
                Tire suas dúvidas sobre vinhos, harmonizações, temperaturas e muito mais!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Chat Messages */}
                <ScrollArea className="h-96 w-full border rounded-lg p-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Bot className="h-12 w-12 mb-4" />
                      <p className="text-center">
                        Olá! Sou seu assistente especializado em vinhos. 
                        <br />
                        Pergunte sobre harmonizações, temperaturas, guarda ou regiões!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.type === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.type === 'assistant' && (
                            <div className="flex-shrink-0">
                              <Bot className="h-8 w-8 text-wine-600" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.type === 'user'
                                ? 'bg-wine-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                          {message.type === 'user' && (
                            <div className="flex-shrink-0">
                              <User className="h-8 w-8 text-wine-600" />
                            </div>
                          )}
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-3 justify-start">
                          <Bot className="h-8 w-8 text-wine-600" />
                          <div className="bg-gray-100 rounded-lg p-3">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Chat Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua pergunta sobre vinhos..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleWineChat()}
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={handleWineChat} 
                    disabled={!chatInput.trim() || isLoading}
                    className="bg-wine-600 hover:bg-wine-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {/* Sugestões */}
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-wine-50"
                    onClick={() => setChatInput("Como harmonizar vinho tinto com carne?")}
                  >
                    Harmonização
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-wine-50"
                    onClick={() => setChatInput("Qual a temperatura ideal para servir vinho branco?")}
                  >
                    Temperatura
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-wine-50"
                    onClick={() => setChatInput("Como guardar vinhos corretamente?")}
                  >
                    Armazenamento
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-wine-50"
                    onClick={() => setChatInput("Quais regiões produzem os melhores vinhos tintos?")}
                  >
                    Regiões
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-wine-50"
                    onClick={() => setChatInput("Qual vinho combina com comida japonesa?")}
                  >
                    Culinária
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-wine-50"
                    onClick={() => setChatInput("Como identificar um vinho de qualidade?")}
                  >
                    Qualidade
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gerador de Mensagens */}
        <TabsContent value="message-generator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-wine-600" />
                  Gerador de Mensagens 📱
                </CardTitle>
                <CardDescription>
                  Crie mensagens personalizadas para seus clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome do Cliente *</label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de Mensagem</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                  >
                    <option value="prospeccao">Prospecção</option>
                    <option value="followup">Follow-up</option>
                    <option value="oferta">Oferta Especial</option>
                    <option value="aniversario">Aniversário</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Contexto Adicional (opcional)</label>
                  <Textarea
                    placeholder="Ex: vinhos tintos, orçamento de R$ 100, ocasião especial..."
                    value={messageContext}
                    onChange={(e) => setMessageContext(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={generateMessage}
                  className="w-full bg-wine-600 hover:bg-wine-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Mensagem
                </Button>
              </CardContent>
            </Card>

            {/* Mensagens Geradas */}
            <Card>
              <CardHeader>
                <CardTitle>Mensagens Geradas</CardTitle>
                <CardDescription>
                  Suas mensagens personalizadas aparecerão aqui
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {generatedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <MessageSquare className="h-12 w-12 mb-4" />
                      <p className="text-center">
                        Nenhuma mensagem gerada ainda.
                        <br />
                        Preencha o formulário e clique em "Gerar Mensagem"
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {generatedMessages.map((message, index) => (
                        <div key={message.id}>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="capitalize">
                                {message.type}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(message.content, message.id)}
                                className="h-8 w-8 p-0"
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-sm whitespace-pre-wrap text-gray-900 mb-2">
                              {message.content}
                            </p>
                            <p className="text-xs text-gray-500">
                              {message.timestamp.toLocaleString()}
                            </p>
                          </div>
                          {index < generatedMessages.length - 1 && <Separator className="my-4" />}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-wine-600" />
                Configurações da IA 🤖
              </CardTitle>
              <CardDescription>
                Personalize o comportamento e respostas do assistente de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personalidade */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Personalidade da IA</Label>
                  <Select 
                    value={aiConfig.personality} 
                    onValueChange={(value) => setAiConfig({...aiConfig, personality: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profissional">Profissional</SelectItem>
                      <SelectItem value="amigavel">Amigável</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tamanho da Mensagem */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Tamanho das Respostas</Label>
                  <Select 
                    value={aiConfig.messageLength} 
                    onValueChange={(value) => setAiConfig({...aiConfig, messageLength: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curto">Curto (50-100 palavras)</SelectItem>
                      <SelectItem value="medio">Médio (100-200 palavras)</SelectItem>
                      <SelectItem value="longo">Longo (200+ palavras)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nível de Expertise */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Nível de Expertise em Vinhos</Label>
                  <Select 
                    value={aiConfig.wineExpertise} 
                    onValueChange={(value) => setAiConfig({...aiConfig, wineExpertise: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante (linguagem simples)</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="especialista">Especialista (técnico)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estilo de Resposta */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Estilo de Resposta</Label>
                  <Select 
                    value={aiConfig.responseStyle} 
                    onValueChange={(value) => setAiConfig({...aiConfig, responseStyle: value})}
                  >
                    <SelectTrigger>
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
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Criatividade: {aiConfig.creativity}%
                </Label>
                <Slider
                  value={[aiConfig.creativity]}
                  onValueChange={(value) => setAiConfig({...aiConfig, creativity: value[0]})}
                  max={100}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Conservador</span>
                  <span>Criativo</span>
                </div>
              </div>

              {/* Temperatura */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Temperatura (OpenAI): {aiConfig.temperature}
                </Label>
                <Slider
                  value={[aiConfig.temperature * 100]}
                  onValueChange={(value) => setAiConfig({...aiConfig, temperature: value[0] / 100})}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Determinístico (0.0)</span>
                  <span>Aleatório (1.0)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Máximo de Tokens</Label>
                <Input
                  type="number"
                  value={aiConfig.maxTokens}
                  onChange={(e) => setAiConfig({...aiConfig, maxTokens: parseInt(e.target.value)})}
                  min={100}
                  max={2000}
                  step={50}
                />
                <p className="text-xs text-gray-500">
                  Controla o tamanho máximo das respostas (100-2000)
                </p>
              </div>

              {/* Switch para Emojis */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Usar Emojis</Label>
                  <p className="text-xs text-gray-500">
                    Incluir emojis nas respostas para torná-las mais expressivas
                  </p>
                </div>
                <Switch
                  checked={aiConfig.useEmojis}
                  onCheckedChange={(checked) => setAiConfig({...aiConfig, useEmojis: checked})}
                />
              </div>

              {/* Prompt Personalizado */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Prompt Personalizado (Opcional)</Label>
                <Textarea
                  placeholder="Ex: Sempre mencione a região de origem dos vinhos, foque em harmonizações com comida brasileira..."
                  value={aiConfig.customPrompt}
                  onChange={(e) => setAiConfig({...aiConfig, customPrompt: e.target.value})}
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  Instruções específicas que serão adicionadas ao contexto da IA
                </p>
              </div>

              {/* Botão Salvar */}
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={saveAiConfig}
                  className="bg-wine-600 hover:bg-wine-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>

              {/* Preview da Configuração */}
              <div className="bg-gray-50 rounded-lg p-4 mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Prévia da Configuração:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Personalidade:</span> {aiConfig.personality}
                  </div>
                  <div>
                    <span className="font-medium">Tamanho:</span> {aiConfig.messageLength}
                  </div>
                  <div>
                    <span className="font-medium">Expertise:</span> {aiConfig.wineExpertise}
                  </div>
                  <div>
                    <span className="font-medium">Estilo:</span> {aiConfig.responseStyle}
                  </div>
                  <div>
                    <span className="font-medium">Criatividade:</span> {aiConfig.creativity}%
                  </div>
                  <div>
                    <span className="font-medium">Emojis:</span> {aiConfig.useEmojis ? 'Sim' : 'Não'}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
