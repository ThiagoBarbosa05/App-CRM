import { randomUUID } from "crypto";
import { and, eq, lt, lte } from "drizzle-orm";
import { db, pool } from "../db";
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
  BlingApiError,
} from "../integrations/bling";

const DEFAULT_ACCESS_TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_MAINTENANCE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const refreshesInFlight = new Map<string, Promise<ReturnType<typeof sanitizeConnection>>>();

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isDefinitiveOAuthFailure(error: unknown): boolean {
  return (
    (error instanceof BlingApiError &&
      (error.status === 400 || error.status === 401)) ||
    (error instanceof Error &&
      (error.message.includes("Client ID") ||
        error.message.includes("Client Secret")))
  );
}

interface RefreshConnectionOptions {
  force?: boolean;
  rejectedAccessToken?: string;
  expectedRefreshTokenExpiresAt?: Date | null;
}

interface CreateConnectionParams {
  userId: string;
  name: string;
  oauthClientId: string;
  oauthClientSecret: string;
}

interface UpdateConnectionSettingsParams {
  connectionId: string;
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
  async listAll() {
    const connections = await db.select().from(blingConnections);
    return connections.map(sanitizeConnection);
  }

  async getById(connectionId: string) {
    const [connection] = await db
      .select()
      .from(blingConnections)
      .where(eq(blingConnections.id, connectionId))
      .limit(1);

    return connection ?? null;
  }

  async createConnection(params: CreateConnectionParams) {
    const existingConnection = await db
      .select({ id: blingConnections.id })
      .from(blingConnections)
      .where(eq(blingConnections.name, params.name))
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
    const connection = await this.getById(params.connectionId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    const [sameNameConnection] = await db
      .select({ id: blingConnections.id })
      .from(blingConnections)
      .where(eq(blingConnections.name, params.name))
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
        accessTokenEncrypted: credentialsChanged
          ? null
          : connection.accessTokenEncrypted,
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

    const updatedConnection = await this.getById(connection.id);

    if (!updatedConnection) {
      throw new Error("Conexao Bling nao encontrada apos atualizacao");
    }

    return sanitizeConnection(updatedConnection);
  }

  async createAuthorizationUrl(connectionId: string) {
    const connection = await this.getById(connectionId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    const state = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const redirectUri = getBlingRedirectUri();

    await db.insert(blingOAuthStates).values({
      state,
      userId: connection.userId,
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
    const accessTokenExpiresAt = getAccessTokenExpiryDate(
      tokenResponse.expires_in,
    );
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

  private async refreshConnectionWithLock(
    connectionId: string,
    options: RefreshConnectionOptions,
  ) {
    const lockClient = await pool.connect();
    const lockName = `bling-token-refresh:${connectionId}`;

    try {
      await lockClient.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
      const connection = await this.getById(connectionId);

      if (!connection) {
        throw new Error("Conexao Bling nao encontrada");
      }

      if (!connection.refreshTokenEncrypted) {
        throw new Error("Conexao sem refresh token salvo");
      }

      const tokenChanged =
        options.rejectedAccessToken !== undefined &&
        connection.accessTokenEncrypted !== null &&
        decryptToken(connection.accessTokenEncrypted) !== options.rejectedAccessToken;
      const refreshTokenWasAlreadyRotated =
        options.expectedRefreshTokenExpiresAt !== undefined &&
        connection.refreshTokenExpiresAt?.getTime() !==
          options.expectedRefreshTokenExpiresAt?.getTime();
      const refreshWindowMs = getPositiveEnvNumber(
        "BLING_ACCESS_TOKEN_REFRESH_WINDOW_MS",
        DEFAULT_ACCESS_TOKEN_REFRESH_WINDOW_MS,
      );
      const accessTokenIsFresh =
        connection.accessTokenEncrypted !== null &&
        connection.accessTokenExpiresAt !== null &&
        connection.accessTokenExpiresAt.getTime() - Date.now() > refreshWindowMs;

      if (
        tokenChanged ||
        refreshTokenWasAlreadyRotated ||
        (!options.force &&
          options.rejectedAccessToken === undefined &&
          accessTokenIsFresh)
      ) {
        return sanitizeConnection(connection);
      }

      const refreshToken = decryptToken(connection.refreshTokenEncrypted);
      let tokenResponse;
      try {
        tokenResponse = await refreshBlingAccessToken(
          refreshToken,
          getOAuthCredentials(connection),
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao renovar token do Bling";
        await db
          .update(blingConnections)
          .set({
            status: isDefinitiveOAuthFailure(error) ? "reauth_required" : connection.status,
            lastError: message,
            updatedAt: new Date(),
          })
          .where(eq(blingConnections.id, connection.id));
        throw error;
      }
      const identity = getBlingIdentity(tokenResponse.access_token);

      await db
        .update(blingConnections)
        .set({
          status: "connected",
          accessTokenEncrypted: encryptToken(tokenResponse.access_token),
          refreshTokenEncrypted: encryptToken(tokenResponse.refresh_token),
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope ?? connection.scope,
          accessTokenExpiresAt: getAccessTokenExpiryDate(
            tokenResponse.expires_in,
          ),
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
      const refreshedConnection = await this.getById(connection.id);

      if (!refreshedConnection) {
        throw new Error("Conexao Bling nao encontrada apos refresh");
      }

      return sanitizeConnection(refreshedConnection);
    } finally {
      await lockClient
        .query("SELECT pg_advisory_unlock(hashtext($1))", [lockName])
        .catch(() => undefined);
      lockClient.release();
    }
  }

  async refreshConnection(
    connectionId: string,
    options: RefreshConnectionOptions = { force: true },
  ) {
    const existing = refreshesInFlight.get(connectionId);
    if (existing) return existing;

    const refresh = this.refreshConnectionWithLock(connectionId, options).finally(() => {
      refreshesInFlight.delete(connectionId);
    });
    refreshesInFlight.set(connectionId, refresh);
    return refresh;
  }

  async disconnectConnection(connectionId: string) {
    const connection = await this.getById(connectionId);

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

  async getConnectionStatus(connectionId: string) {
    const connection = await this.getById(connectionId);

    if (!connection) {
      throw new Error("Conexao Bling nao encontrada");
    }

    return sanitizeConnection(connection);
  }

  async refreshConnectionsExpiringSoon() {
    const threshold = new Date(
      Date.now() +
        getPositiveEnvNumber(
          "BLING_REFRESH_TOKEN_MAINTENANCE_WINDOW_MS",
          DEFAULT_REFRESH_TOKEN_MAINTENANCE_WINDOW_MS,
        ),
    );

    const connections = await db
      .select()
      .from(blingConnections)
      .where(
        and(
          eq(blingConnections.status, "connected"),
          lte(blingConnections.refreshTokenExpiresAt, threshold),
        ),
      );

    const candidates = connections.filter(
      (connection) => connection.refreshTokenEncrypted,
    );

    const concurrency = Math.max(
      1,
      Math.floor(getPositiveEnvNumber("BLING_TOKEN_MAINTENANCE_CONCURRENCY", 3)),
    );
    let refreshedCount = 0;
    for (let offset = 0; offset < candidates.length; offset += concurrency) {
      const batch = candidates.slice(offset, offset + concurrency);
      await Promise.all(
        batch.map(async (connection) => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, Math.floor(Math.random() * 250));
          });
          try {
            await this.refreshConnection(connection.id, {
              force: true,
              expectedRefreshTokenExpiresAt: connection.refreshTokenExpiresAt,
            });
            refreshedCount += 1;
          } catch (error) {
            console.error(
              `[BlingConnectionsService] Erro ao renovar conexao ${connection.id}:`,
              error,
            );
          }
        }),
      );
    }

    return refreshedCount;
  }

  async getAccessTokenByConnectionId(connectionId: string): Promise<string> {
    return this.getValidAccessToken(connectionId);
  }

  async getValidAccessToken(connectionId: string): Promise<string> {
    const connection = await this.getById(connectionId);
    if (!connection) {
      throw new Error("Conexão Bling não encontrada.");
    }
    if (connection.status !== "connected" || !connection.accessTokenEncrypted) {
      throw new Error("Conexão Bling não está ativa. Reconecte a conta antes de continuar.");
    }
    const refreshWindowMs = getPositiveEnvNumber(
      "BLING_ACCESS_TOKEN_REFRESH_WINDOW_MS",
      DEFAULT_ACCESS_TOKEN_REFRESH_WINDOW_MS,
    );
    if (
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() - Date.now() > refreshWindowMs
    ) {
      return decryptToken(connection.accessTokenEncrypted);
    }

    const refreshed = await this.refreshConnection(connectionId, { force: false });
    const freshConnection = await this.getById(refreshed.id);
    if (!freshConnection?.accessTokenEncrypted) {
      throw new Error("Nao foi possivel obter o token renovado do Bling");
    }
    return decryptToken(freshConnection.accessTokenEncrypted);
  }

  async createTokenRefresher(connectionId: string): Promise<{
    accessToken: string;
    onTokenRefresh: () => Promise<string>;
  }> {
    let accessToken = await this.getValidAccessToken(connectionId);
    return {
      accessToken,
      onTokenRefresh: async (): Promise<string> => {
        const refreshed = await this.refreshConnection(connectionId, {
          rejectedAccessToken: accessToken,
        });
        const freshConnection = await this.getById(refreshed.id);
        if (!freshConnection?.accessTokenEncrypted) {
          throw new Error("Nao foi possivel obter o token renovado do Bling");
        }
        accessToken = decryptToken(freshConnection.accessTokenEncrypted);
        return accessToken;
      },
    };
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

    return this.getValidAccessToken(connection.id);
  }

  async markExpiredConnections() {
    const now = new Date();
    const expired = await db
      .update(blingConnections)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(blingConnections.status, "connected"),
          lt(blingConnections.refreshTokenExpiresAt, now),
        ),
      )
      .returning({ id: blingConnections.id });

    return expired.length;
  }
}

export const blingConnectionsService = new BlingConnectionsService();
