import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { RestaurantMenuItem } from "@shared/schema";
import { BlingIntegrationCard } from "@/components/restaurant-pdv/bling-integration-card";
import { MenuItemsTable } from "@/components/restaurant-pdv/menu-items-table";
import { MenuItemFormModal } from "@/components/restaurant-pdv/menu-item-form-modal";

export default function RestaurantMenuManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RestaurantMenuItem | null>(null);

  const { data: items = [] } = useQuery<RestaurantMenuItem[]>({
    queryKey: ["/api/restaurant-pdv/menu-items", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/restaurant-pdv/menu-items?includeInactive=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar cardápio");
      return res.json();
    },
  });

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
            setModalOpen(true);
          }}
          onNewItem={() => {
            setEditingItem(null);
            setModalOpen(true);
          }}
        />
        <MenuItemFormModal open={modalOpen} onOpenChange={setModalOpen} item={editingItem} />
      </div>
    </div>
  );
}
