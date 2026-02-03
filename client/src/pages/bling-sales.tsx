import { useState } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  useBlingOrders,
  useSalesStatistics,
  useTopProducts,
  useTopSellers,
} from "@/hooks/use-bling-orders";
import { SalesStatisticsCards } from "@/components/bling-sales/sales-statistics-cards";
import { TopSellersChart } from "@/components/bling-sales/top-sellers-chart";
import { TopProductsChart } from "@/components/bling-sales/top-products-chart";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { OrdersTable } from "@/components/bling-sales/orders-table";

export default function BlingSalesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Default to last 90 days to show data by default
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });

  // Advanced filters
  const [contactName, setContactName] = useState("");
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [storeId, setStoreId] = useState<string | undefined>();
  const [situationId, setSituationId] = useState<string | undefined>();

  const formattedStartDate = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : "";
  const formattedEndDate = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : formattedStartDate; // Fallback to start date if end date is missing

  // Fetch Stats
  const { data: salesStats, isLoading: isStatsLoading } = useSalesStatistics(
    formattedStartDate,
    formattedEndDate
  );

  // Fetch Top Sellers
  const { data: topSellers, isLoading: isTopSellersLoading } = useTopSellers(
    formattedStartDate,
    formattedEndDate,
    5
  );

  // Fetch Top Products
  const { data: topProducts, isLoading: isTopProductsLoading } = useTopProducts(
    formattedStartDate,
    formattedEndDate,
    5
  );

  // Fetch Orders with all filters
  const { data: ordersData, isLoading: isOrdersLoading } = useBlingOrders({
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    contactName: contactName || undefined,
    sellerId,
    storeId,
    situationId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Calculate hasMore (assuming the API doesn't return total count yet, or we'd check against total)
  // For now, if we got a full page, assume there might be more
  const hasMore = ordersData ? ordersData.length === pageSize : false;

  // Reset page when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Vendas Bling</h2>
      </div>

      <OrdersFilters
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
          handleFilterChange();
        }}
        contactName={contactName}
        onContactNameChange={(name) => {
          setContactName(name);
          handleFilterChange();
        }}
        sellerId={sellerId}
        onSellerIdChange={(id) => {
          setSellerId(id);
          handleFilterChange();
        }}
        storeId={storeId}
        onStoreIdChange={(id) => {
          setStoreId(id);
          handleFilterChange();
        }}
        situationId={situationId}
        onSituationIdChange={(id) => {
          setSituationId(id);
          handleFilterChange();
        }}
        isLoading={isOrdersLoading}
      />

      <SalesStatisticsCards
        totalOrders={salesStats?.totalOrders}
        totalValue={salesStats?.totalValue}
        averageValue={salesStats?.averageValue}
        isLoading={isStatsLoading}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <TopSellersChart
          data={topSellers}
          isLoading={isTopSellersLoading}
        />
        <TopProductsChart
          data={topProducts}
          isLoading={isTopProductsLoading}
        />
      </div>

      <OrdersTable
        orders={ordersData || []}
        isLoading={isOrdersLoading}
        page={page}
        onPageChange={setPage}
        hasMore={hasMore}
      />
    </div>
  );
}
