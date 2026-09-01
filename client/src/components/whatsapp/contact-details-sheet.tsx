import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  MapPin,
  Calendar,
  Phone,
  ExternalLink,
  Tag,
  Cake,
  BellOff,
  ShoppingBag,
} from "lucide-react";
import { formatPhone, formatCpf, formatDate } from "@/lib/utils";
import type { Client } from "@shared/schema";
import type { ClientRegistrationQuality } from "@shared/client-registration-quality";
import { RegistrationQualityBar } from "@/components/clients/registration-quality-bar";
import { resolveWhatsappContactName } from "@/lib/whatsapp-contact-name";
import { resolveWhatsappContactPhotoUrl } from "@shared/whatsapp-contact-photo";
import {
  ContactAvatar,
  WhatsappTagBadge,
  type ChatClient,
} from "@/pages/whatsapp/conversations";

interface ContactDetailsSheetProps {
  client: ChatClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ClientDetails = Client & {
  registrationQuality?: ClientRegistrationQuality;
  lastPurchaseDate?: string | null;
};

export function ContactDetailsSheet({
  client,
  open,
  onOpenChange,
}: ContactDetailsSheetProps) {
  const displayName = resolveWhatsappContactName(client);
  const hasTags =
    (client.tags && client.tags.length > 0) ||
    (client.whatsappTags && client.whatsappTags.length > 0);

  const { data: fullClient, isLoading } = useQuery<ClientDetails>({
    queryKey: ["/api/clients", client.clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${client.clientId}`);
      if (!res.ok) throw new Error("Cliente não encontrado");
      return res.json();
    },
    enabled: open && !!client.clientId,
    staleTime: 60_000,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-3/4 sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do contato</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          {/* Cabeçalho do contato */}
          <div className="flex items-center gap-3">
            <ContactAvatar
              name={displayName}
              phone={client.phone}
              photoUrl={resolveWhatsappContactPhotoUrl(client)}
              className="h-14 w-14 text-lg font-bold shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {formatPhone(client.phone)}
              </p>
            </div>
          </div>

          {(fullClient?.whatsappOptOut ?? client.whatsappOptOut) && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-800/70 dark:bg-rose-500/10 dark:text-rose-300">
              <BellOff className="h-3.5 w-3.5 shrink-0" />
              Cliente não recebe mensagens de marketing
            </div>
          )}

          {/* Etiquetas */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Etiquetas do contato
            </h3>
            {hasTags ? (
              <div className="flex flex-wrap gap-1.5">
                {client.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                  >
                    {tag.name}
                  </span>
                ))}
                {client.whatsappTags?.map((tag) => (
                  <WhatsappTagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Nenhuma etiqueta
              </p>
            )}
          </div>

          {/* Dados do cliente vinculado */}
          {client.clientId ? (
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 mb-2">
                Dados do cliente
              </h3>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : fullClient ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Cadastro
                      </p>
                      {fullClient.registrationQuality ? (
                        <RegistrationQualityBar quality={fullClient.registrationQuality} />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Última compra
                      </p>
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                        <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{fullClient.lastPurchaseDate ? formatDate(fullClient.lastPurchaseDate) : "—"}</span>
                      </div>
                    </div>
                  </div>
                  {fullClient.email && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{fullClient.email}</span>
                    </div>
                  )}
                  {fullClient.fixedPhone && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>Fixo: {formatPhone(fullClient.fixedPhone)}</span>
                    </div>
                  )}
                  {fullClient.cpf && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="h-4 w-4 shrink-0" />
                      <span>
                        {fullClient.documentType === "cnpj" ? "CNPJ" : "CPF"}:{" "}
                        {formatCpf(fullClient.cpf)}
                      </span>
                    </div>
                  )}
                  {fullClient.birthday && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Cake className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>Aniversário: {formatDate(fullClient.birthday)}</span>
                    </div>
                  )}
                  {(fullClient.city || fullClient.state) && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        {[fullClient.city, fullClient.state]
                          .filter(Boolean)
                          .join("/")}
                      </span>
                    </div>
                  )}
                  {fullClient.createdAt && (
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        Cliente desde{" "}
                        {formatDate(fullClient.createdAt.toString())}
                      </span>
                    </div>
                  )}

                  <Link
                    href={`/clientes/${client.clientId}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                  >
                    Ver perfil completo
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Contato ainda não vinculado a um cliente do CRM.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
