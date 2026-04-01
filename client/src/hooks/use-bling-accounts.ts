import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface BlingAccountConnection {
  id: string;
  userId: string;
  name: string;
  oauthClientId: string;
  hasOauthClientSecret: boolean;
  status:
    | "pending"
    | "connected"
    | "expired"
    | "reauth_required"
    | "revoked"
    | "error";
  blingUserId: string | null;
  blingLogin: string | null;
  blingAccountId: string | null;
  blingAccountName: string | null;
  tokenType: string | null;
  scope: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastRefreshAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BlingAccountsResponse {
  success: boolean;
  data: BlingAccountConnection[];
}

interface AuthorizationPayload {
  success: boolean;
  data: {
    state: string;
    authorizationUrl: string;
    expiresAt: string;
  };
}

export function useBlingAccounts() {
  return useQuery<BlingAccountConnection[]>({
    queryKey: ["/api/bling-accounts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/bling-accounts");
      const data = (await response.json()) as BlingAccountsResponse;
      return data.data;
    },
  });
}

export function useCreateBlingConnection() {
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      oauthClientId: string;
      oauthClientSecret: string;
    }) => {
      const response = await apiRequest("POST", "/api/bling-accounts/connect", {
        name: payload.name,
        oauthClientId: payload.oauthClientId,
        oauthClientSecret: payload.oauthClientSecret,
      });
      return (await response.json()) as AuthorizationPayload;
    },
  });
}

export function useUpdateBlingConnection() {
  return useMutation({
    mutationFn: async (payload: {
      connectionId: string;
      name: string;
      oauthClientId: string;
      oauthClientSecret?: string;
    }) => {
      const response = await apiRequest(
        "PUT",
        `/api/bling-accounts/${payload.connectionId}`,
        {
          name: payload.name,
          oauthClientId: payload.oauthClientId,
          oauthClientSecret: payload.oauthClientSecret,
        },
      );

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bling-accounts"] });
    },
  });
}

export function useReconnectBlingConnection() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${connectionId}/reconnect`,
      );
      return (await response.json()) as AuthorizationPayload;
    },
  });
}

export function useRefreshBlingConnection() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${connectionId}/refresh`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bling-accounts"] });
    },
  });
}

export function useDisconnectBlingConnection() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${connectionId}/disconnect`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bling-accounts"] });
    },
  });
}
