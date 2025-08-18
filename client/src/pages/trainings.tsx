import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Play,
  BookOpen,
  Video,
  Users,
  Target,
  Award,
  Clock,
  FileText,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  Upload,
  Image,
  File,
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { UploadResult } from "@uppy/core";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { getYouTubeEmbedUrl } from "@/lib/get-embed-youtube";
import { Training } from "@/components/learning-images-management";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: "vendas" | "produto" | "sistema" | "atendimento";
  level: "básico" | "intermediário" | "avançado";
  attachmentUrl: string;
  thumbnail: string;
}

interface TrainingDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileType: "pdf" | "doc" | "ppt";
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
  const { user } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<Training | null>(null);

  const [isEditingAnivSemana, setIsEditingAnivSemana] = useState(false);
  const [isEditingAnivDia, setIsEditingAnivDia] = useState(false);
  const [isEditingPoliticas, setIsEditingPoliticas] = useState(false);

  // Estados para os cards dinâmicos
  const [learningCards, setLearningCards] = useState<LearningCard[]>([
    {
      id: "pronuncia-uvas",
      title: "Pronúncia das Uvas",
      description:
        "Guia completo de pronúncia das principais castas de uvas nacionais e internacionais",
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
      category: "Conhecimento Técnico",
      isEditing: false,
    },
    {
      id: "principais-paises",
      title: "Principais Países",
      description:
        "Informações essenciais sobre os principais países produtores de vinho do mundo",
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
      category: "Geografia Vinícola",
      isEditing: false,
    },
  ]);

  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [newCardContent, setNewCardContent] = useState("");
  const [newCardCategory, setNewCardCategory] = useState("");
  const [newCardImageUrl, setNewCardImageUrl] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);

  // Funções para gerenciar cards
  const createCard = () => {
    if (
      !newCardTitle.trim() ||
      !newCardDescription.trim() ||
      !newCardContent.trim()
    ) {
      return;
    }

    const newCard: LearningCard = {
      id: `card-${Date.now()}`,
      title: newCardTitle,
      description: newCardDescription,
      content: newCardContent,
      category: newCardCategory || "Geral",
      imageUrl: newCardImageUrl || undefined,
      isEditing: false,
    };

    setLearningCards((prev) => [...prev, newCard]);

    // Limpar formulário
    setNewCardTitle("");
    setNewCardDescription("");
    setNewCardContent("");
    setNewCardCategory("");
    setNewCardImageUrl("");
    setIsCreatingCard(false);
  };

  const deleteCard = (cardId: string) => {
    setLearningCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  const updateCard = (
    cardId: string,
    field: keyof LearningCard,
    value: string | boolean,
  ) => {
    setLearningCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card,
      ),
    );
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

  const handleUploadComplete = (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>,
  ) => {
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
      })
        .then(async (response) => {
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
        })
        .catch((error) => {
          console.error("Erro ao processar imagem:", error);
          toast({
            title: "Erro no processamento",
            description:
              "A imagem foi carregada, mas houve um erro no processamento",
            variant: "destructive",
          });
        });
    }
  };

  const [anivSemanaContent, setAnivSemanaContent] =
    useState(`SCRIPT - ANIVERSARIANTES - 1 SEMANA ANTES

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

  const [anivDiaContent, setAnivDiaContent] =
    useState(`SCRIPT - ANIVERSARIANTES - NO DIA

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

  const [politicasContent, setPoliticasContent] =
    useState(`POLÍTICA DE VENDAS - GRAND CRU

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
  // const trainingVideos: TrainingVideo[] = [
  //   {
  //     id: "1",
  //     title: "Introdução ao VinoCRM",
  //     description:
  //       "Aprenda os conceitos básicos do sistema e como navegar pela interface",
  //     duration: "15:30",
  //     category: "sistema",
  //     level: "básico",
  //     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  //     thumbnail:
  //       "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=300&h=200&fit=crop",
  //   },
  //   {
  //     id: "2",
  //     title: "Técnicas de Venda Consultiva",
  //     description:
  //       "Domine as técnicas de venda consultiva para melhorar seus resultados",
  //     duration: "25:45",
  //     category: "vendas",
  //     level: "intermediário",
  //     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  //     thumbnail:
  //       "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
  //   },
  //   {
  //     id: "3",
  //     title: "Conhecimento dos Produtos",
  //     description: "Conheça em detalhes os produtos e suas características",
  //     duration: "20:15",
  //     category: "produto",
  //     level: "básico",
  //     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  //     thumbnail:
  //       "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=300&h=200&fit=crop",
  //   },
  //   {
  //     id: "4",
  //     title: "Atendimento ao Cliente Excelente",
  //     description: "Como proporcionar uma experiência excepcional aos clientes",
  //     duration: "18:20",
  //     category: "atendimento",
  //     level: "intermediário",
  //     videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  //     thumbnail:
  //       "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=300&h=200&fit=crop",
  //   },
  // ];

  const trainingDocuments: TrainingDocument[] = [
    {
      id: "4",
      title: "Política de Vendas",
      description: "Diretrizes e políticas para o time de vendas",
      category: "Vendas",
      fileUrl: "#",
      fileType: "pdf",
    },
  ];

  const { data: trainingVideos } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=video"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=video");
      if (!response.ok) throw new Error("Failed to fetch training videos");
      const videos = await response.json();
      // Sort by displayOrder, then by createdAt
      return videos.sort((a: Training, b: Training) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
  });

  const { data: trainingDocument } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=document"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=document");
      if (!response.ok) throw new Error("Failed to fetch training documents");
      const documents = await response.json();
      // Sort by displayOrder, then by createdAt
      return documents.sort((a: Training, b: Training) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
  });

  const { data: scripts } = useQuery<Training[]>({
    queryKey: ["/api/trainings?type=script"],
    queryFn: async () => {
      const response = await fetch("/api/trainings?type=script");

      if (!response.ok) throw new Error("Failed to fetch training videos");

      const scripts = await response.json();
      // Sort by displayOrder, then by createdAt
      return scripts.sort((a: Training, b: Training) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    },
  });

  // Mock data para imagens de aprendizado - em produção viria da API
  const mockLearningImages: LearningImage[] = [];

  // Função para verificar se o usuário é administrador
  const isAdmin = user?.role === "admin";

  const getCategoryColor = (category: string) => {
    const colors = {
      vendas: "bg-green-100 text-green-800",
      produto: "bg-blue-100 text-blue-800",
      sistema: "bg-purple-100 text-purple-800",
      atendimento: "bg-orange-100 text-orange-800",
    };
    return (
      colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  const getLevelColor = (level: string) => {
    const colors = {
      básico: "bg-green-100 text-green-800",
      intermediário: "bg-yellow-100 text-yellow-800",
      avançado: "bg-red-100 text-red-800",
    };
    return colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div>
      <div>
        <div className="flex items-start gap-2 mb-5">
          <Video className="h-8 w-8 text-wine-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Centro de Treinamento
            </h1>
            <p className="text-gray-600">
              Vídeos, documentos e recursos para aprimorar suas habilidades
            </p>
          </div>
        </div>

        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <p>Vídeos de Treinamento</p>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <p>Documentos e Manuais</p>
            </TabsTrigger>
            <TabsTrigger value="scripts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <p> Script de Vendas</p>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-6 w-full">
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
                        <CardTitle className="text-2xl">
                          {selectedVideo.title}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {selectedVideo.description}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          className={getCategoryColor(selectedVideo.category)}
                        >
                          {selectedVideo.category}
                        </Badge>
                        <Badge className={getLevelColor(selectedVideo.level!)}>
                          {selectedVideo.level}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video mb-4">
                      <iframe
                        src={
                          selectedVideo.attachmentUrl?.includes(
                            "www.youtube.com",
                          ) && !selectedVideo.attachmentUrl.includes("embed")
                            ? getYouTubeEmbedUrl(selectedVideo.attachmentUrl)
                            : selectedVideo.attachmentUrl || ""
                        }
                        title={selectedVideo.title}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                      />
                    </div>
                    {/* <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      Duração: {selectedVideo.duration}
                    </div> */}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trainingVideos &&
                  trainingVideos.map((video) => (
                    <div
                      onClick={() => setSelectedVideo(video)}
                      className="w-full bg-white cursor-pointer transition-transform ease-in duration-100 hover:scale-105 flex flex-col border overflow-hidden border-gray-200 rounded-lg shadow-lg min-h-96"
                      key={video.id}
                    >
                      <div className="">
                        <iframe
                          className="w-full h-[192px]"
                          src={
                            video.attachmentUrl?.includes("www.youtube.com") &&
                            !video.attachmentUrl.includes("embed")
                              ? getYouTubeEmbedUrl(video.attachmentUrl)
                              : video.attachmentUrl || ""
                          }
                          title={video.title}
                          allowFullScreen
                        />
                      </div>
                      <div className="p-4 flex-1 space-y-5">
                        <div>
                          <p className="text-lg font-medium">{video.title}</p>
                          <p className="text-sm leading-none">
                            {video.description}
                          </p>
                        </div>

                        <div className="mt-2 flex gap-2">
                          <Badge>{video.category}</Badge>
                          <Badge>{video.level}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 w-full">
            <div className="flex flex-col gap-6">
              {/* Cabeçalho da seção */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Documentos e Manuais</h2>
                <p className="text-gray-600">Material de apoio e documentação técnica</p>
              </div>

              {/* Lista de documentos */}
              <section className="space-y-8">
                {trainingDocument &&
                  trainingDocument.map((training, index) => (
                    <div
                      className="bg-white w-full shadow-lg rounded-lg overflow-hidden border border-gray-200"
                      key={training.id}
                    >
                      {/* Cabeçalho do documento */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="bg-white p-3 rounded-full shadow-sm">
                              <File className="size-8 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">
                                {training.title}
                              </h3>
                              <p className="text-gray-600 mt-1">
                                {training.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="px-3 py-1">
                              Documento #{index + 1}
                            </Badge>
                            <Badge variant="outline" className="px-3 py-1">
                              {training.category}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Visualização do documento */}
                      <div className="p-6">
                        <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-dashed border-gray-200">
                          <div className="w-full h-[700px] bg-white flex items-center justify-center">
                            <iframe
                              src={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${training.attachmentUrl}`}
                              className="w-full h-full border-0"
                              title={training.title}
                            />
                          </div>
                        </div>

                        {/* Ações do documento */}
                        <div className="mt-4 flex justify-center">
                          <a
                            href={`https://pub-2430b33535154e839fd64049d300b4a4.r2.dev/${training.attachmentUrl}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <BookOpen className="size-5" />
                            Abrir em Nova Aba
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Mensagem quando não há documentos */}
                {(!trainingDocument || trainingDocument.length === 0) && (
                  <div className="text-center py-12">
                    <File className="size-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum documento encontrado
                    </h3>
                    <p className="text-gray-500">
                      Os documentos de treinamento aparecerão aqui quando forem adicionados.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="scripts" className="space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scripts?.map((script) => (
                <div
                  key={script.id}
                  className="bg-white flex flex-col items-start p-5 rounded-md shadow-md"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="flex-shrink-0" />

                    <div className="flex-1">
                      <h4 className="text-xl font-medium">{script.title}</h4>
                      <p className="text-sm">{script.description}</p>
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#202938", // cor de fundo fixa
                      whiteSpace: "normal",
                      wordWrap: "break-word",
                      color: "white",
                    }}
                    className="prose w-full flex-1 p-4 preview-content leading-none max-w-none max-h-96 overflow-x-hidden break-words"
                    dangerouslySetInnerHTML={{
                      __html: script.content || (
                        <p>Nenhum conteúdo encontrado</p>
                      ),
                    }}
                  />

                  <Badge className="mt-5" variant={"outline"}>
                    {script.category}
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}