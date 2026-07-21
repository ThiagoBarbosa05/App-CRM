import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WhatsappSector } from "@shared/schema";

export type WhatsappAccessChannel = {
  id: number;
  name: string;
  displayPhone: string | null;
  provider: string;
};

export type WhatsappAccess = { sectorIds: string[]; channelIds: number[] };

export type ScopeItem<TId> = { id: TId; label: string };

/** Combobox de múltipla seleção usado tanto para setores quanto para canais. */
export function ScopeMultiSelect<TId extends string | number>({
  items,
  selectedIds,
  onChange,
  placeholder,
  emptyLabel,
  isLoading,
}: {
  items: ScopeItem<TId>[];
  selectedIds: TId[];
  onChange: (ids: TId[]) => void;
  placeholder: string;
  emptyLabel: string;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabels = useMemo(
    () =>
      selectedIds
        .map((id) => items.find((item) => item.id === id)?.label)
        .filter((label): label is string => Boolean(label)),
    [selectedIds, items],
  );

  const triggerLabel = useMemo(() => {
    if (selectedLabels.length === 0) return placeholder;
    if (selectedLabels.length <= 2) return selectedLabels.join(", ");
    return `${selectedLabels.slice(0, 2).join(", ")}, + ${selectedLabels.length - 2}`;
  }, [selectedLabels, placeholder]);

  function toggle(id: TId) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id],
    );
  }

  function selectAll() {
    onChange(items.map((item) => item.id));
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-0 justify-between overflow-hidden font-normal"
        >
          <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Pesquisar" />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <CommandItem
                        key={String(item.id)}
                        value={item.label}
                        onSelect={() => toggle(item.id)}
                        className={cn(
                          "cursor-pointer rounded-md",
                          isSelected && "bg-slate-200 dark:bg-slate-700 data-[selected=true]:bg-slate-200 dark:data-[selected=true]:bg-slate-700",
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <div className="p-1 border-t dark:border-slate-700">
                  <button
                    type="button"
                    onClick={selectAll}
                    className={cn(
                      "w-full text-sm text-center rounded-md border px-2 py-1.5 transition-colors",
                      allSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-primary/40 text-primary hover:bg-primary/5",
                    )}
                  >
                    Permitir todos atuais e futuros
                  </button>
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Multi-select de setores/canais de WhatsApp para o "Escopo de acesso" do
 * usuário — só faz sentido para role "vendedor", cuja visibilidade de
 * conversas é escopada por whatsapp_sector_members + whatsapp_channel_members
 * (ver vendorScopeCondition em server/services/whatsapp-conversations.service.ts).
 */
export function WhatsappAccessScopeFields({
  selectedSectorIds,
  selectedChannelIds,
  selectedQrChannelIds,
  onChangeSectorIds,
  onChangeChannelIds,
  onChangeQrChannelIds,
}: {
  selectedSectorIds: string[];
  selectedChannelIds: number[];
  selectedQrChannelIds: number[];
  onChangeSectorIds: (ids: string[]) => void;
  onChangeChannelIds: (ids: number[]) => void;
  onChangeQrChannelIds: (ids: number[]) => void;
}) {
  const { data: sectors = [], isLoading: sectorsLoading } = useQuery<WhatsappSector[]>({
    queryKey: ["/api/whatsapp/sectors"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/sectors");
      if (!res.ok) throw new Error("Failed to fetch sectors");
      return res.json();
    },
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery<WhatsappAccessChannel[]>({
    queryKey: ["/api/whatsapp/channels"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels");
      if (!res.ok) throw new Error("Failed to fetch channels");
      return res.json();
    },
  });

  const sectorItems = useMemo<ScopeItem<string>[]>(
    () => sectors.map((sector) => ({ id: sector.id, label: sector.name })),
    [sectors],
  );

  const channelItems = useMemo<ScopeItem<number>[]>(
    () =>
      channels.map((channel) => ({
        id: channel.id,
        label: channel.displayPhone ? `${channel.name} (${channel.displayPhone})` : channel.name,
      })),
    [channels],
  );

  return (
    <div className="min-w-0 w-full space-y-4 overflow-hidden rounded-lg border dark:border-slate-700 p-4">
      <div>
        <h4 className="text-sm font-medium">Escopo de acesso</h4>
        <p className="text-xs text-muted-foreground dark:text-slate-400">
          O atendente só verá as conversas dos setores e canais selecionados abaixo.
        </p>
      </div>

      <div className="min-w-0 space-y-2">
        <Label>Acesso aos setores</Label>
        <ScopeMultiSelect
          items={sectorItems}
          selectedIds={selectedSectorIds}
          onChange={onChangeSectorIds}
          placeholder="Selecione os setores"
          emptyLabel="Nenhum setor cadastrado."
          isLoading={sectorsLoading}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label>Acesso aos canais</Label>
        <ScopeMultiSelect
          items={channelItems}
          selectedIds={selectedChannelIds}
          onChange={onChangeChannelIds}
          placeholder="Selecione os canais"
          emptyLabel="Nenhum canal cadastrado."
          isLoading={channelsLoading}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label>Liberar leitura de QRCode nos canais</Label>
        <ScopeMultiSelect
          items={channelItems}
          selectedIds={selectedQrChannelIds}
          onChange={onChangeQrChannelIds}
          placeholder="Selecione os canais"
          emptyLabel="Nenhum canal cadastrado."
          isLoading={channelsLoading}
        />
      </div>
    </div>
  );
}
