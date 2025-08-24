
import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Wine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  tablePrice: string;
  negotiatedPrice: string;
  createdByName: string;
  createdAt: string;
}

export default function Products() {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
          <Button
            onClick={() => setIsProductModalOpen(true)}
            className="bg-wine-600 hover:bg-wine-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
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
                  <TableHead>Valor Tabela</TableHead>
                  <TableHead>Valor Negociado</TableHead>
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
                        R$ {parseFloat(product.tablePrice).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>
                        R$ {parseFloat(product.negotiatedPrice).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>{product.createdByName}</TableCell>
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
    </div>
  );
}
