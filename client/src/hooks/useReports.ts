import { useQuery } from "@tanstack/react-query";
import {
  buildClientAnalyticsSearchParams,
  type ClientAnalyticsFilters,
} from "@/lib/client-analytics-filters";
import { useAuth } from "./useAuth";

// Types for the API responses
export interface CompanyReportsData {
  totalCompanies: number;
  companiesBySector: Array<{
    sectorId: string | null;
    sectorName: string;
    count: number;
  }>;
  companiesByUser: Array<{
    userId: string | null;
    userName: string;
    count: number;
  }>;
  companiesByState: Array<{
    state: string | null;
    count: number;
  }>;
  companiesByCity: Array<{
    city: string | null;
    count: number;
  }>;
  companiesActive: number;
  companiesInactive: number;
  companiesWithCNPJ: number;
  companiesWithoutCNPJ: number;
}

export interface ClientReportsData {
  totalClients: number;
  clientsByCategory: Array<{
    category: string | null;
    count: number;
  }>;
  clientsByOrigin: Array<{
    origin: string | null;
    count: number;
  }>;
  clientsByUser: Array<{
    userId: string | null;
    userName: string;
    count: number;
  }>;
  clientsByMarkers: Array<{
    marker: string;
    count: number;
  }>;
  upcomingBirthdays: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
    birthday: string;
    daysUntil: number;
  }>;
  clientsWithEmail: number;
  clientsWithoutEmail: number;
  clientsWithPhone: number;
  clientsWithoutPhone: number;
  clientsWithCPF: number;
  clientsWithoutCPF: number;
  clientsWithAddress: number;
  clientsWithoutAddress: number;
}

export interface GeneralReportsData {
  totalClients: number;
  totalCompanies: number;
  totalUsers: number;
  totalSectors: number;
  clientsByCategory: Array<{
    category: string | null;
    count: number;
  }>;
  clientsByOrigin: Array<{
    origin: string | null;
    count: number;
  }>;
  clientsByUser: Array<{
    userId: string | null;
    userName: string;
    count: number;
  }>;
  companiesBySector: Array<{
    sectorId: string | null;
    sectorName: string;
    count: number;
  }>;
  recentStats: {
    newClientsThisMonth: number;
    newCompaniesThisMonth: number;
    totalInteractionsThisMonth: number;
  };
  growthStats: {
    clientGrowthPercent: number;
    companyGrowthPercent: number;
    interactionGrowthPercent: number;
  };
}

interface UseClientReportsOptions {
  filterUserId?: string | null;
  search?: string;
  filters?: ClientAnalyticsFilters;
  purchaseStatusDays?: number;
}

/**
 * Hook to fetch general reports data
 * Includes overview statistics for clients, companies and recent activity
 */
export const useGeneralReports = () => {
  const { user } = useAuth();

  return useQuery<GeneralReportsData>({
    queryKey: ["reports", "general", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch("/api/reports/general", {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch general reports");
      }

      return response.json();
    },
    enabled: !!user,
    // Cache for 5 minutes since reports don't change frequently
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch client reports data
 * Optimized query for client-specific statistics
 */
export const useClientReports = ({
  filterUserId,
  search,
  filters,
  purchaseStatusDays,
}: UseClientReportsOptions = {}) => {
  const { user } = useAuth();

  return useQuery<ClientReportsData>({
    queryKey: [
      "reports",
      "clients",
      user?.id,
      user?.role,
      filterUserId,
      search,
      filters,
      purchaseStatusDays,
    ],
    queryFn: async () => {
      const params = buildClientAnalyticsSearchParams({
        filterUserId,
        search,
        filters,
        purchaseStatusDays,
      });
      const url = `/api/reports/clients${params.size ? `?${params}` : ""}`;
      const response = await fetch(url, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch client reports");
      }

      return response.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch company reports data
 * Optimized query for company-specific statistics
 */
export const useCompanyReports = () => {
  const { user } = useAuth();

  return useQuery<CompanyReportsData>({
    queryKey: ["reports", "companies", user?.id, user?.role],
    queryFn: async () => {
      const response = await fetch("/api/reports/companies", {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch company reports");
      }

      return response.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};
