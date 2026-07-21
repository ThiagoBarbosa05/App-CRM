# Permissão de acesso às respostas rápidas (criar/editar/excluir) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar permissões granulares de criar/editar/excluir respostas rápidas (`wa_quick_replies`) ao sistema de "Permissões de ação" já existente para atendentes, incluindo a funcionalidade de editar (que ainda não existe hoje).

**Architecture:** Reaproveita a tabela genérica `whatsapp_action_permissions` (mesma usada por `manage_templates`/`manage_tags`) com 3 chaves novas — sem tabela nova, sem migração de banco. Backend enforça via `userHasActionPermission` nas 3 rotas de escrita (`POST`/novo `PATCH`/`DELETE`). Frontend busca as mesmas permissões já carregadas em `WhatsAppConversationsPage` (`myActionPermissions`) e usa para esconder os botões correspondentes no `QuickReplyPicker`; no diálogo de admin, um novo combobox de múltipla seleção (reaproveitando `ScopeMultiSelect`) escreve na mesma lista de chaves que o card de checkboxes existente.

**Tech Stack:** React + TypeScript (frontend), Express + Drizzle ORM + PostgreSQL (backend), TanStack Query.

## Global Constraints

- Nunca usar `npm run db:push` — não é necessário aqui, pois não há alteração de schema/tabela (só uma constante TS).
- `npm run check` deve rodar limpo (via tsconfig temporário — ver `CLAUDE.md`) para todo arquivo tocado, sem introduzir erro novo.
- Sem teste visual em browser — regra do projeto (CLAUDE.md). Verificação é por leitura de código + `npm run check`.
- Escopo permanece pessoal: cada atendente só cria/edita/apaga as próprias respostas rápidas (`wa_quick_replies.userId`) — a permissão controla *se* ele pode, não *o quê* existe.
- Default-deny, igual às permissões existentes: admin/gerente sempre podem; demais precisam de grant explícito. Sem backfill — comportamento esperado, confirmado com o usuário.

---

### Task 1: Chaves de permissão no schema

**Files:**
- Modify: `shared/schema.ts:4816`

**Interfaces:**
- Produces: `WHATSAPP_ACTION_PERMISSIONS` array agora inclui `"quick_replies_create"`, `"quick_replies_edit"`, `"quick_replies_delete"` — usado por `WhatsappActionPermissionKey` (tipo consumido em Tasks 2-6).

- [ ] **Step 1: Adicionar as 3 chaves novas**

Em `shared/schema.ts:4816`, trocar:

```ts
export const WHATSAPP_ACTION_PERMISSIONS = ["manage_templates", "manage_tags"] as const;
```

por:

```ts
export const WHATSAPP_ACTION_PERMISSIONS = [
  "manage_templates",
  "manage_tags",
  "quick_replies_create",
  "quick_replies_edit",
  "quick_replies_delete",
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: adiciona chaves de permissão para respostas rápidas"
```

---

### Task 2: Serviço de edição de resposta rápida

**Files:**
- Modify: `server/services/whatsapp-conversations.service.ts:534-541` (logo após `createQuickReply`, antes de `deleteQuickReply`)

**Interfaces:**
- Consumes: `waQuickReplies` (já importado no topo do arquivo), `db`, `and`, `eq` (já importados — usados por `deleteQuickReply` na mesma seção).
- Produces: `updateQuickReply(userId: string, id: string, title: string, content: string): Promise<{ id: string; title: string; content: string; createdAt: Date } | null>` — lança `Error("DUPLICATE_TITLE")` em conflito de título único (consumido pela rota em Task 3).

- [ ] **Step 1: Implementar `updateQuickReply`**

Em `server/services/whatsapp-conversations.service.ts`, logo depois de `createQuickReply` (linha 541) e antes de `deleteQuickReply`:

```ts
export async function updateQuickReply(userId: string, id: string, title: string, content: string) {
  try {
    const [row] = await db
      .update(waQuickReplies)
      .set({ title, content })
      .where(and(eq(waQuickReplies.id, id), eq(waQuickReplies.userId, userId)))
      .returning();
    return row ?? null;
  } catch (err: unknown) {
    // Mesmo conflito de wa_quick_replies_user_title_unique que createQuickReply
    // já trata via onConflictDoNothing — aqui vira UPDATE, então precisa
    // capturar o erro do Postgres manualmente (ver padrão em
    // whatsapp-conversations.service.ts:1781).
    if ((err as { code?: string }).code === "23505") {
      throw new Error("DUPLICATE_TITLE");
    }
    throw err;
  }
}
```

- [ ] **Step 2: Checar tipos**

Run: `cat > tsconfig.tmp.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "server/services/whatsapp-conversations.service.ts"],
  "exclude": ["node_modules"]
}
EOF
npx tsc -p tsconfig.tmp.json; rm tsconfig.tmp.json`

Expected: nenhum erro apontando para `whatsapp-conversations.service.ts` (erros pré-existentes em `shared/schema.ts`/`server/storage.ts` arrastados pelo import são esperados — ver nota em `CLAUDE.md`).

- [ ] **Step 3: Commit**

```bash
git add server/services/whatsapp-conversations.service.ts
git commit -m "feat: adiciona updateQuickReply ao serviço de conversas WhatsApp"
```

---

### Task 3: Rotas — checagem de permissão + novo PATCH

**Files:**
- Modify: `server/routes/whatsapp-conversations.routes.ts:26-28` (import), `:594-621` (seção "Respostas rápidas")

**Interfaces:**
- Consumes: `userHasActionPermission` (já importado, linha 4), `updateQuickReply` (Task 2), `quickReplySchema` (já definido na mesma seção, linha 594-597).
- Produces: `PATCH /api/whatsapp/quick-replies/:id` — novo endpoint, consumido pelo frontend em Task 6.

- [ ] **Step 1: Importar `updateQuickReply`**

Em `server/routes/whatsapp-conversations.routes.ts:26-28`, trocar:

```ts
  listQuickReplies,
  createQuickReply,
  deleteQuickReply,
```

por:

```ts
  listQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
```

- [ ] **Step 2: Adicionar checagem de permissão no POST e um novo PATCH**

Em `server/routes/whatsapp-conversations.routes.ts`, a seção "Respostas rápidas" (linha ~580-622) fica:

```ts
// ── Respostas rápidas ────────────────────────────────────────────────────────

router.get("/quick-replies", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const rows = await listQuickReplies(user.userId);
    res.json(rows);
  } catch (err) {
    console.error("[WA QuickReplies] Erro ao listar:", err);
    res.status(500).json({ message: "Erro ao listar respostas rápidas" });
  }
});

const quickReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
});

router.post("/quick-replies", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    if (!(await userHasActionPermission(user, "quick_replies_create"))) {
      return res.status(403).json({ message: "Sem permissão para criar respostas rápidas" });
    }
    const parsed = quickReplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const row = await createQuickReply(user.userId, parsed.data.title, parsed.data.content);
    if (!row) return res.status(409).json({ message: "Já existe uma resposta com esse título" });
    res.status(201).json(row);
  } catch (err) {
    console.error("[WA QuickReplies] Erro ao criar:", err);
    res.status(500).json({ message: "Erro ao criar resposta rápida" });
  }
});

router.patch("/quick-replies/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    if (!(await userHasActionPermission(user, "quick_replies_edit"))) {
      return res.status(403).json({ message: "Sem permissão para editar respostas rápidas" });
    }
    const parsed = quickReplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const row = await updateQuickReply(user.userId, req.params.id, parsed.data.title, parsed.data.content);
    if (!row) return res.status(404).json({ message: "Resposta não encontrada" });
    res.json(row);
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE_TITLE") {
      return res.status(409).json({ message: "Já existe uma resposta com esse título" });
    }
    console.error("[WA QuickReplies] Erro ao editar:", err);
    res.status(500).json({ message: "Erro ao editar resposta rápida" });
  }
});

router.delete("/quick-replies/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    if (!(await userHasActionPermission(user, "quick_replies_delete"))) {
      return res.status(403).json({ message: "Sem permissão para excluir respostas rápidas" });
    }
    const row = await deleteQuickReply(user.userId, req.params.id);
    if (!row) return res.status(404).json({ message: "Resposta não encontrada" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA QuickReplies] Erro ao remover:", err);
    res.status(500).json({ message: "Erro ao remover resposta rápida" });
  }
});
```

- [ ] **Step 3: Checar tipos**

Run: `cat > tsconfig.tmp.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "server/routes/whatsapp-conversations.routes.ts"],
  "exclude": ["node_modules"]
}
EOF
npx tsc -p tsconfig.tmp.json; rm tsconfig.tmp.json`

Expected: nenhum erro apontando para `whatsapp-conversations.routes.ts`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/whatsapp-conversations.routes.ts
git commit -m "feat: enforça permissões de respostas rápidas e adiciona edição"
```

---

### Task 4: Exportar `ScopeMultiSelect` para reuso

**Files:**
- Modify: `client/src/components/whatsapp-access-scope-fields.tsx:27,30`

**Interfaces:**
- Produces: `export type ScopeItem<TId>`, `export function ScopeMultiSelect<TId>` — consumido pelo novo componente em Task 5.

- [ ] **Step 1: Exportar o tipo e o componente**

Em `client/src/components/whatsapp-access-scope-fields.tsx:27`, trocar:

```ts
type ScopeItem<TId> = { id: TId; label: string };
```

por:

```ts
export type ScopeItem<TId> = { id: TId; label: string };
```

E em `client/src/components/whatsapp-access-scope-fields.tsx:30`, trocar:

```ts
function ScopeMultiSelect<TId extends string | number>({
```

por:

```ts
export function ScopeMultiSelect<TId extends string | number>({
```

Nenhuma outra linha do arquivo muda — é só a visibilidade de exportação (o resto do arquivo já usa esses dois identificadores localmente sem qualificação, e isso continua funcionando).

- [ ] **Step 2: Checar tipos**

Run: `cat > tsconfig.tmp.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "client/src/components/whatsapp-access-scope-fields.tsx"],
  "exclude": ["node_modules"]
}
EOF
npx tsc -p tsconfig.tmp.json; rm tsconfig.tmp.json`

Expected: nenhum erro apontando para `whatsapp-access-scope-fields.tsx`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/whatsapp-access-scope-fields.tsx
git commit -m "refactor: exporta ScopeMultiSelect para reuso em outros campos de permissão"
```

---

### Task 5: Componente do combobox "Acesso às respostas rápidas"

**Files:**
- Create: `client/src/components/whatsapp-quick-replies-access-field.tsx`
- Modify: `client/src/pages/whatsapp/attendants.tsx:19-23` (import), `:186-199` (render)

**Interfaces:**
- Consumes: `ScopeMultiSelect`, `ScopeItem` (Task 4), `WhatsappActionPermissionKey` (Task 1).
- Produces: `WhatsappQuickRepliesAccessField({ selectedKeys, onChange })` — mesmo par `selectedKeys: string[]` / `onChange: (keys: string[]) => void` que `WhatsappActionPermissionsFields` já usa em `attendants.tsx`, então ambos escrevem na mesma lista `selectedActionPermissions`.

- [ ] **Step 1: Criar o componente**

Criar `client/src/components/whatsapp-quick-replies-access-field.tsx`:

```tsx
import { Label } from "@/components/ui/label";
import { ScopeMultiSelect, type ScopeItem } from "./whatsapp-access-scope-fields";
import type { WhatsappActionPermissionKey } from "@shared/schema";

const QUICK_REPLY_PERMISSIONS: ScopeItem<WhatsappActionPermissionKey>[] = [
  { id: "quick_replies_create", label: "Criar" },
  { id: "quick_replies_edit", label: "Editar" },
  { id: "quick_replies_delete", label: "Excluir" },
];

/**
 * Combobox de múltipla seleção para criar/editar/excluir respostas rápidas.
 * Cada atendente só mexe nas próprias (wa_quick_replies é filtrada por
 * userId) — isso controla se ele pode, não o que existe. selectedKeys/
 * onChange compartilham a mesma lista de chaves que
 * WhatsappActionPermissionsFields, só renderizada em outro widget.
 */
export function WhatsappQuickRepliesAccessField({
  selectedKeys,
  onChange,
}: {
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  const selectedQuickReplyKeys = QUICK_REPLY_PERMISSIONS.filter((p) =>
    selectedKeys.includes(p.id),
  ).map((p) => p.id);

  function handleChange(ids: WhatsappActionPermissionKey[]) {
    const otherKeys = selectedKeys.filter(
      (k) => !QUICK_REPLY_PERMISSIONS.some((p) => p.id === k),
    );
    onChange([...otherKeys, ...ids]);
  }

  return (
    <div className="min-w-0 w-full space-y-1.5">
      <Label className="text-sm font-medium">Acesso às respostas rápidas</Label>
      <ScopeMultiSelect
        items={QUICK_REPLY_PERMISSIONS}
        selectedIds={selectedQuickReplyKeys}
        onChange={handleChange}
        placeholder="Nenhuma permissão"
        emptyLabel="Nenhuma opção disponível"
        isLoading={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: Importar no diálogo de atendente**

Em `client/src/pages/whatsapp/attendants.tsx:23`, logo depois do import de `WhatsappActionPermissionsFields`:

```ts
import { WhatsappActionPermissionsFields } from "@/components/whatsapp-action-permissions-fields";
```

adicionar:

```ts
import { WhatsappQuickRepliesAccessField } from "@/components/whatsapp-quick-replies-access-field";
```

- [ ] **Step 3: Renderizar acima do card "Permissões de ação"**

Em `client/src/pages/whatsapp/attendants.tsx:186-199`, trocar:

```tsx
          <div className="min-w-0 space-y-4">
            <WhatsappAccessScopeFields
              selectedSectorIds={selectedSectorIds}
              selectedChannelIds={selectedChannelIds}
              selectedQrChannelIds={selectedQrChannelIds}
              onChangeSectorIds={setSelectedSectorIds}
              onChangeChannelIds={setSelectedChannelIds}
              onChangeQrChannelIds={setSelectedQrChannelIds}
            />
            <WhatsappActionPermissionsFields
              selectedKeys={selectedActionPermissions}
              onChange={setSelectedActionPermissions}
            />
          </div>
```

por:

```tsx
          <div className="min-w-0 space-y-4">
            <WhatsappAccessScopeFields
              selectedSectorIds={selectedSectorIds}
              selectedChannelIds={selectedChannelIds}
              selectedQrChannelIds={selectedQrChannelIds}
              onChangeSectorIds={setSelectedSectorIds}
              onChangeChannelIds={setSelectedChannelIds}
              onChangeQrChannelIds={setSelectedQrChannelIds}
            />
            <WhatsappQuickRepliesAccessField
              selectedKeys={selectedActionPermissions}
              onChange={setSelectedActionPermissions}
            />
            <WhatsappActionPermissionsFields
              selectedKeys={selectedActionPermissions}
              onChange={setSelectedActionPermissions}
            />
          </div>
```

Nenhuma mudança na `saveMutation` — ela já envia `permissionKeys: selectedActionPermissions` inteiro via `PUT /api/users/:id/whatsapp-action-permissions` (linha 146-148), e essa lista agora inclui as 3 chaves novas quando marcadas.

- [ ] **Step 4: Checar tipos**

Run: `cat > tsconfig.tmp.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "client/src/components/whatsapp-quick-replies-access-field.tsx", "client/src/pages/whatsapp/attendants.tsx"],
  "exclude": ["node_modules"]
}
EOF
npx tsc -p tsconfig.tmp.json; rm tsconfig.tmp.json`

Expected: nenhum erro apontando para os dois arquivos.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/whatsapp-quick-replies-access-field.tsx client/src/pages/whatsapp/attendants.tsx
git commit -m "feat: adiciona combobox de acesso às respostas rápidas no diálogo de atendente"
```

---

### Task 6: `QuickReplyPicker` — gating + edição

**Files:**
- Modify: `client/src/pages/whatsapp/conversations.tsx:97` (import de ícone), `:1997-2153` (`QuickReplyPicker`), `:5037-5058` (uso do picker dentro de `ConversationMessages`), props de `ConversationMessages` (`:2843-2866`), computação de permissões na página (`:5684-5688`), e a chamada de `<ConversationMessages ... />` (`:6863-6869`).

**Interfaces:**
- Consumes: `WhatsAppConversationsPage`'s `myActionPermissions` (já existente, Task de sessão anterior), `isAdminOrGerente` (já existente).
- Produces: `ConversationMessages` ganha `canCreateQuickReplies`, `canEditQuickReplies`, `canDeleteQuickReplies: boolean`; `QuickReplyPicker` ganha `canCreate`, `canEdit`, `canDelete: boolean`.

- [ ] **Step 1: Importar o ícone `Pencil`**

Em `client/src/pages/whatsapp/conversations.tsx`, no bloco de import de `lucide-react` (linha ~53-97), adicionar `Pencil` à lista — por exemplo logo depois de `Tag,` (linha 78):

```ts
  Tag,
  Pencil,
  Trash2,
```

- [ ] **Step 2: Reescrever `QuickReplyPicker` com gating e edição**

Em `client/src/pages/whatsapp/conversations.tsx:1997-2153`, substituir a função inteira por:

```tsx
function QuickReplyPicker({
  onPick,
  canCreate,
  canEdit,
  canDelete,
}: {
  onPick: (content: string) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ["/api/whatsapp/quick-replies"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/quick-replies");
      if (!res.ok) return [];
      return res.json();
    },
  });

  function resetForm() {
    setIsEditing(false);
    setEditingId(null);
    setNewTitle("");
    setNewContent("");
  }

  function startEdit(e: React.MouseEvent, reply: QuickReply) {
    e.stopPropagation();
    setEditingId(reply.id);
    setNewTitle(reply.title);
    setNewContent(reply.content);
    setIsEditing(true);
  }

  const handleSave = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      const res = await fetch(
        editingId
          ? `/api/whatsapp/quick-replies/${editingId}`
          : "/api/whatsapp/quick-replies",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            content: newContent.trim(),
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        toast({
          title:
            err.message ??
            (editingId ? "Erro ao salvar edição" : "Erro ao criar resposta"),
          variant: "destructive",
        });
        return;
      }
      resetForm();
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/quick-replies"],
      });
    } catch {
      toast({
        title: editingId
          ? "Erro ao salvar edição"
          : "Erro ao criar resposta rápida",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/whatsapp/quick-replies/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/quick-replies"],
      });
    } catch {
      toast({ title: "Erro ao remover resposta", variant: "destructive" });
    }
  };

  return (
    <div className="w-[min(320px,calc(100vw-2rem))] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Respostas rápidas
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => (isEditing ? resetForm() : setIsEditing(true))}
            className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
            title="Nova resposta"
          >
            <PlusCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isEditing && (
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título (ex: Saudação)"
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Texto da resposta…"
            rows={3}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={resetForm}
              className="px-2 py-1 text-xs rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!newTitle.trim() || !newContent.trim()}
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {editingId ? "Salvar edição" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
          <Zap className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Nenhuma resposta rápida criada.
            <br />
            {canCreate
              ? "Clique em + para adicionar."
              : "Peça a um administrador para liberar a criação."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {replies.map((r) => (
            <div
              key={r.id}
              className="group flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              onClick={() => onPick(r.content)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                  {r.title}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5">
                  {r.content}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all">
                {canEdit && (
                  <button
                    onClick={(e) => startEdit(e, r)}
                    className="h-5 w-5 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-primary"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={(e) => handleDelete(e, r.id)}
                    className="h-5 w-5 rounded flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-500"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Adicionar as 3 permissões computadas na página**

Em `client/src/pages/whatsapp/conversations.tsx`, logo depois do bloco `canSendTemplates` (linha ~5686-5688, já existente da sessão anterior):

```ts
  const canSendTemplates =
    isAdminOrGerente ||
    (myActionPermissions?.permissionKeys.includes("manage_templates") ?? false);
```

adicionar:

```ts
  const canCreateQuickReplies =
    isAdminOrGerente ||
    (myActionPermissions?.permissionKeys.includes("quick_replies_create") ?? false);
  const canEditQuickReplies =
    isAdminOrGerente ||
    (myActionPermissions?.permissionKeys.includes("quick_replies_edit") ?? false);
  const canDeleteQuickReplies =
    isAdminOrGerente ||
    (myActionPermissions?.permissionKeys.includes("quick_replies_delete") ?? false);
```

- [ ] **Step 4: Propagar para `ConversationMessages`**

Na assinatura de `ConversationMessages` (`client/src/pages/whatsapp/conversations.tsx:2843-2866`), trocar:

```ts
  canManageTags,
  canSendTemplates,
  initialDraft,
}: {
  conversationKey: string;
  onBack: () => void;
  client: ChatClient;
  channels: Channel[];
  userRole: string;
  onClientLinked: (clientId: string) => void;
  availableWhatsappTags: WhatsappClientTag[];
  onWhatsappTagsChange: (clientId: string, tagIds: string[]) => void;
  canManageTags: boolean;
  canSendTemplates: boolean;
  /** Texto que já chega escrito no composer, editável antes do envio. */
  initialDraft?: string;
}) {
```

por:

```ts
  canManageTags,
  canSendTemplates,
  canCreateQuickReplies,
  canEditQuickReplies,
  canDeleteQuickReplies,
  initialDraft,
}: {
  conversationKey: string;
  onBack: () => void;
  client: ChatClient;
  channels: Channel[];
  userRole: string;
  onClientLinked: (clientId: string) => void;
  availableWhatsappTags: WhatsappClientTag[];
  onWhatsappTagsChange: (clientId: string, tagIds: string[]) => void;
  canManageTags: boolean;
  canSendTemplates: boolean;
  canCreateQuickReplies: boolean;
  canEditQuickReplies: boolean;
  canDeleteQuickReplies: boolean;
  /** Texto que já chega escrito no composer, editável antes do envio. */
  initialDraft?: string;
}) {
```

- [ ] **Step 5: Passar as props para `QuickReplyPicker`**

Em `client/src/pages/whatsapp/conversations.tsx:5048-5056`, trocar:

```tsx
                  <QuickReplyPicker
                    onPick={(content) => {
                      setMessage((prev) =>
                        prev ? prev + "\n" + content : content,
                      );
                      setQuickReplyOpen(false);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                  />
```

por:

```tsx
                  <QuickReplyPicker
                    onPick={(content) => {
                      setMessage((prev) =>
                        prev ? prev + "\n" + content : content,
                      );
                      setQuickReplyOpen(false);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    canCreate={canCreateQuickReplies}
                    canEdit={canEditQuickReplies}
                    canDelete={canDeleteQuickReplies}
                  />
```

- [ ] **Step 6: Passar as props no call-site de `<ConversationMessages />`**

Em `client/src/pages/whatsapp/conversations.tsx:6863-6869` (mesmo bloco onde `canManageTags`/`canSendTemplates` já são passados), trocar:

```tsx
            onClientLinked={handleClientLinked}
            availableWhatsappTags={availableWaTags}
            onWhatsappTagsChange={(clientId, tagIds) =>
              setTagsMutation.mutate({ clientId, tagIds })
            }
            canManageTags={canManageTags}
            canSendTemplates={canSendTemplates}
          />
        ) : (
```

por:

```tsx
            onClientLinked={handleClientLinked}
            availableWhatsappTags={availableWaTags}
            onWhatsappTagsChange={(clientId, tagIds) =>
              setTagsMutation.mutate({ clientId, tagIds })
            }
            canManageTags={canManageTags}
            canSendTemplates={canSendTemplates}
            canCreateQuickReplies={canCreateQuickReplies}
            canEditQuickReplies={canEditQuickReplies}
            canDeleteQuickReplies={canDeleteQuickReplies}
          />
        ) : (
```

- [ ] **Step 7: Checar tipos**

Run: `cat > tsconfig.tmp.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "client/src/pages/whatsapp/conversations.tsx"],
  "exclude": ["node_modules"]
}
EOF
npx tsc -p tsconfig.tmp.json; rm tsconfig.tmp.json`

Expected: nenhum erro apontando para `conversations.tsx`.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/whatsapp/conversations.tsx
git commit -m "feat: gating de permissão e edição no QuickReplyPicker"
```

---

### Task 7: Verificação final

**Files:** nenhum (só validação)

- [ ] **Step 1: Type-check de todos os arquivos tocados de uma vez**

Run: `cat > tsconfig.tmp.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": [
    "server/types/express.d.ts",
    "shared/schema.ts",
    "server/services/whatsapp-conversations.service.ts",
    "server/routes/whatsapp-conversations.routes.ts",
    "client/src/components/whatsapp-access-scope-fields.tsx",
    "client/src/components/whatsapp-quick-replies-access-field.tsx",
    "client/src/pages/whatsapp/attendants.tsx",
    "client/src/pages/whatsapp/conversations.tsx"
  ],
  "exclude": ["node_modules"]
}
EOF
npx tsc -p tsconfig.tmp.json; rm tsconfig.tmp.json`

Expected: os únicos erros restantes são os pré-existentes em `shared/schema.ts:3300` e nos arquivos arrastados de `server/storage.ts` (documentados em `CLAUDE.md`) — nenhum apontando para os 6 arquivos desta lista além de `shared/schema.ts` na linha já conhecida.

- [ ] **Step 2: Ler o resultado final e confirmar manualmente (sem browser, por regra do projeto)**

Conferir por leitura:
- Um atendente sem nenhum grant vê o popover de respostas rápidas sem o botão "+", sem lápis, sem lixeira — só pode clicar numa resposta existente para inserir no composer.
- Admin/gerente sempre veem os três controles, mesmo sem grant explícito na tabela.
- O combobox "Acesso às respostas rápidas" no diálogo de atendente mostra "Criar, Editar, +1" quando as 3 chaves estão marcadas, e escreve na mesma `selectedActionPermissions` que o card de checkboxes abaixo.

- [ ] **Step 3: Commit final (se sobrar algo solto)**

```bash
git status
```

Se não houver mudanças pendentes, este passo não gera commit — as Tasks 1-6 já cobriram tudo.
