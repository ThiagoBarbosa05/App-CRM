import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LayoutGrid, Plus, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { RestaurantTable } from "@shared/schema";
import { TableFormModal } from "@/components/restaurant-pdv/table-form-modal";

export default function RestaurantTablesManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  const { data: tables = [] } = useQuery<RestaurantTable[]>({
    queryKey: ["/api/restaurant-pdv/tables", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/restaurant-pdv/tables?includeInactive=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar mesas");
      return res.json();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/restaurant-pdv/tables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-pdv/tables/map"] });
      toast({ title: "Mesa desativada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desativar mesa", description: err.message, variant: "destructive" });
    },
  });

  const activeCount = tables.filter((t) => t.isActive).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={LayoutGrid}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Mesas</PageHeader.Title>
            <PageHeader.Description>
              {activeCount} mesa(s) ativa(s) no salão
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
        <PageHeader.Actions>
          <Button
            size="sm"
            onClick={() => {
              setEditingTable(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Mesa
          </Button>
        </PageHeader.Actions>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Todas as mesas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Seção</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell
                    className="cursor-pointer font-medium"
                    onClick={() => {
                      setEditingTable(table);
                      setModalOpen(true);
                    }}
                  >
                    Mesa {table.number}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {table.capacity}
                    </span>
                  </TableCell>
                  <TableCell>
                    {table.section ? (
                      <Badge variant="secondary">{table.section}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={table.isActive ? "default" : "outline"}>
                      {table.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {table.isActive && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deactivateMutation.mutate(table.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma mesa cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <TableFormModal open={modalOpen} onOpenChange={setModalOpen} table={editingTable} />
    </div>
  );
}
