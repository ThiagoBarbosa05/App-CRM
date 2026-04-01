import { useEffect, useState } from "react";
import { Loader2, Save, Wand2, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBlingVendedores, useSyncBlingVendors, useUsersForSync } from "@/hooks/use-bling-vendors-sync";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function BlingVendedoresSync() {
  const { data: users, isLoading: usersLoading } = useUsersForSync();
  const { data: blingVendedores, isLoading: vendoresLoading, error: vendoresError } = useBlingVendedores();
  const syncMutation = useSyncBlingVendors();

  const [mappings, setMappings] = useState<Map<string, string | null>>(new Map());

  // Inicializa o estado com os valores já salvos quando os dados chegam
  useEffect(() => {
    if (users) {
      setMappings(
        new Map(users.map((u) => [u.id, u.blingVendedorId ?? null])),
      );
    }
  }, [users]);

  function handleAutoMatch() {
    if (!users || !blingVendedores) return;

    setMappings((prev) => {
      const next = new Map(prev);

      for (const user of users) {
        const match = blingVendedores.find(
          (v) => normalizeName(v.contato.nome) === normalizeName(user.name),
        );
        if (match) {
          next.set(user.id, String(match.id));
        }
      }

      return next;
    });
  }

  function handleSave() {
    if (!users) return;

    const payload = users.map((u) => ({
      userId: u.id,
      blingVendedorId: mappings.get(u.id) ?? null,
    }));

    syncMutation.mutate(payload);
  }

  const isNoBlingAccount =
    vendoresError &&
    (vendoresError as Error & { status?: number }).status === 422;

  const isLoading = usersLoading || vendoresLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Vincular Vendedores ao Bling
            </CardTitle>
            <CardDescription className="mt-1">
              Associe cada usuário do sistema ao seu respectivo vendedor cadastrado no Bling.
              Esse vínculo é utilizado para filtrar pedidos e relatórios por vendedor.
            </CardDescription>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoMatch}
              disabled={isLoading || isNoBlingAccount || syncMutation.isPending}
            >
              <Wand2 className="size-4 mr-2" />
              Auto-combinar por nome
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading || syncMutation.isPending || !users?.length}
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Salvar mapeamento
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isNoBlingAccount && (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma conta Bling conectada</AlertTitle>
            <AlertDescription>
              Configure e conecte uma conta Bling na aba <strong>Contas Bling</strong> antes de
              sincronizar os vendedores.
            </AlertDescription>
          </Alert>
        )}

        {vendoresError && !isNoBlingAccount && (
          <Alert variant="destructive">
            <AlertTitle>Erro ao carregar vendedores do Bling</AlertTitle>
            <AlertDescription>{vendoresError.message}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !users?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum usuário com perfil de vendedor ou gerente encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Vendedor no Bling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={user.role === "gerente" ? "secondary" : "outline"}>
                      {user.role === "gerente" ? "Gerente" : "Vendedor"}
                    </Badge>
                  </TableCell>

                  <TableCell className="min-w-[220px]">
                    <Select
                      value={mappings.get(user.id) ?? ""}
                      onValueChange={(value) =>
                        setMappings((prev) =>
                          new Map(prev).set(user.id, value === "" ? null : value),
                        )
                      }
                      disabled={!blingVendedores || !!isNoBlingAccount}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="— Não vinculado —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Não vinculado —</SelectItem>
                        {blingVendedores?.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.contato.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
