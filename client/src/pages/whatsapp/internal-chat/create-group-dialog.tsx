import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useInternalConversations, useCreateGroup } from "@/hooks/useInternalChat";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { data: attendants = [] } = useInternalConversations("attendants", "");
  const createGroup = useCreateGroup();

  function toggle(userId: string) {
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleCreate() {
    if (!name.trim() || selected.length === 0) return;
    const group = await createGroup.mutateAsync({ name: name.trim(), memberUserIds: selected });
    setName("");
    setSelected([]);
    onCreated(group.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do grupo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Equipe Comercial" />
          </div>
          <div>
            <Label>Membros</Label>
            <div className="max-h-64 overflow-y-auto border rounded-md mt-1.5 divide-y">
              {attendants.map((attendant) => (
                <label
                  key={attendant.otherUser!.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.includes(attendant.otherUser!.id)}
                    onCheckedChange={() => toggle(attendant.otherUser!.id)}
                  />
                  <span>{attendant.otherUser!.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || selected.length === 0 || createGroup.isPending}>
            Criar grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
