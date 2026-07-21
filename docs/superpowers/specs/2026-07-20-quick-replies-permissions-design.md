# Permissão de acesso às respostas rápidas (criar/editar/excluir)

## Contexto

O app já tem um sistema de "Permissões de ação" para atendentes (tabela genérica
`whatsapp_action_permissions`, chave `manage_templates` e `manage_tags`,
default-deny — admin/gerente sempre podem, os demais precisam de grant
explícito concedido via `/whatsapp/atendentes`). O usuário pediu uma permissão
equivalente para respostas rápidas, com granularidade de Criar/Editar/Excluir,
exibida como um combobox de múltipla seleção (ex.: "Criar, Editar, +1"), no
mesmo estilo visual do combobox de escopo de acesso (setores/canais) já usado
no diálogo de edição de atendente.

Hoje respostas rápidas (`wa_quick_replies`) são pessoais — cada atendente só
vê, cria e apaga as suas próprias, sem nenhuma checagem de permissão, e sem
função de "editar" (só existe criar e apagar). Confirmado com o usuário:

- O escopo continua pessoal (não vira uma lista compartilhada da equipe).
- O grant é default-deny, igual aos outros dois — não haverá backfill; depois
  do deploy, um atendente sem grant explícito só pode *usar* (ler) as
  respostas que já tiver, até um admin conceder criar/editar/excluir.
- A funcionalidade de "editar" (que não existe hoje) deve ser construída do
  zero como parte deste trabalho.

## Modelo de permissão

Reaproveita a infraestrutura genérica existente — sem tabela nova, sem
migração de banco (a coluna `permission_key` já é texto livre). Três chaves
novas em `WHATSAPP_ACTION_PERMISSIONS` (`shared/schema.ts`):

- `quick_replies_create`
- `quick_replies_edit`
- `quick_replies_delete`

Regra de autorização idêntica ao `userHasActionPermission` já existente:
admin/gerente sempre podem; demais precisam do grant. Listar/usar as próprias
respostas (`GET /quick-replies`) continua livre para qualquer autenticado —
só criar/editar/excluir é restrito.

## Backend

- **`server/services/whatsapp-conversations.service.ts`**: nova
  `updateQuickReply(userId, id, title, content)`, mesmo padrão de
  `deleteQuickReply` (`where(eq(id), eq(userId))`, só edita a própria).
- **`server/routes/whatsapp-conversations.routes.ts`**:
  - `POST /quick-replies` → `userHasActionPermission(user, "quick_replies_create")`
  - novo `PATCH /quick-replies/:id` (reaproveita `quickReplySchema`) →
    `userHasActionPermission(user, "quick_replies_edit")`
  - `DELETE /quick-replies/:id` → `userHasActionPermission(user, "quick_replies_delete")`

## Frontend

- **`client/src/components/whatsapp-quick-replies-access-field.tsx`** (novo):
  combobox de múltipla seleção com os 3 itens (Criar/Editar/Excluir),
  reaproveitando o padrão do `ScopeMultiSelect` de
  `whatsapp-access-scope-fields.tsx`. Recebe `selectedKeys`/`onChange` — a
  mesma lista de chaves usada pelo `WhatsappActionPermissionsFields`, só
  renderizada em outro widget.
- **`client/src/pages/whatsapp/attendants.tsx`**: renderiza o novo campo
  acima do card "Permissões de ação" existente, escrevendo no mesmo estado
  `selectedActionPermissions` (union das chaves dos dois grupos ao salvar via
  `PUT /api/users/:id/whatsapp-action-permissions`).
- **`client/src/pages/whatsapp/conversations.tsx` → `QuickReplyPicker`**:
  passa a receber `canCreate`/`canEdit`/`canDelete: boolean` (derivados da
  mesma query `myActionPermissions` já usada para `manage_tags`/
  `manage_templates`, seguindo o padrão já aplicado nesta sessão). O botão
  "+" (criar) some sem `canCreate`; a lixeira some sem `canDelete`; um novo
  ícone de lápis (visível só com `canEdit`) abre o mesmo formulário de
  criação, pré-preenchido com título/conteúdo, virando "Salvar edição" que
  chama o novo `PATCH`.

## Fora de escopo

- Não altera o modelo de dados de `wa_quick_replies` (sem `updatedAt`, sem
  migração).
- Não migra respostas rápidas para um recurso compartilhado da equipe.
- Não faz backfill de grants para atendentes que já usam a feature — comportamento
  esperado e confirmado com o usuário.

## Verificação

- `npm run check` (tsconfig temporário, conforme `CLAUDE.md`).
- `npm run test:unit` se houver teste de rota relevante para `whatsapp-conversations.routes.ts`.
- Sem teste visual em browser (regra do projeto) — validar lendo o código:
  conferir que os 3 grants chegam corretamente ao `QuickReplyPicker` e que os
  botões somem/aparecem de acordo.
