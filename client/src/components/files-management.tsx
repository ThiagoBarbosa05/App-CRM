
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Search, 
  Download, 
  Trash2, 
  File, 
  Image, 
  FileText,
  Folder,
  FolderPlus
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface FileItem {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  url?: string;
}

interface FilesManagementProps {
  currentUser: any;
}

export function FilesManagement({ currentUser }: FilesManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentFolder, setCurrentFolder] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["/api/files", currentFolder],
    queryFn: async () => {
      const response = await fetch(`/api/files?folder=${encodeURIComponent(currentFolder)}`);
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload files");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setIsUploadModalOpen(false);
      toast({
        title: "Arquivos enviados",
        description: "Os arquivos foram enviados com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao enviar os arquivos.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (filenames: string[]) => {
      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filenames, folder: currentFolder }),
      });
      if (!response.ok) throw new Error("Failed to delete files");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setSelectedFiles([]);
      toast({
        title: "Arquivos excluídos",
        description: "Os arquivos foram excluídos com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir os arquivos.",
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      const response = await fetch("/api/files/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, parent: currentFolder }),
      });
      if (!response.ok) throw new Error("Failed to create folder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setIsFolderModalOpen(false);
      setNewFolderName("");
      toast({
        title: "Pasta criada",
        description: "A pasta foi criada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a pasta.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });
    formData.append("folder", currentFolder);

    uploadMutation.mutate(formData);
  };

  const handleDelete = (filename: string) => {
    deleteMutation.mutate([filename]);
  };

  const handleBulkDelete = () => {
    if (selectedFiles.length === 0) return;
    deleteMutation.mutate(selectedFiles);
  };

  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch(`/api/files/download?file=${encodeURIComponent(filename)}&folder=${encodeURIComponent(currentFolder)}`);
      if (!response.ok) throw new Error("Failed to download file");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao baixar o arquivo.",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (type: string, name: string) => {
    if (type === "folder") return <Folder className="h-4 w-4 text-blue-500" />;
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-green-500" />;
    if (type.includes("pdf") || type.includes("document")) return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredFiles = files.filter((file: FileItem) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const breadcrumbs = currentFolder.split("/").filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arquivos da Empresa</CardTitle>
        <CardDescription>
          Gerencie imagens, documentos e outros arquivos da empresa
        </CardDescription>
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentFolder("")}
            className="h-6 px-2"
          >
            <Folder className="h-3 w-3 mr-1" />
            Raiz
          </Button>
          {breadcrumbs.map((folder, index) => (
            <div key={index} className="flex items-center gap-2">
              <span>/</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentFolder(breadcrumbs.slice(0, index + 1).join("/"))}
                className="h-6 px-2"
              >
                {folder}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar arquivos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedFiles.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir ({selectedFiles.length})
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsFolderModalOpen(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Nova Pasta
            </Button>
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Enviar Arquivos
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <p>Carregando arquivos...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(filteredFiles.map((f: FileItem) => f.name));
                      } else {
                        setSelectedFiles([]);
                      }
                    }}
                    checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Modificado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Folder className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "Nenhum arquivo encontrado" : "Nenhum arquivo nesta pasta"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFiles.map((file: FileItem) => (
                  <TableRow key={file.name}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFiles([...selectedFiles, file.name]);
                          } else {
                            setSelectedFiles(selectedFiles.filter(f => f !== file.name));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(file.type, file.name)}
                        <span 
                          className={file.type === "folder" ? "cursor-pointer hover:underline" : ""}
                          onClick={() => {
                            if (file.type === "folder") {
                              setCurrentFolder(currentFolder ? `${currentFolder}/${file.name}` : file.name);
                            }
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {file.type === "folder" ? "Pasta" : file.type.split("/")[0]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {file.type === "folder" ? "-" : formatFileSize(file.size)}
                    </TableCell>
                    <TableCell>
                      {new Date(file.lastModified).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {file.type !== "folder" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Arquivos</DialogTitle>
            <DialogDescription>
              Selecione os arquivos que deseja enviar para a pasta atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="files">Arquivos</Label>
              <Input
                id="files"
                type="file"
                multiple
                onChange={handleFileUpload}
                ref={fileInputRef}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Modal */}
      <Dialog open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
            <DialogDescription>
              Digite o nome da nova pasta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Nome da Pasta</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nome da pasta"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsFolderModalOpen(false);
                setNewFolderName("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate(newFolderName)}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Criando..." : "Criar Pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
