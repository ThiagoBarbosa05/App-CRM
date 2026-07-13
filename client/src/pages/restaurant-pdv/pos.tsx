import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArrowLeft, Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { RestaurantMenuItem, RestaurantOrderItem, RestaurantOrder } from "@shared/schema";

interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
];

const ACTIVE_ORDER_KEY = "restaurant-pdv-active-order-id";

export default function RestaurantPos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ORDER_KEY),
  );
  const [tableNumber, setTableNumber] = useState("");
  const [peopleCount, setPeopleCount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const setActiveOrder = (id: string | null) => {
    setActiveOrderId(id);
    if (id) localStorage.setItem(ACTIVE_ORDER_KEY, id);
    else localStorage.removeItem(ACTIVE_ORDER_KEY);
  };

  const { data: menuItems = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items"],
  });

  const { data: order, isLoading: isLoadingOrder } = useQuery<RestaurantOrderWithItems>({
    queryKey: ["/api/restaurant-pdv/orders", activeOrderId],
    enabled: !!activeOrderId,
  });

  const invalidateOrder = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/restaurant-pdv/orders", activeOrderId],
    });

  const openOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/restaurant-pdv/orders", {
        tableNumber: Number(tableNumber),
        peopleCount: Number(peopleCount),
      });
      return res.json() as Promise<RestaurantOrder>;
    },
    onSuccess: (created) => {
      setActiveOrder(created.id);
      setTableNumber("");
      setPeopleCount("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao abrir mesa", description: err.message, variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: {
      menuItemId?: string | null;
      name: string;
      unitPrice: string;
      quantity: number;
    }) => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/items`, data);
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar item", description: err.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: { unitPrice?: string; quantity?: number };
    }) => {
      await apiRequest(
        "PUT",
        `/api/restaurant-pdv/orders/${activeOrderId}/items/${itemId}`,
        data,
      );
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar item", description: err.message, variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest(
        "DELETE",
        `/api/restaurant-pdv/orders/${activeOrderId}/items/${itemId}`,
      );
    },
    onSuccess: invalidateOrder,
    onError: (err: Error) => {
      toast({ title: "Erro ao remover item", description: err.message, variant: "destructive" });
    },
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/restaurant-pdv/orders/${activeOrderId}/close`, {
        paymentMethod,
      });
    },
    onSuccess: () => {
      toast({ title: "Comanda fechada", description: "Venda registrada com sucesso!" });
      setActiveOrder(null);
      setPaymentMethod("");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao fechar comanda", description: err.message, variant: "destructive" });
    },
  });

  const handleAddMenuItem = (menuItem: RestaurantMenuItem) => {
    const existing = order?.items.find((i) => i.menuItemId === menuItem.id);
    if (existing) {
      updateItemMutation.mutate({
        itemId: existing.id,
        data: { quantity: existing.quantity + 1 },
      });
    } else {
      addItemMutation.mutate({
        menuItemId: menuItem.id,
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: 1,
      });
    }
  };

  const handleAddCustomItem = () => {
    const price = customPrice.replace(",", ".");
    if (!customName.trim() || !price || Number(price) <= 0) return;
    addItemMutation.mutate({
      menuItemId: null,
      name: customName.trim(),
      unitPrice: price,
      quantity: 1,
    });
    setCustomName("");
    setCustomPrice("");
  };

  const items = order?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );
  const serviceFee = subtotal * 0.1;
  const total = subtotal + serviceFee;

  const isGarcom = user?.role === "garcom";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        {!isGarcom && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-muted-foreground"
              onClick={() => navigate("/pdv-restaurante/comandas")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <Separator orientation="vertical" className="h-5 shrink-0" />
          </>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">PDV Restaurante</span>
        </div>
        {user?.name && (
          <span className="ml-auto text-xs text-muted-foreground">
            Garçom: {user.name}
          </span>
        )}
      </header>

      <main className="flex-1 overflow-auto">
        {!activeOrderId ? (
          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5" />
                  Abrir Mesa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="table-number">Número da Mesa</Label>
                  <Input
                    id="table-number"
                    type="number"
                    min="1"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ex: 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="people-count">Número de Pessoas</Label>
                  <Input
                    id="people-count"
                    type="number"
                    min="1"
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(e.target.value)}
                    placeholder="Ex: 4"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !tableNumber ||
                    !peopleCount ||
                    Number(tableNumber) <= 0 ||
                    Number(peopleCount) <= 0 ||
                    openOrderMutation.isPending
                  }
                  onClick={() => openOrderMutation.mutate()}
                >
                  Abrir Comanda
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : isLoadingOrder || !order ? (
          <div className="p-6 text-center text-muted-foreground">Carregando comanda...</div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">Mesa {order.tableNumber}</h1>
                <p className="text-sm text-muted-foreground">
                  {order.peopleCount} pessoa(s)
                </p>
              </div>
              <Badge variant="outline" className="uppercase">
                {order.status}
              </Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cardápio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {menuItems.map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="h-auto flex-col items-start p-3 text-left"
                        onClick={() => handleAddMenuItem(item)}
                        disabled={addItemMutation.isPending || updateItemMutation.isPending}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(item.price)}
                        </span>
                      </Button>
                    ))}
                    {menuItems.length === 0 && (
                      <p className="col-span-2 text-sm text-muted-foreground">
                        Nenhum item cadastrado no cardápio.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t pt-4">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Item avulso
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                      <Input
                        placeholder="Valor"
                        className="w-28"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                      />
                      <Button variant="secondary" onClick={handleAddCustomItem}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comanda</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qtd.</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                disabled={item.quantity <= 1}
                                onClick={() =>
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    data: { quantity: item.quantity - 1 },
                                  })
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center">{item.quantity}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() =>
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    data: { quantity: item.quantity + 1 },
                                  })
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-24"
                              defaultValue={item.unitPrice}
                              onBlur={(e) => {
                                const value = e.target.value.replace(",", ".");
                                if (value !== item.unitPrice && Number(value) > 0) {
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    data: { unitPrice: value },
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => removeItemMutation.mutate(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhum item adicionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div className="mt-4 space-y-2 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de serviço (10%)</span>
                      <span>{formatCurrency(serviceFee)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t pt-4">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Forma de pagamento
                    </Label>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                      {PAYMENT_METHODS.map((method) => (
                        <div key={method.value} className="flex items-center gap-2">
                          <RadioGroupItem value={method.value} id={method.value} />
                          <Label htmlFor={method.value} className="font-normal">
                            {method.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="mt-4 w-full"
                        disabled={items.length === 0 || !paymentMethod}
                      >
                        Fechar Comanda
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Fechar comanda da Mesa {order.tableNumber}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Total de {formatCurrency(total)} (com taxa de serviço de 10%),
                          pagamento em{" "}
                          {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}. Esta
                          ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => closeOrderMutation.mutate()}>
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
