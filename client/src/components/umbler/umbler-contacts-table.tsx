import { Skeleton } from "@/components/ui/skeleton";
import { User, Phone, Tag, Users } from "lucide-react";
import { UmblerContactActions } from "./umbler-contact-actions";

interface UmblerContactsTableProps {
  contacts: any[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  onViewDetails: (contact: any) => void;
  onEdit: (contact: any) => void;
  onDeleteClick: (contactId: string) => void;
}

export function UmblerContactsTable({
  contacts,
  isLoading,
  hasActiveFilters,
  onViewDetails,
  onEdit,
  onDeleteClick,
}: UmblerContactsTableProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Tabela Desktop */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[35%]">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 opacity-70" />
                  Contato
                </div>
              </th>
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[25%]">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 opacity-70" />
                  WhatsApp
                </div>
              </th>
              <th className="text-left py-4 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[30%]">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 opacity-70" />
                  Tags
                </div>
              </th>
              <th className="text-right py-4 px-5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr
                  key={i}
                  className="bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                      <div className="space-y-2.5">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-24 rounded-md" />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <Skeleton className="h-6 w-32 rounded-md" />
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </td>
                </tr>
              ))
            ) : contacts?.length === 0 ? (
              <tr>
                <td colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                      <Users className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Nenhum contato encontrado
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {hasActiveFilters
                        ? "Tente ajustar ou limpar os filtros para encontrar o que procura."
                        : "Sincronize ou adicione seu primeiro contato para começar a visualizar dados aqui."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              contacts?.map((contact: any) => (
                <tr
                  key={contact.id}
                  className="cursor-pointer group bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-200"
                  onClick={() => onViewDetails(contact)}
                >
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-4">
                      {contact.profilePictureUrl ? (
                        <div className="relative shrink-0">
                          <img
                            src={contact.profilePictureUrl}
                            alt={contact.name || "Avatar"}
                            className="h-11 w-11 rounded-full object-cover ring-2 ring-transparent group-hover:ring-blue-200 dark:group-hover:ring-blue-800 transition-all shadow-sm"
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-sm" />
                        </div>
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shrink-0 shadow-inner group-hover:from-blue-100 group-hover:to-blue-50 dark:group-hover:from-blue-900/40 dark:group-hover:to-blue-800/30 transition-all border border-slate-200 dark:border-slate-700">
                          <User className="h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate max-w-[250px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          {contact.name || (
                            <span className="text-slate-400 dark:text-slate-500 italic font-medium">
                              Contato Sem Nome
                            </span>
                          )}
                        </span>
                        {contact.email && (
                          <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[250px] mt-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-md shrink-0 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                        <Phone className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <code className="text-sm font-medium font-mono text-slate-700 dark:text-slate-300 tracking-tight">
                        {contact.phoneNumber}
                      </code>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    {contact.tags && contact.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {contact.tags.slice(0, 3).map((tag: any) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors shadow-sm"
                          >
                            {tag.emoji && (
                              <span className="mr-1.5">{tag.emoji}</span>
                            )}
                            {tag.name}
                          </span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 shadow-sm border-dashed">
                            +{contact.tags.length - 3} mais
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-400 border border-transparent dark:bg-slate-800/50 dark:text-slate-500 italic">
                        Sem categorias
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex justify-end pr-2">
                      <UmblerContactActions
                        contact={contact}
                        onViewDetails={onViewDetails}
                        onEdit={onEdit}
                        onDeleteClick={onDeleteClick}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards Mobile */}
      <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 bg-white dark:bg-slate-900">
              <div className="flex items-start gap-4 mb-4">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3 rounded-md" />
                <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          ))
        ) : contacts?.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-slate-100 dark:border-slate-800">
              <Users className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Nada encontrado
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {hasActiveFilters
                ? "Tente ajustar os filtros."
                : "Adicione contatos para começar."}
            </p>
          </div>
        ) : (
          contacts?.map((contact: any) => (
            <div
              key={contact.id}
              className="p-5 bg-white dark:bg-slate-900 active:bg-slate-50 dark:active:bg-slate-800/80 transition-colors cursor-pointer"
              onClick={() => onViewDetails(contact)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {contact.profilePictureUrl ? (
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={contact.profilePictureUrl}
                          alt={contact.name || "Avatar"}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-sm" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-inner border border-slate-200 dark:border-slate-700">
                        <User className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1 py-0.5">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-[15px] leading-tight mb-1">
                        {contact.name || (
                          <span className="text-slate-400 dark:text-slate-500 italic font-medium">
                            Sem nome
                          </span>
                        )}
                      </h4>
                      {contact.email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
                          {contact.email}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                         <div className="p-1 bg-slate-50 dark:bg-slate-800 rounded mb-0.5">
                           <Phone className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                         </div>
                        <code className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                          {contact.phoneNumber}
                        </code>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 -mr-2">
                    <UmblerContactActions
                      contact={contact}
                      onViewDetails={onViewDetails}
                      onEdit={onEdit}
                      onDeleteClick={onDeleteClick}
                    />
                  </div>
                </div>

                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50 dark:border-slate-800/80">
                    {contact.tags.slice(0, 4).map((tag: any) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {tag.emoji && <span className="mr-1.5">{tag.emoji}</span>}
                        {tag.name}
                      </span>
                    ))}
                    {contact.tags.length > 4 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-white border border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 border-dashed">
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
  );
}
