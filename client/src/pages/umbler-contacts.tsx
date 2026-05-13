import { UmblerContactDetails } from "@/components/umbler-contact-details";
import { UmblerContactDialog } from "@/components/umbler-contact-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/page-header";
import { Users, Send } from "lucide-react";
import { UmblerContactsFilters } from "@/components/umbler/umbler-contacts-filters";
import { UmblerContactsTable } from "@/components/umbler/umbler-contacts-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function UmblerContactsPage() {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [exclusiveTagFilter, setExclusiveTagFilter] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch contacts based on filters
  const { data: contacts, isLoading } = useQuery({
    queryKey: ["umbler-contacts", search, selectedTags, exclusiveTagFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("query", search);
      if (selectedTags.length > 0) {
        selectedTags.forEach((tagId) => params.append("tags", tagId));
        params.append("exclusiveTag", exclusiveTagFilter.toString());
      }
      const res = await fetch(`/api/umbler/contacts?${params.toString()}`);
      if (!res.ok) throw new Error("Falha ao buscar contatos");
      const data = await res.json();
      return data.items || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/umbler/contacts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao deletar contato");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["umbler-contacts"] });
      toast({
        title: "✓ Sucesso",
        description: "Contato deletado com sucesso",
        duration: 3000,
      });
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    },
    onError: () => {
      toast({
        title: "✗ Erro",
        description: "Erro ao deletar contato",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setEditOpen(true);
  };

  const handleViewDetails = (contact: any) => {
    setSelectedContact(contact);
    setDetailsOpen(true);
  };

  const handleDeleteClick = (contactId: string) => {
    setContactToDelete(contactId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contactToDelete) {
      deleteMutation.mutate(contactToDelete);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedTags([]);
  };

  const hasActiveFilters = search || selectedTags.length > 0;
  const totalContacts = contacts?.length || 0;

  return (
    <div className="space-y-6 pb-10">
        <PageHeader>
          <PageHeader.Info>
            <PageHeader.Icon icon={Users} color="text-primary" bgColor="bg-accent" />
            <PageHeader.Text>
              <PageHeader.Title>Contatos Umbler</PageHeader.Title>
              <PageHeader.Description>
                Gerencie todos os seus contatos sincronizados do Umbler uTalk
              </PageHeader.Description>
            </PageHeader.Text>
          </PageHeader.Info>
          <PageHeader.Actions>
            {user?.role === "admin" && (
              <Button
                variant="outline"
                onClick={() => setLocation("/umbler/campaigns/create")}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Criar Campanha
              </Button>
            )}
            <UmblerContactDialog />
          </PageHeader.Actions>
        </PageHeader>

        <UmblerContactsFilters
          search={search}
          setSearch={setSearch}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          exclusiveTagFilter={exclusiveTagFilter}
          setExclusiveTagFilter={setExclusiveTagFilter}
          hasActiveFilters={!!hasActiveFilters}
          clearFilters={clearFilters}
        />

        <UmblerContactsTable
          contacts={contacts || []}
          isLoading={isLoading}
          hasActiveFilters={!!hasActiveFilters}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onDeleteClick={handleDeleteClick}
        />

        {/* Dialogs */}
        <UmblerContactDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          contact={selectedContact}
        />

        <UmblerContactDetails
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          contact={selectedContact}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Confirmar exclusão
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
                Tem certeza que deseja deletar este contato? Esta ação não pode
                ser desfeita e ele será removido das campanhas ativas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-3">
              <AlertDialogCancel className="mt-0 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 text-white hover:bg-red-700 shadow-sm border-none shadow-red-500/20 transition-all font-medium"
              >
                {deleteMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full" />
                    Deletando...
                  </span>
                ) : (
                  "Excluir Contato"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
