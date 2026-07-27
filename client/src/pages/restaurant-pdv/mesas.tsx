import { useLocation } from "wouter";
import { PdvHeader } from "@/components/restaurant-pdv/pdv-header";
import { TableMapGrid } from "./table-map";

export default function RestaurantMesasPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <PdvHeader />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <TableMapGrid
            onOrderOpened={(id) => navigate(`/pdv-restaurante/comanda/${id}`)}
          />
        </div>
      </main>
    </div>
  );
}
