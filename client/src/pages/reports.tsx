import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyReports } from "@/hooks/useReports";

// Components
import { ReportsHeader } from "@/components/reports/reports-header";
import { ReportsStatistics } from "@/components/reports/reports-statistics";
import { ReportsBirthdayList } from "@/components/reports/reports-birthday-list";
import { ClientReportsGrid } from "@/components/reports/client-reports-grid";
import { CompanyReportsGrid } from "@/components/reports/company-reports-grid";

export default function Reports() {
  const { user } = useAuth();

  // Data Hooks
  const { data: companyReports, isLoading: isCompanyReportsLoading } = useCompanyReports();

  const { data: clients = [], isLoading: isClientsLoading } = useQuery<any[]>({
    queryKey: ["/api/clients", user?.id, user?.role, "all"],
    queryFn: async () => {
      const response = await fetch(
        user?.role === "admin"
          ? "/api/clients/export-all"
          : `/api/clients?userId=${user?.id}&userRole=${user?.role}&pageSize=10000`,
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies", user?.id, user?.role, "all"],
    queryFn: async () => {
      const response = await fetch(
        user?.role === "admin"
          ? "/api/companies?pageSize=10000"
          : `/api/companies?userId=${user?.id}&userRole=${user?.role}&pageSize=10000`,
        {
          headers: {
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/tags/categories"] });
  const { data: origins = [] } = useQuery<any[]>({ queryKey: ["/api/tags/origins"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: markers = [] } = useQuery<any[]>({ queryKey: ["/api/tags/markers"] });

  // Data Processing
  const validCategoryNames = new Set(categories.map((cat) => cat.name));
  const validOriginNames = new Set(origins.map((origin) => origin.name));
  const validUserIds = new Set(users.map((u) => u.id));
  const validMarkerNames = new Set(markers.map((m) => m.name));

  const clientsArray = Array.isArray(clients) ? clients : [];

  const clientsByCategory = clientsArray.reduce((acc, client) => {
    const category = client.categoria;
    if (!category) acc["Sem categoria"] = (acc["Sem categoria"] || 0) + 1;
    else if (validCategoryNames.has(category)) acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const clientsByOrigin = clientsArray.reduce((acc, client) => {
    const origin = client.origem;
    if (!origin) acc["Sem origem"] = (acc["Sem origem"] || 0) + 1;
    else if (validOriginNames.has(origin)) acc[origin] = (acc[origin] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const clientsByUser = clientsArray.reduce((acc, client) => {
    const responsibleId = client.responsavelId;
    if (!responsibleId) acc["Sem responsável"] = (acc["Sem responsável"] || 0) + 1;
    else if (validUserIds.has(responsibleId)) {
      const u = users.find((u) => u.id === responsibleId);
      acc[u ? u.name : "Usuário não encontrado"] = (acc[u ? u.name : "Usuário não encontrado"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const clientsByMarkers = clientsArray.reduce((acc, client) => {
    const clientMarkers = client.markers || [];
    const validClientMarkers = clientMarkers.filter((m: string) => validMarkerNames.has(m));
    if (validClientMarkers.length === 0) acc["Sem marcador"] = (acc["Sem marcador"] || 0) + 1;
    else validClientMarkers.forEach((m: string) => acc[m] = (acc[m] || 0) + 1);
    return acc;
  }, {} as Record<string, number>);

  if (isClientsLoading || !user) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />)}
        </div>
        <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <ReportsHeader />

      <ReportsStatistics
        totalClients={clientsArray.length}
        totalCompanies={companyReports?.totalCompanies || companies.length}
        upcomingBirthdaysCount={clientsArray.filter(c => {
           if (!c.birthday) return false;
           const today = new Date();
           today.setHours(0,0,0,0);
           const bday = new Date(c.birthday);
           const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
           const nextBday = thisYearBday < today ? new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate()) : thisYearBday;
           const diff = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
           return diff <= 30;
        }).length}
        totalSectors={companyReports?.companiesBySector.length || 0}
      />

      <div className="grid grid-cols-1 gap-8">
        <ReportsBirthdayList clients={clientsArray} />
        
        <ClientReportsGrid
          clientsByCategory={clientsByCategory}
          clientsByOrigin={clientsByOrigin}
          clientsByUser={clientsByUser}
          clientsByMarkers={clientsByMarkers}
          markersInfo={markers}
        />

        <CompanyReportsGrid
          stats={companyReports}
          isLoading={isCompanyReportsLoading}
        />
      </div>
    </div>
  );
}
