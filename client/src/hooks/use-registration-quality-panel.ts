import { useQuery } from "@tanstack/react-query";
import type { ClientRegistrationQuality } from "@shared/client-registration-quality";

export interface RegistrationQualityCandidate {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  birthday: string | null;
  email: string | null;
  responsavelId: string | null;
  orderCount: number;
  totalSpent: number;
  lastPurchaseDate: string | null;
  registrationQuality: ClientRegistrationQuality;
}

/**
 * Clientes com compras significativas/frequentes e cadastro incompleto.
 * `responsavelId` é opcional: para admin/gerente filtra por vendedor; se
 * omitido, o backend já restringe automaticamente à carteira de quem chamou
 * quando o usuário logado não é admin/gerente.
 */
export function useRegistrationQualityPanel(responsavelId?: string) {
  return useQuery<RegistrationQualityCandidate[]>({
    queryKey: ["/api/clients/registration-quality-panel", responsavelId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (responsavelId) params.set("responsavelId", responsavelId);
      const query = params.toString();
      const res = await fetch(
        `/api/clients/registration-quality-panel${query ? `?${query}` : ""}`,
      );
      if (!res.ok) throw new Error("Falha ao buscar clientes com cadastro incompleto");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
