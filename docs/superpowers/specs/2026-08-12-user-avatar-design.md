# Foto de perfil do usuário — Design

Data: 2026-08-12

## Objetivo

Permitir que cada usuário defina a própria foto de perfil, exibida na sidebar, na
lista de usuários (Configurações → Usuários) e no chat interno da equipe.

## Escopo

**Dentro:**

- Cada usuário troca e remove **a própria** foto. Admin não altera a foto de outros.
- Ponto de entrada: clicar no bloco de usuário da sidebar abre um modal "Meu perfil".
- Exibição: sidebar, `users-management.tsx`, chat interno (lista de DMs e cabeçalho).

**Fora:**

- Cards de negócio / avatar do vendedor responsável (`deal-card.tsx`).
- Crop interativo, filtros, múltiplas fotos, histórico.
- Qualquer outro campo de perfil (senha, preferências). O modal fica preparado para
  crescer, mas nesta entrega só trata da foto.

## Decisões

**Upload por endpoint dedicado, não pelo `/api/upload` genérico.**
`POST /api/upload` ([object-storage.routes.ts:43](../../../server/routes/object-storage.routes.ts))
aceita 15MB de qualquer mime e devolve a key para o client. Usá-lo exigiria um
segundo request (`PATCH`) com a key crua, o que deixa órfãos no bucket quando o
segundo request falha e permite apontar o avatar para qualquer objeto do bucket.
O endpoint dedicado resolve tudo em uma requisição, sob controle do servidor.

**Sem `sharp`.** Normalizar no servidor exigiria dependência binária nativa, que
complica o build/deploy. O client reduz a imagem para 512px via `<canvas>` antes de
enviar; o servidor apenas valida mime e tamanho.

**Persistir a key do R2, não a URL.** É o padrão do projeto — ver o comentário em
[shared/schema.ts:4285](../../../shared/schema.ts): "URL pública não é persistida —
deriva-se de `getPublicR2Url(storageKey)`". Assim o domínio do CDN pode mudar sem
migração de dados.

## Banco

Nova coluna em `users` ([shared/schema.ts:34](../../../shared/schema.ts)):

```ts
avatarStorageKey: text("avatar_storage_key"),
```

Migração manual, conforme o CLAUDE.md (nunca `db:push`):
`scripts/add-user-avatar-column.mjs`, no padrão de `scripts/create-reactions-table.mjs`,
executando `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key text`.

Objetos no R2 sob `avatars/<userId>/<uuid>`.

## Backend

### `server/lib/user-serializer.ts` (novo)

```ts
export type PublicUser = Omit<User, "password" | "avatarStorageKey"> & {
  avatarUrl: string | null;
};

export function toPublicUser(user: User): PublicUser;
```

Remove `password` e `avatarStorageKey`, adiciona `avatarUrl` derivado com
`getPublicR2Url` ([server/lib/r2.ts:16](../../../server/lib/r2.ts)) ou `null`.
Função pura — testável sem banco.

Uso:

- `GET /api/auth/me` ([auth.routes.ts:80](../../../server/routes/auth.routes.ts)) —
  troca o destructuring de `password` por `toPublicUser`, que já entrega `avatarUrl`.
- `POST /api/auth/login` ([auth.routes.ts:49](../../../server/routes/auth.routes.ts)) —
  monta o objeto campo a campo e continua assim; acrescenta
  `avatarUrl: getPublicR2Url(...)` para bater com o shape de `/me`.
- `storage.getUsers()` ([storage.ts:752](../../../server/storage.ts)) — o `select` é
  de campos explícitos (não um `User` completo, então não passa por `toPublicUser`):
  incluir `avatarStorageKey` no select e mapear para `avatarUrl` no retorno.

As três respostas expõem `avatarUrl` e nunca `avatarStorageKey`.

### `server/routes/user-profile.routes.ts` (novo)

Arquivo novo no diretório modular — não em `server/routes.ts` (legado).
Registrado em `server/routes/index.ts`.

`POST /api/users/me/avatar` — multipart, campo `file`:

- `requireAuth`. O alvo é sempre `req.user!.userId`; **nenhum id vem do body**.
  É isto que garante a regra "só o próprio usuário".
- multer em memória, `limits: { fileSize: 5 * 1024 * 1024 }`.
- Whitelist de mime: `image/jpeg`, `image/png`, `image/webp`.
- Sobe para `avatars/<userId>/<uuid>` via `PutObjectCommand`.
- `storage.updateUser(userId, { avatarStorageKey: key })`.
- Remove a key anterior com `deleteR2Object`. Falha na remoção é logada e **não**
  derruba o request — a foto nova já está gravada.
- Responde `200 { avatarUrl }`.

`DELETE /api/users/me/avatar`:

- `requireAuth`. Zera `avatarStorageKey` e remove o objeto (mesma tolerância a falha).
- Responde `200 { avatarUrl: null }`.

Erros: `400` para arquivo ausente, mime não permitido ou `MulterError` de tamanho
(mensagens em português, como no resto do projeto); `401` sem sessão; `500` no resto.

Lógica pura extraída para teste sem banco:

```ts
export function validateAvatarUpload(
  mimetype: string,
  size: number,
): { ok: true } | { ok: false; message: string };

export function buildAvatarKey(userId: string): string;
```

### Chat interno

`ConversationSummary.avatarUrl` já existe
([internal-chat.service.ts:27](../../../server/services/internal-chat.service.ts))
e hoje é sempre `null` em DM. Mudanças:

- Incluir `avatarStorageKey` no `otherUserAlias` (linha 475).
- Preencher `avatarUrl` com `getPublicR2Url` nas duas montagens de DM: a lista de
  atendentes sem conversa (linha 464) e as conversas existentes (linha 517).

O tipo `otherUser` ganha `avatarUrl: string | null`. O client não muda de contrato.

## Frontend

### `client/src/lib/image-resize.ts` (novo)

`resizeImageFile(file: File, maxSize = 512): Promise<Blob>` — desenha em `<canvas>`
mantendo proporção, exporta jpeg com qualidade 0.85. Se a imagem já for menor que
`maxSize`, devolve o arquivo original sem reprocessar.

### `client/src/components/profile-modal.tsx` (novo)

Dialog Shadcn com: avatar grande, "Alterar foto" (input file oculto, `accept="image/*"`),
"Remover foto" (só quando há foto), estado de carregamento e toasts de erro.
Mutations TanStack Query; no sucesso chama `updateUserAuthenticated` e invalida a
query de usuários.

### `client/src/hooks/useAuth.tsx`

A interface `User` ganha `avatarUrl: string | null`.

### `client/src/components/sidebar.tsx`

O bloco de usuário ([sidebar.tsx:104](../../../client/src/components/sidebar.tsx))
vira clicável e abre o modal. O ícone genérico `<User />` (linha 106) é substituído
por `<Avatar>` com `<AvatarImage src={user.avatarUrl ?? undefined} />` e
`<AvatarFallback>` com as iniciais.

### Demais telas

`users-management.tsx` e `internal-chat-panel.tsx` já usam `<Avatar>` com
`<AvatarFallback>`; basta acrescentar `<AvatarImage>` acima do fallback. O fallback
de iniciais continua sendo o comportamento quando não há foto.

## Testes

Unit (`server/routes/__tests__/`, `client/src/lib/__tests__/`):

- `validateAvatarUpload`: mime inválido, tamanho acima do limite, caso feliz.
- `buildAvatarKey`: prefixo `avatars/<userId>/` e unicidade.
- `toPublicUser`: não vaza `password` nem `avatarStorageKey`; deriva `avatarUrl`;
  devolve `null` quando não há key.
- `resizeImageFile`: imagem menor que o limite passa intacta; maior é reduzida.

Rota — `server/routes/__tests__/user-profile.routes.test.ts`, com
`createRouteTestApp()` e `createMockAuthMiddleware()`, R2 mockado:

- `401` sem autenticação.
- `400` com mime não permitido.
- `200` grava a key **do usuário autenticado** (não de um id enviado no body).
- `DELETE` limpa a coluna e chama `deleteR2Object`.

Confirmar coleta com `npx vitest list --project unit` — os globs dos projects são
fechados e um arquivo fora deles nunca roda, sem falhar a suíte.

## Validação

- `npx vitest run --project unit` nos arquivos novos.
- `npx tsc -p tsconfig.tmp.json` incluindo `server/types/express.d.ts` e os arquivos
  tocados (`npm run check` completo estoura memória neste repo).
- Sem verificação visual em browser, conforme o CLAUDE.md.

## Riscos

- **Cache do CDN.** A key é única por upload (`uuid`), então trocar a foto gera URL
  nova — sem risco de servir imagem velha.
- **Bucket público.** `R2_PUBLIC_URL` serve os objetos sem autenticação. Fotos de
  perfil ficam publicamente acessíveis a quem tiver a URL (uuid não enumerável).
  Mesmo modelo já usado para mídia de WhatsApp e biblioteca de mídia.
- **Usuários pré-existentes.** Coluna nullable; todos continuam com fallback de
  iniciais até subirem uma foto.
