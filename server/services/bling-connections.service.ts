import { randomUUID } from "crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import {
  blingConnections,
  blingOAuthStates,
  type BlingConnection,
} from "../../shared/schema";
import { decryptToken, encryptToken } from "../lib/token-crypto";
import {
  buildBlingAuthorizationUrl,
  exchangeAuthorizationCode,
  getBlingRedirectUri,
  parseJwtPayload,
  refreshBlingAccessToken,
  revokeBlingToken,
} from "../integrations/bling";

interface CreateConnectionParams {
  userId: string;
  name: string;
  oauthClientId: string;
  oauthClientSecret: string;
}

interface UpdateConnectionSettingsParams {
  connectionId: string;
  userId: string;
  name: string;
  oauthClientId: string;
  oauthClientSecret?: string;
}

interface CallbackParams {
  code: string;
  state: string;
}

function getRefreshTokenExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt;
}

function getAccessTokenExpiryDate(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

function getBlingIdentity(accessToken: string): {
  blingUserId: string | null;
  blingLogin: string | null;
  blingAccountId: string | null;
  blingAccountName: string | null;
} {
  const payload = parseJwtPayload(accessToken);

  return {
    blingUserId:
      typeof payload?.user_id === "string"
        ? payload.user_id
        : typeof payload?.sub === "string"
          ? payload.sub
          : null,
    blingLogin: typeof payload?.login === "string" ? payload.login : null,
    blingAccountId:
      typeof payload?.account_id === "string" ? payload.account_id : null,
    blingAccountName:
      typeof payload?.account_name === "string" ? payload.account_name : null,
  };
}

function sanitizeConnection(connection: BlingConnection) {
  return {
    id: connection.id,
    userId: connection.userId,
    name: connection.name,
    oauthClientId: connection.oauthClientId,
    hasOauthClientSecret: Boolean(connection.oauthClientSecretEncrypted),
    status: connection.status,
    blingUserId: connection.blingUserId,
    blingLogin: connection.blingLogin,
    blingAccountId: connection.blingAccountId,
    blingAccountName: connection.blingAccountName,
    tokenType: connection.tokenType,
    scope: connection.scope,
    accessTokenExpiresAt: connection.accessTokenExpiresAt,
    refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    lastRefreshAt: connection.lastRefreshAt,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

function getOAuthCredentials(connection: BlingConnection) {
  if (!connection.oauthClientId) {
    throw new Error("Client ID do Bling nao configurado");
  }

  if (!connection.oauthClientSecretEncrypted) {
    throw new Error("Client Secret do Bling nao configurado");
  }

  return {
    clientId: connection.oauthClientId,
    clientSecret: decryptToken(connection.oauthClientSecretEncrypted),
  };
}

export class BlingConnectionsService {
  async listByUser(userId: string) {
    const connections = await db
      .select()
      .from(blingConnections)
      .where(eq(blingConnections.userId, userId));

    return connections.map(sanitizeConnection);
  }

  async getById(connectionId: string, userId: string) {
    const [connection] = await db
      .select()
      .from(blingConnections)
      .where(
        and(
          eq(blingConnections.id, connectionId),
          eq(blingConnections.userId, userId),
        ),
      )
      .limit(1);

    return connection ?? null;
  }

  async createConnection(params: CreateConnectionParams) {
    const existingConnection = await db
      .select({ id: blingConnections.id })
      .from(blingConnections)
      .where(
        and(
          eq(blingConnections.userId, params.userId),
          eq(blingConnections.name, params.name),
        ),
      )
      .limit(1);

    if (existingConnection.length > 0) {
      throw new Error("Ja existe uma conexao Bling com esse nome");
    }

    const [connection] = await db
      .insert(blingConnections)
      .values({
        userId: params.userId,
        name: params.name,
        oauthClientId: params.oauthClientId,
        oauthClientSecretEncrypted: encryptToken(params.oauthClientSecret),
        status: "pending",
      })
      .returning();

    return sanitizeConnection(connection);
  }

  async updateConnectionSettings(params: UpdateConnectionSettingsParams) {
    const connection = await this.getById(params.connectionId, params.userId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    const [sameNameConnection] = await db
      .select({ id: blingConnections.id })
      .from(blingConnections)
      .where(
        and(
          eq(blingConnections.userId, params.userId),
          eq(blingConnections.name, params.name),
        ),
      )
      .limit(1);

    if (sameNameConnection && sameNameConnection.id !== connection.id) {
      throw new Error("Ja existe outra conexao Bling com esse nome");
    }

    const credentialsChanged =
      connection.oauthClientId !== params.oauthClientId ||
      Boolean(params.oauthClientSecret && params.oauthClientSecret.length > 0);

    await db
      .update(blingConnections)
      .set({
        name: params.name,
        oauthClientId: params.oauthClientId,
        oauthClientSecretEncrypted: params.oauthClientSecret
          ? encryptToken(params.oauthClientSecret)
          : connection.oauthClientSecretEncrypted,
        status: credentialsChanged ? "reauth_required" : connection.status,
        accessTokenEncrypted: credentialsChanged ? null : connection.accessTokenEncrypted,
        refreshTokenEncrypted: credentialsChanged
          ? null
          : connection.refreshTokenEncrypted,
        accessTokenExpiresAt: credentialsChanged
          ? null
          : connection.accessTokenExpiresAt,
        refreshTokenExpiresAt: credentialsChanged
          ? null
          : connection.refreshTokenExpiresAt,
        lastError: credentialsChanged
          ? "Credenciais OAuth alteradas. Reconecte a conta no Bling."
          : connection.lastError,
        updatedAt: new Date(),
      })
      .where(eq(blingConnections.id, connection.id));

    const updatedConnection = await this.getById(connection.id, params.userId);

    if (!updatedConnection) {
      throw new Error("Conexao Bling nao encontrada apos atualizacao");
    }

    return sanitizeConnection(updatedConnection);
  }

  async createAuthorizationUrl(connectionId: string, userId: string) {
    const connection = await this.getById(connectionId, userId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    const state = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const redirectUri = getBlingRedirectUri();

    await db.insert(blingOAuthStates).values({
      state,
      userId,
      connectionId: connection.id,
      redirectUri,
      expiresAt,
    });

    return {
      state,
      authorizationUrl: buildBlingAuthorizationUrl(state, {
        clientId: connection.oauthClientId,
      }),
      expiresAt,
    };
  }

  async handleOAuthCallback(params: CallbackParams) {
    const [oauthState] = await db
      .select()
      .from(blingOAuthStates)
      .where(eq(blingOAuthStates.state, params.state))
      .limit(1);

    if (!oauthState) {
      throw new Error("State OAuth invalido ou inexistente");
    }

    if (oauthState.consumedAt) {
      throw new Error("State OAuth ja utilizado");
    }

    if (oauthState.expiresAt <= new Date()) {
      throw new Error("State OAuth expirado");
    }

    const [connection] = await db
      .select()
      .from(blingConnections)
      .where(eq(blingConnections.id, oauthState.connectionId))
      .limit(1);

    if (!connection) {
      throw new Error("Conexao Bling da autorizacao nao encontrada");
    }

    const tokenResponse = await exchangeAuthorizationCode(
      params.code,
      getOAuthCredentials(connection),
    );
    const identity = getBlingIdentity(tokenResponse.access_token);
    const accessTokenExpiresAt = getAccessTokenExpiryDate(tokenResponse.expires_in);
    const refreshTokenExpiresAt = getRefreshTokenExpiryDate();

    await db
      .update(blingConnections)
      .set({
        status: "connected",
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        refreshTokenEncrypted: encryptToken(tokenResponse.refresh_token),
        tokenType: tokenResponse.token_type,
        scope: tokenResponse.scope ?? null,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        lastRefreshAt: new Date(),
        lastError: null,
        blingUserId: identity.blingUserId,
        blingLogin: identity.blingLogin,
        blingAccountId: identity.blingAccountId,
        blingAccountName: identity.blingAccountName,
        updatedAt: new Date(),
      })
      .where(eq(blingConnections.id, connection.id));

    await db
      .update(blingOAuthStates)
      .set({ consumedAt: new Date() })
      .where(eq(blingOAuthStates.id, oauthState.id));

    return {
      userId: oauthState.userId,
      connectionId: oauthState.connectionId,
    };
  }

  async refreshConnection(connectionId: string, userId: string) {
    const connection = await this.getById(connectionId, userId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    if (!connection.refreshTokenEncrypted) {
      throw new Error("Conexao sem refresh token salvo");
    }

    try {
      const refreshToken = decryptToken(connection.refreshTokenEncrypted);
      const tokenResponse = await refreshBlingAccessToken(
        refreshToken,
        getOAuthCredentials(connection),
      );
      const identity = getBlingIdentity(tokenResponse.access_token);

      await db
        .update(blingConnections)
        .set({
          status: "connected",
          accessTokenEncrypted: encryptToken(tokenResponse.access_token),
          refreshTokenEncrypted: encryptToken(tokenResponse.refresh_token),
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope ?? connection.scope,
          accessTokenExpiresAt: getAccessTokenExpiryDate(tokenResponse.expires_in),
          refreshTokenExpiresAt: getRefreshTokenExpiryDate(),
          lastRefreshAt: new Date(),
          lastError: null,
          blingUserId: identity.blingUserId,
          blingLogin: identity.blingLogin,
          blingAccountId: identity.blingAccountId,
          blingAccountName: identity.blingAccountName,
          updatedAt: new Date(),
        })
        .where(eq(blingConnections.id, connection.id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao renovar token do Bling";

      await db
        .update(blingConnections)
        .set({
          status: "reauth_required",
          lastError: message,
          updatedAt: new Date(),
        })
        .where(eq(blingConnections.id, connection.id));

      throw error;
    }

    const refreshedConnection = await this.getById(connection.id, userId);

    if (!refreshedConnection) {
      throw new Error("Conexao Bling nao encontrada apos refresh");
    }

    return sanitizeConnection(refreshedConnection);
  }

  async disconnectConnection(connectionId: string, userId: string) {
    const connection = await this.getById(connectionId, userId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    try {
      if (connection.refreshTokenEncrypted) {
        await revokeBlingToken(
          decryptToken(connection.refreshTokenEncrypted),
          getOAuthCredentials(connection),
        );
      }
    } catch (error) {
      console.error(
        "[BlingConnectionsService] Falha ao revogar token do Bling:",
        error,
      );
    }

    await db
      .update(blingConnections)
      .set({
        status: "revoked",
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(blingConnections.id, connection.id));
  }

  async getConnectionStatus(connectionId: string, userId: string) {
    const connection = await this.getById(connectionId, userId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    return sanitizeConnection(connection);
  }

  async refreshConnectionsExpiringSoon() {
    const threshold = new Date(Date.now() + 10 * 60 * 1000);

    const connections = await db
      .select()
      .from(blingConnections)
      .where(eq(blingConnections.status, "connected"));

    const candidates = connections.filter(
      (connection) =>
        connection.accessTokenExpiresAt !== null &&
        connection.accessTokenExpiresAt <= threshold &&
        connection.refreshTokenEncrypted,
    );

    for (const connection of candidates) {
      try {
        await this.refreshConnection(connection.id, connection.userId);
      } catch (error) {
        console.error(
          `[BlingConnectionsService] Erro ao renovar conexao ${connection.id}:`,
          error,
        );
      }
    }

    return candidates.length;
  }

  async getFirstConnectedAccessToken(): Promise<string> {
    const [connection] = await db
      .select()
      .from(blingConnections)
      .where(eq(blingConnections.status, "connected"))
      .limit(1);

    if (!connection?.accessTokenEncrypted) {
      throw new Error(
        "Nenhuma conta Bling conectada encontrada. Configure e conecte uma conta Bling antes de sincronizar vendedores.",
      );
    }

    return decryptToken(connection.accessTokenEncrypted);
  }

  async markExpiredConnections() {
    const now = new Date();
    const expiringConnections = await db
      .select({ id: blingConnections.id })
      .from(blingConnections)
      .where(
        and(
          eq(blingConnections.status, "connected"),
          lt(blingConnections.refreshTokenExpiresAt, now),
        ),
      );

    if (expiringConnections.length === 0) {
      return 0;
    }

    await db
      .update(blingConnections)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(
        inArray(
          blingConnections.id,
          expiringConnections.map((connection) => connection.id),
        ),
      );

    return expiringConnections.length;
  }
}

export const blingConnectionsService = new BlingConnectionsService();
