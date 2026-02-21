import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import InteractionFormModal from "@/components/interaction-form-modal";
import { AcompanhamentoHeader } from "@/components/acompanhamento/acompanhamento-header";
import { AcompanhamentoMetrics } from "@/components/acompanhamento/acompanhamento-metrics";
import { AcompanhamentoFilters } from "@/components/acompanhamento/acompanhamento-filters";
import { AcompanhamentoList } from "@/components/acompanhamento/acompanhamento-list";

interface ClientWithStats {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  createdAt: string;
  daysSinceCreated: number;
  responsavelName?: string;
}

interface AcompanhamentoData {
  clients: ClientWithStats[];
  stats: {
    totalPendentes: number;
    criticos: number;
    alta: number;
    media: number;
    normal: number;
    produtividade: number;
    totalInteracoes: number;
    mediaInteracoes: string;
  };
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

export default function Acompanhamento() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(
    null,
  );
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1); // Reset page to 1 on new search
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const { data, isLoading, error, isFetching } = useQuery<AcompanhamentoData>({
    queryKey: ["/api/acompanhamento", debouncedSearchQuery, page],
    queryFn: async ({ queryKey }) => {
      const [, search, currentPage] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: "10",
      });
      if (search) {
        params.append("search", search as string);
      }

      const res = await fetch(`/api/acompanhamento?${params.toString()}`, {
        headers: {
          "x-user-id": user!.id,
          "x-user-role": user!.role,
        },
      });
      if (!res.ok) {
        throw new Error("Falha ao buscar dados de acompanhamento");
      }
      return res.json();
    },
    enabled: !!user,
    placeholderData: keepPreviousData, // Prevents UI flickering on pagination
  });

  const clients = data?.clients ?? [];
  const stats = data?.stats ?? {
    totalPendentes: 0,
    criticos: 0,
    alta: 0,
    media: 0,
    normal: 0,
    produtividade: 100,
    totalInteracoes: 0,
    mediaInteracoes: "0",
  };
  const pagination = data?.pagination;

  const handleContact = (client: ClientWithStats) => {
    setSelectedClient(client);
    setIsInteractionModalOpen(true);
  };

  if (error) {
    return (
      <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        <div
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 px-5 py-4 rounded-xl relative flex items-start gap-4"
          role="alert"
        >
          <div className="h-10 w-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center shrink-0">
             <span className="text-xl">⚠️</span>
          </div>
          <div>
            <strong className="font-bold block text-lg mb-1">Erro!</strong>
            <span className="block sm:inline opacity-90">
              Não foi possível carregar os dados de acompanhamento. Tente atualizar a página.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <AcompanhamentoHeader totalPendentes={stats.totalPendentes} />

      <AcompanhamentoFilters 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <AcompanhamentoMetrics stats={stats} />

      <AcompanhamentoList 
        clients={clients}
        isLoading={isLoading}
        isFetching={isFetching}
        searchQuery={debouncedSearchQuery}
        pagination={pagination}
        page={page}
        setPage={setPage}
        onContactClick={handleContact}
      />

      {selectedClient && (
        <InteractionFormModal
          open={isInteractionModalOpen}
          onOpenChange={setIsInteractionModalOpen}
          target={{ id: selectedClient.id, type: "client" }}
        />
      )}
    </div>
  );
}
