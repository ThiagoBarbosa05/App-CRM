import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, BookOpen, Video, Users, Target, Award, Clock, FileText } from "lucide-react";
import Sidebar from "@/components/sidebar";

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

export default function Trainings() {
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);

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
      <Sidebar activeTab="treinamentos" onTabChange={() => {}} />

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
                {trainingDocuments.map((doc) => (
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
                ))}
              </div>
            </TabsContent>

            <TabsContent value="learning" className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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