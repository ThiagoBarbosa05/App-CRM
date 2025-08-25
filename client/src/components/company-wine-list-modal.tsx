
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Wine,
  Trash2,
  Search,
  MapPin,
  DollarSign,
  Package,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Company, Product } from "@shared/schema";

interface CompanyWineListModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
}

interface CompanyProduct {
  id: string;
  companyId: string;
  productId: string;
  customNegotiatedPrice?: string;
  isActive: string;
  addedAt: string;
  product: Product;
}

export default function CompanyWineListModal({
  company,
  isOpen,
  onClose,
}: CompanyWineListModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar carta de vinhos da empresa
  const { data: companyProducts = [], isLoading } = useQuery<CompanyProduct[]>({
    queryKey: ["/api/companies", company?.id, "products"],
    queryFn: async () => {
      if (!company?.id) return [];
      const response = await fetch(`/api/companies/${company.id}/products`);
      if (!response.ok) throw new Error("Failed to fetch company products");
      return response.json();
    },
    enabled: isOpen && !!company?.id,
  });

  // Buscar produtos disponíveis para adicionar
  const { data: availableProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/companies", company?.id, "available-products"],
    queryFn: async () => {
      if (!company?.id) return [];
      const response = await fetch(`/api/companies/${company.id}/available-products`);
      if (!response.ok) throw new Error("Failed to fetch available products");
      return response.json();
    },
    enabled: isOpen && !!company?.id,
  });

  // Mutation para adicionar produto
  const addProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/companies/${company?.id}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({ productId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao adicionar produto");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/companies", company?.id, "products"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/companies", company?.id, "available-products"],
      });
      setSelectedProductId("");
      toast({
        title: "Sucesso!",
        description: "Produto adicionado à carta de vinhos",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para remover produto
  const removeProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(
        `/api/companies/${company?.id}/products/${productId}`,
        {
          method: "DELETE",
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao remover produto");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/companies", company?.id, "products"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/companies", company?.id, "available-products"],
      });
      toast({
        title: "Sucesso!",
        description: "Produto removido da carta de vinhos",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover produto da carta",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar preço customizado
  const updatePriceMutation = useMutation({
    mutationFn: async ({ productId, price }: { productId: string; price: string }) => {
      console.log("Updating price for product", productId, "to", price);
      console.log("URL:", `/api/companies/${company.id}/products/${productId}/price`);
      
      if (!company?.id || !productId || !price) {
        throw new Error("Dados incompletos para atualização");
      }

      const response = await fetch(
        `/api/companies/${company.id}/products/${productId}/price`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
          body: JSON.stringify({ customPrice: price }),
        }
      );

      if (!response.ok) {
        let errorMessage = "Erro ao atualizar preço";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // Se não conseguir fazer parse do JSON, usar mensagem padrão
          console.error("Error parsing response:", parseError);
          if (response.status === 404) {
            errorMessage = "Produto não encontrado na carta da empresa";
          } else if (response.status >= 500) {
            errorMessage = "Erro interno do servidor";
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Price update successful:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/companies", company?.id, "products"],
      });
      setEditingPriceId(null);
      setCustomPrice("");
      toast({
        title: "Sucesso!",
        description: "Preço atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar preço",
        variant: "destructive",
      });
    },
  });

  const filteredProducts = companyProducts.filter((item) =>
    item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtrar produtos disponíveis baseado na busca
  const filteredAvailableProducts = availableProducts.filter((product) =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.country.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.type.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    const colors = {
      TINTO: "bg-red-100 text-red-800",
      BRANCO: "bg-yellow-100 text-yellow-800",
      ROSE: "bg-pink-100 text-pink-800",
      ESPUMANTE: "bg-blue-100 text-blue-800",
      "PÓS-REFEIÇÃO": "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(price));
  };

  const handleEditPrice = (item: CompanyProduct) => {
    setEditingPriceId(item.id);
    setCustomPrice(item.customNegotiatedPrice || item.product.negotiatedPrice);
  };

  const handleSavePrice = (productId: string) => {
    if (!customPrice || customPrice.trim() === "") {
      toast({
        title: "Erro",
        description: "Por favor, insira um preço válido",
        variant: "destructive",
      });
      return;
    }

    // Converter vírgula para ponto e validar
    const priceValue = customPrice.replace(',', '.');
    const numericPrice = parseFloat(priceValue);
    
    if (isNaN(numericPrice) || numericPrice < 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um preço válido",
        variant: "destructive",
      });
      return;
    }

    updatePriceMutation.mutate({ productId, price: numericPrice.toString() });
  };

  const handleCancelEdit = () => {
    setEditingPriceId(null);
    setCustomPrice("");
  };

  if (!company) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-wine-600" />
            Carta de Vinhos - {company.nomeFantasia}
          </DialogTitle>
          <DialogDescription>
            Gerencie os vinhos disponíveis para esta empresa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Adicionar novo produto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-4 w-4" />
                Adicionar Produto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um produto para adicionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-2">
                      <Input
                        placeholder="Digite o nome do vinho para buscar..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredAvailableProducts.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-gray-500">
                          {productSearchTerm ? "Nenhum vinho encontrado" : "Nenhum produto disponível"}
                        </div>
                      ) : (
                        filteredAvailableProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {product.country} ({product.volume})
                          </SelectItem>
                        ))
                      )}
                    </div>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => addProductMutation.mutate(selectedProductId)}
                  disabled={!selectedProductId || addProductMutation.isPending}
                  className="bg-wine-600 hover:bg-wine-700"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar vinhos na carta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de produtos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Carta de Vinhos ({filteredProducts.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Carregando carta de vinhos...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Wine className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    {searchQuery
                      ? "Nenhum vinho encontrado com essa busca"
                      : "Nenhum vinho na carta ainda"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredProducts.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">
                              {item.product.name}
                            </h3>
                            <Badge className={getTypeColor(item.product.type)}>
                              {item.product.type}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span>{item.product.country}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-gray-400" />
                              <span>{item.product.volume}</span>
                            </div>
                          </div>

                          {/* Preço Negociado Customizado */}
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-green-700">
                                Preço para {company.nomeFantasia}:
                              </span>
                              {editingPriceId === item.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    value={customPrice}
                                    onChange={(e) => {
                                      // Permitir apenas números, vírgula e ponto
                                      const value = e.target.value.replace(/[^0-9.,]/g, '');
                                      setCustomPrice(value);
                                    }}
                                    placeholder="0,00"
                                    className="w-28 h-8 text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleSavePrice(item.product.id)}
                                    disabled={updatePriceMutation.isPending}
                                  >
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-green-700">
                                    {formatPrice(item.customNegotiatedPrice || item.product.negotiatedPrice)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditPrice(item)}
                                    className="h-8 px-2"
                                  >
                                    Editar
                                  </Button>
                                </div>
                              )}
                            </div>
                            {item.customNegotiatedPrice && (
                              <p className="text-xs text-green-600 mt-1">
                                Preço personalizado definido
                              </p>
                            )}
                          </div>

                          <div className="mt-2 text-xs text-gray-500">
                            Adicionado em{" "}
                            {new Date(item.addedAt).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeProductMutation.mutate(item.product.id)}
                          disabled={removeProductMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
