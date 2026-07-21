import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { RestaurantMenuItem, PdvUnit } from "@shared/schema";
import { BlingIntegrationCard } from "@/components/restaurant-pdv/bling-integration-card";
import { MenuItemsTable } from "@/components/restaurant-pdv/menu-items-table";
import { MenuItemFormModal } from "@/components/restaurant-pdv/menu-item-form-modal";
import { AddMenuItemsModal } from "@/components/restaurant-pdv/add-menu-items-modal";
import { getPdvCurrentUnitId } from "@/lib/pdv-unit";

export default function RestaurantMenuManagement() {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RestaurantMenuItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const activeUnitId = getPdvCurrentUnitId();

  const { data: items = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/restaurant-pdv/menu-items?includeInactive=true", {
        credentials: "include",
        headers: activeUnitId ? { "X-PDV-Unit-Id": activeUnitId } : {},
      });
      if (!res.ok) throw new Error("Erro ao buscar cardápio");
      return res.json();
    },
  });

  // Lê a conexão Bling da unidade atual
  const { data: units = [] } = useQuery<PdvUnit[]>({
    queryKey: ["/api/restaurant-pdv/units"],
  });
  const currentUnit = units.find((u) => u.id === activeUnitId);
  const connectionId = currentUnit?.blingConnectionId ?? "";

  return (
    <div className="w-full space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={UtensilsCrossed}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Cardápio</PageHeader.Title>
            <PageHeader.Description>
              Gerencie os itens do cardápio do restaurante
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      <div className="space-y-6">
        <BlingIntegrationCard />
        <MenuItemsTable
          items={items}
          onEditItem={(item) => {
            setEditingItem(item);
            setEditModalOpen(true);
          }}
          onNewItem={() => setAddModalOpen(true)}
        />
        <MenuItemFormModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          item={editingItem}
        />
        <AddMenuItemsModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          connectionId={connectionId}
          existingMenuItems={items}
        />
      </div>
    </div>
  );
}
