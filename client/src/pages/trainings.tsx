import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Play, BookOpen, Video, Users, Target, Award, Clock, FileText, Edit, Save, X, Plus, Trash2, Upload, Image } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UploadResult } from "@uppy/core";

interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: 'vendas' | 'produto' | 'sistema' | 'atendimento';
  level: 'básico' | 'intermediário' | 'avançado';
  videoUrl: string;
  thumbnail: string;
}

interface TrainingDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileType: 'pdf' | 'doc' | 'ppt';
}

interface LearningImage {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  createdAt: Date;
}

interface LearningCard {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  isEditing: boolean;
  imageUrl?: string;
}

export default function Trainings() {
  const { toast } = useToast();
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [isEditingScripts, setIsEditingScripts] = useState(false);
  const [isEditingAnivSemana, setIsEditingAnivSemana] = useState(false);
  const [isEditingAnivDia, setIsEditingAnivDia] = useState(false);
  const [isEditingPoliticas, setIsEditingPoliticas] = useState(false);

  
  // Estados para os cards dinâmicos
  const [learningCards, setLearningCards] = useState<LearningCard[]>([
    {
      id: 'pronuncia-uvas',
      title: 'Pronúncia das Uvas',
      description: 'Guia completo de pronúncia das principais castas de uvas nacionais e internacionais',
      content: `PRONÚNCIA DAS UVAS

UVAS TINTAS
• Cabernet Sauvignon - [ka-ber-NEH so-vi-NYON]
• Merlot - [mer-LÔ]
• Pinot Noir - [pi-NÔ nu-ÁR]
• Syrah/Shiraz - [si-RÁ / shi-RÁZ]
• Malbec - [mal-BÉK]
• Sangiovese - [san-jo-VE-ze]
• Tempranillo - [tem-pra-NI-lho]
• Carmenère - [kar-me-NÊ-re]
• Grenache - [gre-NA-she]
• Nebbiolo - [ne-bi-Ô-lo]

UVAS BRANCAS
• Chardonnay - [shar-do-NÊ]
• Sauvignon Blanc - [so-vi-NYON BLAN]
• Riesling - [RÍS-ling]
• Pinot Grigio/Pinot Gris - [pi-NÔ GRÍ-jo / pi-NÔ GRÍ]
• Gewürztraminer - [ge-VÚRTS-tra-mi-ner]
• Viognier - [vi-o-ni-ÊR]
• Albariño - [al-ba-RI-nho]
• Moscato - [mos-KA-to]
• Chenin Blanc - [she-NIN BLAN]
• Sémillon - [se-mi-LYON]

UVAS BRASILEIRAS
• Touriga Nacional - [tu-RI-ga na-sio-NAL]
• Tannat - [ta-NÁT]
• Ancellotta - [an-che-LÔ-ta]
• Marselan - [mar-se-LAN]

DICAS DE PRONÚNCIA
• O "R" francês é mais suave
• Acentos tônicos marcados em maiúsculo
• Praticar com clientes demonstra conhecimento
• Sempre confirmar se o cliente entendeu`,
      category: 'Conhecimento Técnico',
      isEditing: false
    },
    {
      id: 'principais-paises',
      title: 'Principais Países',
      description: 'Informações essenciais sobre os principais países produtores de vinho do mundo',
      content: `PRINCIPAIS PAÍSES PRODUTORES DE VINHO

🇫🇷 FRANÇA
• Regiões: Bordeaux, Burgundy, Champagne, Loire, Rhône
• Especialidades: Champagne, Bordeaux tintos, Burgundy Pinot Noir
• Características: Tradição, terroir, elegância
• Uvas principais: Cabernet Sauvignon, Merlot, Pinot Noir, Chardonnay

🇮🇹 ITÁLIA
• Regiões: Toscana, Piemonte, Vêneto, Sicília
• Especialidades: Chianti, Barolo, Amarone, Prosecco
• Características: Diversidade, tradição milenar
• Uvas principais: Sangiovese, Nebbiolo, Pinot Grigio

🇪🇸 ESPANHA
• Regiões: Rioja, Ribera del Duero, Rías Baixas
• Especialidades: Tempranillo, Albariño, Cava
• Características: Tradição, valor, diversidade climática
• Uvas principais: Tempranillo, Garnacha, Albariño

🇺🇸 ESTADOS UNIDOS
• Regiões: Califórnia (Napa, Sonoma), Oregon, Washington
• Especialidades: Cabernet Sauvignon, Pinot Noir
• Características: Inovação, qualidade premium
• Uvas principais: Cabernet Sauvignon, Chardonnay, Pinot Noir

🇦🇺 AUSTRÁLIA
• Regiões: Barossa Valley, Hunter Valley, Margaret River
• Especialidades: Shiraz, Chardonnay
• Características: Estilo moderno, frutas intensas
• Uvas principais: Shiraz, Chardonnay, Cabernet Sauvignon

🇦🇷 ARGENTINA
• Regiões: Mendoza, Salta, San Juan
• Especialidades: Malbec, Torrontés
• Características: Altitude, clima seco, value
• Uvas principais: Malbec, Cabernet Sauvignon, Torrontés

🇨🇱 CHILE
• Regiões: Valle Central, Casablanca, Colchagua
• Especialidades: Cabernet Sauvignon, Carmenère
• Características: Diversidade climática, qualidade/preço
• Uvas principais: Cabernet Sauvignon, Carmenère, Sauvignon Blanc

🇧🇷 BRASIL
• Regiões: Serra Gaúcha, Campanha, Vale do São Francisco
• Especialidades: Espumantes, tintos de altitude
• Características: Clima tropical, inovação
• Uvas principais: Chardonnay, Pinot Noir, Merlot, Tannat`,
      category: 'Geografia Vinícola',
      isEditing: false
    }
  ]);
  
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [newCardContent, setNewCardContent] = useState('');
  const [newCardCategory, setNewCardCategory] = useState('');
  const [newCardImageUrl, setNewCardImageUrl] = useState('');
  const [isCreatingCard, setIsCreatingCard] = useState(false);

  // Funções para gerenciar cards
  const createCard = () => {
    if (!newCardTitle.trim() || !newCardDescription.trim() || !newCardContent.trim()) {
      return;
    }

    const newCard: LearningCard = {
      id: `card-${Date.now()}`,
      title: newCardTitle,
      description: newCardDescription,
      content: newCardContent,
      category: newCardCategory || 'Geral',
      imageUrl: newCardImageUrl || undefined,
      isEditing: false
    };

    setLearningCards(prev => [...prev, newCard]);
    
    // Limpar formulário
    setNewCardTitle('');
    setNewCardDescription('');
    setNewCardContent('');
    setNewCardCategory('');
    setNewCardImageUrl('');
    setIsCreatingCard(false);
  };

  const deleteCard = (cardId: string) => {
    setLearningCards(prev => prev.filter(card => card.id !== cardId));
  };

  const updateCard = (cardId: string, field: keyof LearningCard, value: string | boolean) => {
    setLearningCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, [field]: value } : card
    ));
  };

  // Funções para upload de imagens
  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Falha ao obter URL de upload");
      }
      
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error("Erro ao obter URL de upload:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível obter a URL de upload",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const imageURL = uploadedFile.uploadURL;
      
      // Normalizar o caminho da imagem
      fetch("/api/training-images", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageURL }),
      }).then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          const normalizedPath = data.objectPath;
          setNewCardImageUrl(normalizedPath);
          toast({
            title: "Upload concluído",
            description: "Imagem carregada com sucesso!",
          });
        } else {
          throw new Error("Erro no processamento da imagem");
        }
      }).catch((error) => {
        console.error("Erro ao processar imagem:", error);
        toast({
          title: "Erro no processamento",
          description: "A imagem foi carregada, mas houve um erro no processamento",
          variant: "destructive",
        });
      });
    }
  };
  const [scriptsContent, setScriptsContent] = useState(`SCRIPTS DE LIGAÇÃO

SCRIPT – CLIENTES INATIVOS
Alô, XXX! [Bom dia - Boa tarde]! Sou a xxxx da Grand Cru, Tudo bom?!

Eu vi aqui em nosso sistema que já faz um tempinho que o Sr/Sra. não compra conosco e ai consegui com meu gerente DUAS condições muito bacana para vc voltar a ser nosso cliente.

Gostaria de saber se posso enviar para seu whatsapp esta condição especial?

As condições:
• 1 PRATO PRINCIPAL EM NOSSO BISTROT
• Desconto especial de 40% em uma lista de vinhos selecionados
• Comprando 3 gfs GANHA 1 TAÇA DE CRISTAL BORDEAUX

SCRIPT – 1 SEMANA DO ANIVERSÁRIO
1º ETAPA:
Olá, XXX! [Bom dia - Boa tarde]! Sou a xxxx da Grand Cru, Tudo bom?!

Estou te ligando por que vi aqui em nosso sistema que irá fazer aniversario no próximo dia XXX, e gostaria de dizer que tenho alguns presentes para vc no mês do seu niver:
• 1 PRATO PRINCIPAL em um de nossos bistrot
• 30% DE DESCONTO na compra de vinhos comigo

3º ETAPA:
Eu não sei se sabe, mas temos uma charmoso Wine Bar na nossa unidade de Copacabana, funcionamos de segunda à sábado à partir das 18hs até 23hs.

SCRIPT – NO DIA DO ANIVERSÁRIO
1º ETAPA:
Olá, XXX! [Bom dia - Boa tarde]! Sou a xxxx da Grand Cru, Tudo bom?! Estou te ligando para desejar um feliz aniversário! Parabéns pelo seu GRAND DIA.

2º ETAPA:
E dizer que tenho 2 presentes para vc, para o seu dia especial:
• 1 PRATO PRINCIPAL em um de nossos bistrot
• 30% DE DESCONTO na compra de vinhos comigo

3º ETAPA:
Eu não sei se sabe, mas temos uma charmoso Wine Bar na nossa unidade de Copacabana, funcionamos de segunda à sábado à partir das 18hs até 23hs.

Parabéns e bons vinhos 🍷`);

  const [anivSemanaContent, setAnivSemanaContent] = useState(`SCRIPT - ANIVERSARIANTES - 1 SEMANA ANTES

Olá, [NOME]! [Bom dia - Boa tarde]! Sou a [NOME VENDEDOR] da Grand Cru, tudo bom?

Estou te ligando porque vi aqui em nosso sistema que você irá fazer aniversário no próximo dia [DATA], e gostaria de dizer que tenho alguns presentes especiais para você no mês do seu aniversário:

🎁 PRESENTES DE ANIVERSÁRIO:
• 1 PRATO PRINCIPAL em um de nossos bistrôs
• 30% DE DESCONTO na compra de vinhos comigo
• Degustação gratuita em nosso Wine Bar

WINE BAR COPACABANA:
Eu não sei se você sabe, mas temos um charmoso Wine Bar na nossa unidade de Copacabana, funcionamos de segunda à sábado a partir das 18h até 23h.

Seria um prazer recebê-lo(a) para uma experiência única!

Posso agendar uma visita para você?`);

  const [anivDiaContent, setAnivDiaContent] = useState(`SCRIPT - ANIVERSARIANTES - NO DIA

🎉 FELIZ ANIVERSÁRIO! 🎉

Olá, [NOME]! [Bom dia - Boa tarde]! Sou a [NOME VENDEDOR] da Grand Cru, tudo bom?

Estou te ligando para desejar um FELIZ ANIVERSÁRIO! Parabéns pelo seu GRAND DIA! 🍷

Como presente especial do seu aniversário, preparei algumas surpresas exclusivas para você:

🎁 PRESENTES ESPECIAIS:
• 1 PRATO PRINCIPAL em um de nossos bistrôs
• 30% DE DESCONTO na compra de vinhos comigo
• Taça de degustação cortesia em nosso Wine Bar
• Desconto especial em produtos selecionados

CONVITE ESPECIAL:
Que tal celebrar seu aniversário em nosso Wine Bar? Temos uma atmosfera aconchegante e os melhores vinhos para tornar sua data ainda mais especial!

WINE BAR COPACABANA:
Funcionamos de segunda à sábado das 18h às 23h.

Posso reservar uma mesa especial para o aniversariante?

Mais uma vez, PARABÉNS e que este novo ano seja repleto de bons vinhos e momentos especiais! 🍷✨`);

  const [politicasContent, setPoliticasContent] = useState(`POLÍTICA DE VENDAS - GRAND CRU

VENDAS PARCELADA NO CARTÃO
• MÁXIMO DE 3X SEM JUROS
• Acima de 3X consultar gerência
• Todas as parcelas devem ser aprovadas previamente

DESCONTOS AUTORIZADOS
• PAGAMENTO À VISTA: MÁXIMO 15%
• PAGAMENTO NO CARTÃO: MÁXIMO 10%
• Descontos superiores necessitam aprovação gerencial
• Documentar sempre o motivo do desconto aplicado

PROCEDIMENTOS OBRIGATÓRIOS
• Conferir limite de crédito antes da venda
• Solicitar documento de identificação
• Preencher todos os campos obrigatórios no sistema
• Confirmar dados de entrega quando aplicável

METAS E COMISSÕES
• Meta mensal individual será comunicada no início de cada mês
• Comissão base: conforme tabela em vigor
• Bonificações por superação de meta
• Relatórios de performance disponíveis semanalmente

ATENDIMENTO AO CLIENTE
• Prazo de resposta: máximo 24h
• Pós-venda: acompanhar satisfação do cliente
• Reclamações: encaminhar imediatamente à supervisão
• Fidelização: oferecer programa de cashback quando aplicável`);



  // Mock data - em produção, isso viria da API
  const trainingVideos: TrainingVideo[] = [
    {
      id: "1",
      title: "Introdução ao VinoCRM",
      description: "Aprenda os conceitos básicos do sistema e como navegar pela interface",
      duration: "15:30",
      category: "sistema",
      level: "básico",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnail: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=300&h=200&fit=crop"
    },
    {
      id: "2",
      title: "Técnicas de Venda Consultiva",
      description: "Domine as técnicas de venda consultiva para melhorar seus resultados",
      duration: "25:45",
      category: "vendas",
      level: "intermediário",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnail: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop"
    },
    {
      id: "3",
      title: "Conhecimento dos Produtos",
      description: "Conheça em detalhes os produtos e suas características",
      duration: "20:15",
      category: "produto",
      level: "básico",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnail: "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=300&h=200&fit=crop"
    },
    {
      id: "4",
      title: "Atendimento ao Cliente Excelente",
      description: "Como proporcionar uma experiência excepcional aos clientes",
      duration: "18:20",
      category: "atendimento",
      level: "intermediário",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnail: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=300&h=200&fit=crop"
    }
  ];

  const trainingDocuments: TrainingDocument[] = [
    {
      id: "1",
      title: "Manual do Usuário VinoCRM",
      description: "Guia completo de uso do sistema",
      category: "Sistema",
      fileUrl: "https://exemplo.com/seu-documento.pdf",
      fileType: "pdf"
    },
    {
      id: "2",
      title: "Catálogo de Produtos 2024",
      description: "Catálogo completo com todos os produtos disponíveis",
      category: "Produtos",
      fileUrl: "#",
      fileType: "pdf"
    },
    {
      id: "3",
      title: "Scripts de Vendas",
      description: "Roteiros prontos para diferentes situações de venda",
      category: "Vendas",
      fileUrl: "#",
      fileType: "doc"
    },
    {
      id: "4",
      title: "Política de Vendas",
      description: "Diretrizes e políticas para o time de vendas",
      category: "Vendas",
      fileUrl: "#",
      fileType: "pdf"
    }
  ];

  // Mock data para imagens de aprendizado - em produção viria da API
  const mockLearningImages: LearningImage[] = [
    {
      id: "1",
      title: "Processo de Venda Consultiva",
      description: "Fluxograma do processo de venda consultiva",
      category: "Vendas",
      imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&h=300&fit=crop",
      createdAt: new Date()
    },
    {
      id: "2",
      title: "Características dos Vinhos",
      description: "Infográfico sobre características dos vinhos",
      category: "Produtos",
      imageUrl: "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=500&h=300&fit=crop",
      createdAt: new Date()
    },
    {
      id: "3",
      title: "Interface do Sistema",
      description: "Tutorial visual da interface do VinoCRM",
      category: "Sistema",
      imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop",
      createdAt: new Date()
    }
  ];

  const getCategoryColor = (category: string) => {
    const colors = {
      vendas: "bg-green-100 text-green-800",
      produto: "bg-blue-100 text-blue-800",
      sistema: "bg-purple-100 text-purple-800",
      atendimento: "bg-orange-100 text-orange-800"
    };
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getLevelColor = (level: string) => {
    const colors = {
      básico: "bg-green-100 text-green-800",
      intermediário: "bg-yellow-100 text-yellow-800",
      avançado: "bg-red-100 text-red-800"
    };
    return colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Video className="h-8 w-8 text-wine-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Centro de Treinamento</h1>
                <p className="text-gray-600">Vídeos, documentos e recursos para aprimorar suas habilidades</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="videos" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="videos" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Vídeos de Treinamento
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentos e Manuais
              </TabsTrigger>
               <TabsTrigger value="learning" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Aprendizado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-6">
              {selectedVideo ? (
                <div className="space-y-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedVideo(null)}
                    className="mb-4"
                  >
                    ← Voltar aos vídeos
                  </Button>

                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-2xl">{selectedVideo.title}</CardTitle>
                          <CardDescription className="mt-2">
                            {selectedVideo.description}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getCategoryColor(selectedVideo.category)}>
                            {selectedVideo.category}
                          </Badge>
                          <Badge className={getLevelColor(selectedVideo.level)}>
                            {selectedVideo.level}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="aspect-video mb-4">
                        <iframe
                          src={selectedVideo.videoUrl}
                          title={selectedVideo.title}
                          className="w-full h-full rounded-lg"
                          allowFullScreen
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        Duração: {selectedVideo.duration}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trainingVideos.map((video) => (
                    <Card key={video.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                      <div className="relative">
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-48 object-cover rounded-t-lg"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-t-lg">
                          <Button 
                            size="lg" 
                            onClick={() => setSelectedVideo(video)}
                            className="bg-white text-black hover:bg-gray-100"
                          >
                            <Play className="h-5 w-5 mr-2" />
                            Assistir
                          </Button>
                        </div>
                        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                          {video.duration}
                        </div>
                      </div>
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <CardTitle className="text-lg">{video.title}</CardTitle>
                        </div>
                        <CardDescription>{video.description}</CardDescription>
                        <div className="flex gap-2 mt-3">
                          <Badge className={getCategoryColor(video.category)}>
                            {video.category}
                          </Badge>
                          <Badge className={getLevelColor(video.level)}>
                            {video.level}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainingDocuments.map((doc) => {
                  // Card especial para Política de Vendas
                  if (doc.title === "Política de Vendas") {
                    return (
                      <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-wine-600" />
                                {doc.title}
                              </CardTitle>
                              <CardDescription className="mt-2">{doc.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {isEditingPoliticas ? (
                            <div className="space-y-4">
                              <Textarea
                                value={politicasContent}
                                onChange={(e) => setPoliticasContent(e.target.value)}
                                className="min-h-96 resize-none font-mono text-sm"
                                placeholder="Digite aqui as políticas de vendas..."
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsEditingPoliticas(false)}
                                  className="text-gray-600 border-gray-300"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsEditingPoliticas(false)}
                                  className="text-wine-700 border-wine-300 hover:bg-wine-50"
                                >
                                  <Save className="h-4 w-4 mr-2" />
                                  Salvar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="bg-wine-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                                <div className="prose prose-sm">
                                  <pre className="whitespace-pre-wrap text-sm text-wine-800 font-sans">
                                    {politicasContent}
                                  </pre>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <Badge variant="outline" className="text-wine-700 border-wine-300">{doc.category}</Badge>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditingPoliticas(true)}
                                    className="text-wine-700 border-wine-300 hover:bg-wine-50"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-wine-700 border-wine-300 hover:bg-wine-50"
                                  >
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    Imprimir
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  }

                  // Cards normais para outros documentos
                  return (
                    <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{doc.title}</CardTitle>
                            <CardDescription className="mt-2">{doc.description}</CardDescription>
                          </div>
                          <div className="ml-4">
                            {doc.fileType === 'pdf' && <FileText className="h-8 w-8 text-red-500" />}
                            {doc.fileType === 'doc' && <FileText className="h-8 w-8 text-blue-500" />}
                            {doc.fileType === 'ppt' && <FileText className="h-8 w-8 text-orange-500" />}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline">{doc.category}</Badge>
                          <Button variant="outline" size="sm">
                            <BookOpen className="h-4 w-4 mr-2" />
                            Abrir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="learning" className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Card dos Scripts de Ligação */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-wine-600" />
                          Scripts de Ligação
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Roteiros completos para diferentes situações de ligação: clientes inativos, aniversários e prospecção
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditingScripts ? (
                      <div className="space-y-4">
                        <Textarea
                          value={scriptsContent}
                          onChange={(e) => setScriptsContent(e.target.value)}
                          className="min-h-96 resize-none font-mono text-sm"
                          placeholder="Digite aqui os scripts de ligação..."
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingScripts(false)}
                            className="text-gray-600 border-gray-300"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingScripts(false)}
                            className="text-wine-700 border-wine-300 hover:bg-wine-50"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-wine-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                          <div className="prose prose-sm">
                            <pre className="whitespace-pre-wrap text-sm text-wine-800 font-sans">
                              {scriptsContent}
                            </pre>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-wine-700 border-wine-300">Scripts de Vendas</Badge>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingScripts(true)}
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <BookOpen className="h-4 w-4 mr-2" />
                              Imprimir
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Card Aniversariantes - 1 semana antes */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-wine-600" />
                          Aniversariantes - 1 semana antes
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Script personalizado para contatar clientes uma semana antes do aniversário
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditingAnivSemana ? (
                      <div className="space-y-4">
                        <Textarea
                          value={anivSemanaContent}
                          onChange={(e) => setAnivSemanaContent(e.target.value)}
                          className="min-h-96 resize-none font-mono text-sm"
                          placeholder="Digite aqui o script para aniversariantes - 1 semana antes..."
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingAnivSemana(false)}
                            className="text-gray-600 border-gray-300"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingAnivSemana(false)}
                            className="text-wine-700 border-wine-300 hover:bg-wine-50"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-wine-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                          <div className="prose prose-sm">
                            <pre className="whitespace-pre-wrap text-sm text-wine-800 font-sans">
                              {anivSemanaContent}
                            </pre>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-wine-700 border-wine-300">Script Aniversário</Badge>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingAnivSemana(true)}
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <BookOpen className="h-4 w-4 mr-2" />
                              Imprimir
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Card Aniversariantes - No Dia */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-wine-600" />
                          Aniversariantes - No Dia
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Script especial para parabenizar clientes no dia do aniversário
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditingAnivDia ? (
                      <div className="space-y-4">
                        <Textarea
                          value={anivDiaContent}
                          onChange={(e) => setAnivDiaContent(e.target.value)}
                          className="min-h-96 resize-none font-mono text-sm"
                          placeholder="Digite aqui o script para aniversariantes - no dia..."
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingAnivDia(false)}
                            className="text-gray-600 border-gray-300"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingAnivDia(false)}
                            className="text-wine-700 border-wine-300 hover:bg-wine-50"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-wine-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                          <div className="prose prose-sm">
                            <pre className="whitespace-pre-wrap text-sm text-wine-800 font-sans">
                              {anivDiaContent}
                            </pre>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-wine-700 border-wine-300">Script Aniversário</Badge>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditingAnivDia(true)}
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <BookOpen className="h-4 w-4 mr-2" />
                              Imprimir
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Botão para criar novo card */}
                {isCreatingCard ? (
                  <Card className="hover:shadow-lg transition-shadow border-wine-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Plus className="h-5 w-5 text-wine-600" />
                        Criar Novo Card
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-wine-700">Título</label>
                        <Input
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          placeholder="Digite o título do card..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wine-700">Descrição</label>
                        <Input
                          value={newCardDescription}
                          onChange={(e) => setNewCardDescription(e.target.value)}
                          placeholder="Digite uma breve descrição..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wine-700">Categoria</label>
                        <Input
                          value={newCardCategory}
                          onChange={(e) => setNewCardCategory(e.target.value)}
                          placeholder="Ex: Conhecimento Técnico, Procedimentos..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wine-700">Imagem (opcional)</label>
                        <div className="mt-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={newCardImageUrl}
                              onChange={(e) => setNewCardImageUrl(e.target.value)}
                              placeholder="URL da imagem ou use o botão de upload"
                              className="flex-1"
                            />
                            <ObjectUploader
                              maxNumberOfFiles={1}
                              maxFileSize={5242880} // 5MB
                              onGetUploadParameters={handleGetUploadParameters}
                              onComplete={handleUploadComplete}
                              buttonClassName="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload
                            </ObjectUploader>
                          </div>
                          {newCardImageUrl && (
                            <div className="mt-2">
                              <img 
                                src={newCardImageUrl.startsWith('/objects/') ? newCardImageUrl : newCardImageUrl} 
                                alt="Preview" 
                                className="w-full max-w-xs h-32 object-cover rounded-lg border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%236b7280">Imagem não encontrada</text></svg>';
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-wine-700">Conteúdo</label>
                        <Textarea
                          value={newCardContent}
                          onChange={(e) => setNewCardContent(e.target.value)}
                          placeholder="Digite o conteúdo completo do card..."
                          className="mt-1 min-h-48 resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCreatingCard(false)}
                          className="text-gray-600 border-gray-300"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={createCard}
                          className="text-wine-700 border-wine-300 hover:bg-wine-50"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Criar Card
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="hover:shadow-lg transition-shadow border-dashed border-wine-300 bg-wine-50/30">
                    <CardContent className="flex items-center justify-center p-8">
                      <Button
                        variant="outline"
                        onClick={() => setIsCreatingCard(true)}
                        className="text-wine-700 border-wine-300 hover:bg-wine-50"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Novo Card
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Cards dinâmicos */}
                {learningCards.map((card) => (
                  <Card key={card.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-wine-600" />
                            {card.title}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {card.description}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCard(card.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {card.isEditing ? (
                        <div className="space-y-4">
                          <Textarea
                            value={card.content}
                            onChange={(e) => updateCard(card.id, 'content', e.target.value)}
                            className="min-h-96 resize-none font-mono text-sm"
                            placeholder="Digite aqui o conteúdo do card..."
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCard(card.id, 'isEditing', false)}
                              className="text-gray-600 border-gray-300"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCard(card.id, 'isEditing', false)}
                              className="text-wine-700 border-wine-300 hover:bg-wine-50"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Salvar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {card.imageUrl && (
                            <div className="mb-4">
                              <img 
                                src={card.imageUrl} 
                                alt={card.title}
                                className="w-full h-48 object-cover rounded-lg border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="bg-wine-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                            <div className="prose prose-sm">
                              <pre className="whitespace-pre-wrap text-sm text-wine-800 font-sans">
                                {card.content}
                              </pre>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <Badge variant="outline" className="text-wine-700 border-wine-300">{card.category}</Badge>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateCard(card.id, 'isEditing', true)}
                                className="text-wine-700 border-wine-300 hover:bg-wine-50"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-wine-700 border-wine-300 hover:bg-wine-50"
                              >
                                <BookOpen className="h-4 w-4 mr-2" />
                                Imprimir
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {mockLearningImages.map((image) => (
                  <Card key={image.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{image.title}</CardTitle>
                          <CardDescription className="mt-2">{image.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <img 
                          src={image.imageUrl} 
                          alt={image.title}
                          className="w-full h-48 object-cover rounded-t-lg"
                        />
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">{image.category}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}