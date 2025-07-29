
import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image, Upload, Trash2, Eye, Plus } from "lucide-react";

interface LearningImage {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  fileName: string;
  createdAt: Date;
}

export default function LearningImagesManagement() {
  const [images, setImages] = useState<LearningImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Vendas"
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const categories = [
    "Vendas",
    "Produtos", 
    "Sistema",
    "Atendimento",
    "Processos",
    "Geral"
  ];

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('title', formData.title);
      formDataUpload.append('description', formData.description);
      formDataUpload.append('category', formData.category);

      const response = await fetch('/api/learning-images', {
        method: 'POST',
        body: formDataUpload
      });

      if (!response.ok) {
        throw new Error('Erro no upload da imagem');
      }

      const newImage = await response.json();
      setImages(prev => [newImage, ...prev]);
      
      toast({
        title: "Sucesso!",
        description: "Imagem de aprendizado adicionada com sucesso."
      });

      setShowAddModal(false);
      setFormData({
        title: "",
        description: "",
        category: "Vendas"
      });

    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const response = await fetch(`/api/learning-images/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar imagem');
      }

      setImages(prev => prev.filter(img => img.id !== id));
      
      toast({
        title: "Sucesso!",
        description: "Imagem deletada com sucesso."
      });

    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast({
        title: "Erro", 
        description: "Erro ao deletar a imagem. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um título para a imagem.",
        variant: "destructive"
      });
      return;
    }

    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-wine-600" />
              Imagens de Aprendizado
            </CardTitle>
            <CardDescription>
              Gerencie as imagens que aparecem na aba "Aprendizado" da página de Treinamentos
            </CardDescription>
          </div>
          
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Imagem
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Imagem</DialogTitle>
                <DialogDescription>
                  Preencha as informações e selecione uma imagem para upload
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Digite o título da imagem"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Digite uma descrição para a imagem"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleSubmit}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Arquivo
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileUpload(file);
            }
          }}
        />

        {images.length === 0 ? (
          <div className="text-center py-8">
            <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma imagem cadastrada
            </h3>
            <p className="text-gray-600">
              Adicione imagens para aparecerem na aba "Aprendizado" dos treinamentos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image) => (
              <Card key={image.id} className="overflow-hidden">
                <div className="relative">
                  <img
                    src={image.imageUrl}
                    alt={image.title}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.open(image.imageUrl, '_blank')}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteImage(image.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-sm mb-1">{image.title}</h4>
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {image.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-xs">
                      {image.category}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {image.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
