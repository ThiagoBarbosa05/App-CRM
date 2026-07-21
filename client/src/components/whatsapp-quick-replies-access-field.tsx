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
