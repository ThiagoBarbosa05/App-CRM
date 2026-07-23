import { useState } from "react";
import { Crown, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  useGroupMembers,
  useInternalConversations,
  useAddGroupMembers,
  useRemoveGroupMember,
  usePromoteGroupMember,
} from "@/hooks/useInternalChat";

interface GroupMembersDialogProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupMembersDialog({ conversationId, open, onOpenChange }: GroupMembersDialogProps) {
  const { user } = useAuth();
  const [addingOpen, setAddingOpen] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);

  const { data: members = [] } = useGroupMembers(conversationId, open);
  const { data: attendants = [] } = useInternalConversations("attendants", "");
  const addMembers = useAddGroupMembers(conversationId);
  const removeMember = useRemoveGroupMember(conversationId);
  const promoteMember = usePromoteGroupMember(conversationId);

  const myRole = members.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = attendants.filter((a) => a.otherUser && !memberIds.has(a.otherUser.id));

  function toggleCandidate(userId: string) {
    setToAdd((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleAdd() {
    if (toAdd.length === 0) return;
    await addMembers.mutateAsync(toAdd);
    setToAdd([]);
    setAddingOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Membros do grupo</DialogTitle>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto divide-y">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between py-2 text-sm">
              <div className="flex items-center gap-2">
                <span>{member.name}</span>
                {member.role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                {member.role === "admin" && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
              </div>
              {canManage && member.userId !== user?.id && (
                <div className="flex items-center gap-1">
                  {member.role === "member" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => promoteMember.mutate(member.userId)}
                    >
                      Promover
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeMember.mutate(member.userId)}
                    title="Remover do grupo"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {member.userId === user?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-500"
                  onClick={() => removeMember.mutate(member.userId)}
                >
                  Sair do grupo
                </Button>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <>
            {!addingOpen ? (
              <Button variant="outline" size="sm" onClick={() => setAddingOpen(true)} className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Adicionar membro
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {candidates.map((candidate) => (
                    <label
                      key={candidate.otherUser!.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={toAdd.includes(candidate.otherUser!.id)}
                        onCheckedChange={() => toggleCandidate(candidate.otherUser!.id)}
                      />
                      <span>{candidate.otherUser!.name}</span>
                    </label>
                  ))}
                  {candidates.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      Todos os atendentes já estão no grupo
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddingOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={toAdd.length === 0 || addMembers.isPending}>
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
