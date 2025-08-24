
import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Wine, Search, Building2, Users, Download, Upload, TrendingUp, Award } from "lucide-react";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ProductFormModal } from "@/components/product-form-modal";
import { ProductClientsModal } from "@/components/product-clients-modal";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  name: string;
  country: string;
  volume: string;
  type: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
  clientCount: number;
}

export default function Products() {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);
  const [selectedProductForClients, setSelectedProductForClients] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: products = [], isFetching } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch("/api/products", {
        headers: {
          'x-user-id': 'test',
          'x-user-role': 'admin'
        }
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const { data: statistics, error: statisticsError } = useQuery({
    queryKey: ["/api/products/statistics"],
    queryFn: async () => {
      const response = await fetch("/api/products/statistics");
      if (!response.ok) throw new Error("Failed to fetch statistics");
      return response.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Debug log para verificar se os dados estão chegando
  console.log("Statistics data:", statistics);
  console.log("Statistics error:", statisticsError);

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto excluído",
        description: "O produto foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o produto.",
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  }, []);

  const handleViewClients = useCallback((product: Product) => {
    setSelectedProductForClients(product);
    setIsClientsModalOpen(true);
  }, []);

  const handleExportProducts = useCallback(() => {
    // Criar dados para exportar
    const exportData = products.map((product: Product) => ({
      'Nome do Vinho': product.name,
      'País': product.country,
      'Volume': product.volume,
      'Tipo': product.type,
      'Valor de Tabela': `R$ ${parseFloat(product.negotiatedPrice).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      'Criado Por': product.createdByName || "Sistema",
      'Data de Criação': new Date(product.createdAt).toLocaleDateString('pt-BR')
    }));

    // Criar planilha
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

    // Gerar arquivo e baixar
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `produtos_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast({
      title: "Exportação concluída",
      description: "Lista de produtos exportada com sucesso.",
    });
  }, [products, toast]);

  const handleImportProducts = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Dados importados:', jsonData);
        
        // Processar e enviar dados para o backend
        processImportedProducts(jsonData);
        
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast({
          title: "Erro na importação",
          description: "Erro ao processar o arquivo Excel. Verifique o formato.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Limpar input
    if (event.target) {
      event.target.value = '';
    }
  }, [toast]);

  const processImportedProducts = useCallback(async (data: any[]) => {
    try {
      const productsToImport = data.map((row: any) => ({
        name: row['Nome do Vinho'] || row.nome || row.name,
        country: row['País'] || row.pais || row.country || 'BRASIL',
        volume: row['Volume'] || row.volume || '750ml',
        type: row['Tipo'] || row.tipo || row.type || 'TINTO',
        negotiatedPrice: parseFloat(
          String(row['Valor de Tabela'] || row['Valor Negociado'] || row.valor || row.price || '0')
            .replace(/[^\d,]/g, '')
            .replace(',', '.')
        ).toFixed(2)
      })).filter(product => product.name); // Só incluir produtos com nome

      console.log('Produtos para importar:', productsToImport);

      // Importar cada produto individualmente
      let successCount = 0;
      let errorCount = 0;

      for (const product of productsToImport) {
        try {
          const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': 'b314722c-8fd6-4592-a9de-9ee551ec35be',
              'x-user-role': 'admin'
            },
            body: JSON.stringify({
              ...product,
              createdBy: 'b314722c-8fd6-4592-a9de-9ee551ec35be'
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Erro ao importar produto ${product.name}:`, await response.text());
          }
        } catch (error) {
          errorCount++;
          console.error(`Erro ao importar produto ${product.name}:`, error);
        }
      }

      // Atualizar lista de produtos
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      toast({
        title: "Importação concluída",
        description: `${successCount} produto(s) importado(s) com sucesso. ${errorCount > 0 ? `${errorCount} erro(s).` : ''}`,
      });

    } catch (error) {
      console.error('Erro no processamento:', error);
      toast({
        title: "Erro na importação",
        description: "Erro ao processar os dados importados.",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const getCountryFlag = (country: string) => {
    const flags: { [key: string]: string } = {
      CHILE: "🇨🇱",
      ARGENTINA: "🇦🇷",
      URUGUAI: "🇺🇾",
      BRASIL: "🇧🇷",
      EUA: "🇺🇸",
      FRANÇA: "🇫🇷",
      ITÁLIA: "🇮🇹",
      PORTUGAL: "🇵🇹",
      ESPANHA: "🇪🇸",
      ALEMANHA: "🇩🇪",
      OUTROS: "🌍",
    };
    return flags[country] || "🌍";
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      ESPUMANTE: "bg-yellow-100 text-yellow-800",
      BRANCO: "bg-green-100 text-green-800",
      ROSE: "bg-pink-100 text-pink-800",
      TINTO: "bg-red-100 text-red-800",
      "PÓS-REFEIÇÃO": "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wine className="h-6 w-6 text-wine-600" />
              Produtos
            </h2>
            <p className="text-gray-600 mt-1">
              Gerencie o catálogo de vinhos e produtos
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportProducts}
              variant="outline"
              disabled={products.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button
              onClick={() => setIsProductModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Section */}
      {statisticsError && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Erro ao carregar estatísticas: {statisticsError.message}</p>
          </CardContent>
        </Card>
      )}

      {statistics && statistics.topCompaniesByProducts && statistics.topProductsByCompanies && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Companies by Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-600" />
                Clientes com Mais Vinhos
              </CardTitle>
              <CardDescription>
                Top 10 clientes com maior quantidade de produtos na carta de vinhos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statistics.topCompaniesByProducts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhum dado disponível</p>
                ) : (
                  statistics.topCompaniesByProducts.map((company: any, index: number) => (
                    <div key={company.companyId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{company.companyName}</p>
                          <p className="text-sm text-gray-600">{company.companyCity}, {company.companyState}</p>
                          {company.responsibleName && (
                            <p className="text-xs text-gray-500">Resp.: {company.responsibleName}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold">
                        {company.productCount} vinhos
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Products by Companies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-wine-600" />
                Vinhos Mais Vinculados
              </CardTitle>
              <CardDescription>
                Top 10 produtos mais presentes nas cartas de vinhos dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statistics.topProductsByCompanies.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhum dado disponível</p>
                ) : (
                  statistics.topProductsByCompanies.map((product: any, index: number) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-wine-100 text-wine-700'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.productName}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{getCountryFlag(product.productCountry)} {product.productCountry}</span>
                            <Badge variant="outline" className="text-xs">{product.productVolume}</Badge>
                            <Badge className={`text-xs ${getTypeColor(product.productType)}`}>
                              {product.productType}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold">
                        {product.companyCount} clientes
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!statistics && !statisticsError && !isFetching && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Carregando estatísticas...</p>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Produtos ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Vinho</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor de Tabela</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Carregando produtos...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {searchQuery ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product: Product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getCountryFlag(product.country)}</span>
                          {product.country}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.volume}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(product.type)}>
                          {product.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        R$ {parseFloat(product.negotiatedPrice).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={product.clientCount > 0 ? "default" : "secondary"}
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleViewClients(product)}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {product.clientCount}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewClients(product)}
                            className="text-xs px-2 py-1 h-6"
                          >
                            Ver clientes
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{product.createdByName || "Sistema"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir produto</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o produto "{product.name}"?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteProductMutation.mutate(product.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProductFormModal
        open={isProductModalOpen}
        onOpenChange={handleCloseModal}
        product={editingProduct}
      />

      {selectedProductForClients && (
        <ProductClientsModal
          open={isClientsModalOpen}
          onOpenChange={setIsClientsModalOpen}
          productId={selectedProductForClients.id}
          productName={selectedProductForClients.name}
        />
      )}

      {/* Input oculto para importação de arquivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleImportProducts}
      />
    </div>
  );
}
