import { UmblerContactDetails } from "@/components/umbler-contact-details";
import { UmblerContactDialog } from "@/components/umbler-contact-dialog";
import UmblerTagSelect from "@/components/umbler-tag-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  MoreHorizontal,
  Search,
  Trash,
  Users,
  Filter,
  X,
  Phone,
  User,
  Tag,
  Send,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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

export default function UmblerContactsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [exclusiveTagFilter, setExclusiveTagFilter] = useState(true); // Por padrão, filtro exclusivo ativado
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen pb-10">
      <div className="container mx-auto px-3 py-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header minimalista */}
        <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-200">
                  Contatos Umbler
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 max-w-2xl">
                Gerencie e organize seus contatos do Umbler uTalk
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setLocation("/umbler/campaigns/create")}
                variant="outline"
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Criar Campanha
              </Button>
              <UmblerContactDialog />
            </div>
          </div>
        </div>

        {/* Stats Card minimalista */}
        <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-5 hover:bg-gray-50/50 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[10px] sm:text-xs dark:text-gray-300 font-medium text-gray-500 uppercase tracking-wide mb-1">
                Total de Contatos
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-200 mb-1">
                {isLoading ? "..." : totalContacts}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-slate-400">
                {totalContacts === 1
                  ? "contato cadastrado"
                  : "contatos cadastrados"}
              </p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Filtros minimalistas */}
        <div className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg p-4 overflow-visible">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  Filtros
                </h3>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-gray-600 hover:bg-gray-100 self-start dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 sm:self-auto"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>
              <UmblerTagSelect
                value={selectedTags}
                onChange={setSelectedTags}
                placeholder="Filtrar por tags..."
              />
            </div>

            {/* Opção de filtro exclusivo */}
            {selectedTags.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 pb-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={exclusiveTagFilter}
                    onChange={(e) => setExclusiveTagFilter(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-gray-700 group-hover:text-gray-900  dark:text-slate-400 dark:group-hover:text-slate-200 select-none">
                    Apenas contatos com estas tags exclusivamente
                  </span>
                </label>
                <div className="group relative flex-shrink-0">
                  <div className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 cursor-help">
                    ?
                  </div>
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-6 w-64 max-w-[calc(100vw-2rem)] p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Quando ativado, mostra apenas contatos que possuem{" "}
                    <strong>exatamente</strong> as tags selecionadas, evitando
                    duplicatas em campanhas diferentes.
                  </div>
                </div>
              </div>
            )}

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 pt-1">
                {search && (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-xs border border-gray-200 bg-gray-50 text-gray-700">
                    <Search className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{search}</span>
                    <button
                      onClick={() => setSearch("")}
                      className="ml-1 hover:bg-gray-200 rounded-full p-0.5 transition-colors flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedTags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border dark:bg-slate-700 dark:text-slate-100 dark:border-slate-700 border-gray-200 bg-gray-50 text-gray-700">
                    <Tag className="h-3 w-3 flex-shrink-0" />
                    {selectedTags.length} tag
                    {selectedTags.length !== 1 ? "s" : ""}
                    {exclusiveTagFilter && (
                      <span className="ml-1 text-[10px] bg-blue-100 dark:bg-blue-900 dark:text-blue-50 text-blue-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                        exclusivo
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {/* Tabela Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-100 uppercase tracking-wide w-[35%]">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nome
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-100 uppercase tracking-wide w-[25%]">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Telefone
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-100 uppercase tracking-wide w-[30%]">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Tags
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-slate-100 uppercase tracking-wide w-[10%]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={i}
                      className={
                        i % 2 === 0
                          ? "bg-white dark:bg-slate-900"
                          : "bg-gray-50/30 dark:bg-slate-800/50"
                      }
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-6 w-28 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1.5">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end">
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : contacts?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <Users className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                          Nenhum contato encontrado
                        </h3>
                        <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md">
                          {hasActiveFilters
                            ? "Tente ajustar os filtros para encontrar contatos"
                            : "Adicione seu primeiro contato para começar"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts?.map((contact: any, index: number) => (
                    <tr
                      key={contact.id}
                      className={`cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/70 transition-colors group ${
                        index % 2 === 0
                          ? "bg-white dark:bg-slate-900"
                          : "bg-gray-50/30 dark:bg-slate-800/50"
                      }`}
                      onClick={() => handleViewDetails(contact)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {contact.profilePictureUrl ? (
                            <div className="relative">
                              <img
                                src={contact.profilePictureUrl}
                                alt={contact.name || "Avatar"}
                                className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-blue-300 transition-all"
                              />
                              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center group-hover:from-blue-200 group-hover:to-blue-100 dark:group-hover:from-blue-900/40 dark:group-hover:to-blue-800/40 transition-all">
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="truncate max-w-[250px] font-medium text-gray-900 dark:text-slate-100">
                              {contact.name || (
                                <span className="text-gray-400 dark:text-slate-500 italic font-normal">
                                  Sem nome
                                </span>
                              )}
                            </span>
                            {contact.email && (
                              <span className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[250px]">
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                          <code className="text-xs bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 rounded border border-gray-200 dark:border-slate-700 font-mono text-gray-700 dark:text-slate-300 group-hover:bg-gray-200 dark:group-hover:bg-slate-700 transition-colors">
                            {contact.phoneNumber}
                          </code>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {contact.tags.slice(0, 3).map((tag: any) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              >
                                {tag.emoji && (
                                  <span className="mr-1">{tag.emoji}</span>
                                )}
                                {tag.name}
                              </span>
                            ))}
                            {contact.tags.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                                +{contact.tags.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-slate-500 italic">
                            Sem tags
                          </span>
                        )}
                      </td>
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="py-4 px-4"
                      >
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-800"
                              >
                                {/* <span className="sr-only">Abrir menu</span> */}
                                <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel className="text-xs font-normal text-gray-500">
                                Ações
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleViewDetails(contact)}
                                className="cursor-pointer"
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEdit(contact)}
                                className="cursor-pointer"
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={() => handleDeleteClick(contact.id)}
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile */}
          <div className="lg:hidden divide-y divide-gray-200 dark:divide-slate-700">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-28" />
                    <div className="flex gap-1.5">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
              ))
            ) : contacts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                  Nenhum contato encontrado
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md px-4">
                  {hasActiveFilters
                    ? "Tente ajustar os filtros para encontrar contatos"
                    : "Adicione seu primeiro contato para começar"}
                </p>
              </div>
            ) : (
              contacts?.map((contact: any) => (
                <div
                  key={contact.id}
                  className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 active:bg-gray-100 dark:active:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => handleViewDetails(contact)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {contact.profilePictureUrl ? (
                          <div className="relative flex-shrink-0">
                            <img
                              src={contact.profilePictureUrl}
                              alt={contact.name || "Avatar"}
                              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/30 flex items-center justify-center flex-shrink-0">
                            <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm">
                            {contact.name || (
                              <span className="text-gray-400 dark:text-slate-500 italic font-normal">
                                Sem nome
                              </span>
                            )}
                          </h4>
                          {contact.email && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                              {contact.email}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Phone className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                            <code className="text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-700 font-mono text-gray-700 dark:text-slate-300 truncate">
                              {contact.phoneNumber}
                            </code>
                          </div>
                        </div>
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0"
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-800"
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs font-normal text-gray-500 ">
                              Ações
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(contact)}
                              className="cursor-pointer "
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(contact)}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => handleDeleteClick(contact.id)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Deletar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                        {contact.tags.slice(0, 4).map((tag: any) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          >
                            {tag.emoji && (
                              <span className="mr-1">{tag.emoji}</span>
                            )}
                            {tag.name}
                          </span>
                        ))}
                        {contact.tags.length > 4 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                            +{contact.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deletar este contato? Esta ação não pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deletando..." : "Deletar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
