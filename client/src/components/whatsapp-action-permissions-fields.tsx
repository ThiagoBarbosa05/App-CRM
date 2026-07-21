import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { WhatsappActionPermissionKey } from "@shared/schema";

const CONVERSATION_PERMISSIONS: { key: WhatsappActionPermissionKey; label: string }[] = [
  { key: "manage_templates", label: "Templates de mensagem" },
  { key: "manage_tags", label: "Etiquetas" },
];

/**
 * Checkboxes de "Permissões de ação" do atendente — o que ele pode fazer,
 * além do escopo de acesso (setores/canais). Só lista ações que já existem
 * de fato no app; itens sem feature real por trás (ex: apagar mensagens,
 * mensagens agendadas) não entram aqui até existirem.
 */
export function WhatsappActionPermissionsFields({
  selectedKeys,
  onChange,
}: {
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key],
    );
  }

  function selectAll() {
    const otherKeys = selectedKeys.filter(
      (k) => !CONVERSATION_PERMISSIONS.some((p) => p.key === k),
    );
    onChange([...otherKeys, ...CONVERSATION_PERMISSIONS.map((p) => p.key)]);
  }

  const ownSelectedCount = selectedKeys.filter((k) =>
    CONVERSATION_PERMISSIONS.some((p) => p.key === k),
  ).length;

  const allSelected =
    CONVERSATION_PERMISSIONS.length > 0 && ownSelectedCount === CONVERSATION_PERMISSIONS.length;

  return (
    <div className="min-w-0 w-full space-y-3 overflow-hidden rounded-lg border dark:border-slate-700 p-4">
      <div>
        <h4 className="text-sm font-medium">Permissões de ação</h4>
        <p className="text-xs text-muted-foreground dark:text-slate-400">
          O que o atendente pode fazer, além dos canais e setores liberados acima.
        </p>
      </div>

      <div className="rounded-md border dark:border-slate-700 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Conversas</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {ownSelectedCount} de {CONVERSATION_PERMISSIONS.length} ativadas
            </span>
            <button
              type="button"
              onClick={selectAll}
              className={cn(
                "text-xs font-medium hover:underline",
                allSelected ? "text-muted-foreground" : "text-primary",
              )}
            >
              Marcar todos
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONVERSATION_PERMISSIONS.map((permission) => (
            <label
              key={permission.key}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={selectedKeys.includes(permission.key)}
                onCheckedChange={() => toggle(permission.key)}
              />
              <Label className="cursor-pointer font-normal">{permission.label}</Label>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
