import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquare, Tag, User } from "lucide-react";

interface UmblerContactDetailsProps {
  contact: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UmblerContactDetails({
  contact,
  open,
  onOpenChange,
}: UmblerContactDetailsProps) {
  const { data: tags } = useQuery({
    queryKey: ["umbler-contact-tags", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const res = await fetch(`/api/umbler/contacts/${contact.id}/tags`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!contact?.id && open,
  });

  const { data: conversations } = useQuery({
    queryKey: ["umbler-contact-conversations", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const res = await fetch(
        `/api/umbler/contacts/${contact.id}/conversations`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    },
    enabled: !!contact?.id && open,
  });

  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Detalhes do Contato</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 dark:bg-slate-700 flex items-center justify-center">
              <User className="h-8 w-8 text-primary dark:text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-slate-100">
                {contact.name}
              </h2>
              <p className="text-muted-foreground dark:text-slate-300">
                {contact.phoneNumber}
              </p>
              {contact.email && (
                <p className="text-sm text-muted-foreground">{contact.email}</p>
              )}
            </div>
          </div>

          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger
                value="details"
                className="flex-1 dark:text-slate-100"
              >
                Detalhes
              </TabsTrigger>
              <TabsTrigger
                value="conversations"
                className="flex-1 dark:text-slate-100"
              >
                Conversas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold flex dark:text-slate-100 items-center gap-2">
                  <Tag className="h-4 w-4 dark:text-slate-100" /> Etiquetas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tags?.map((tag: any) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      style={{
                        backgroundColor: tag.color,
                        color: tag.color ? "#fff" : undefined,
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {(!tags || tags.length === 0) && (
                    <p className="text-sm text-muted-foreground dark:text-slate-400">
                      Nenhuma etiqueta encontrada.
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="conversations">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {conversations?.map((chat: any) => (
                    <div
                      key={chat.id}
                      className="rounded-lg border dark:border-slate-700 p-3 hover:bg-muted/50  transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium flex dark:text-slate-100 items-center gap-2">
                          <MessageSquare className="h-4 w-4 dark:text-slate-100" />
                          {chat.channel?.name || "Canal desconhecido"}
                        </span>
                        <span className="text-xs text-muted-foreground dark:text-slate-400">
                          {chat.lastMessage?.createdAtUTC &&
                            format(
                              new Date(chat.lastMessage.createdAtUTC),
                              "dd/MM/yyyy HH:mm",
                            )}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground dark:text-slate-400 line-clamp-2">
                        {chat.lastMessage?.content || "Sem mensagens"}
                      </p>
                    </div>
                  ))}
                  {(!conversations || conversations.length === 0) && (
                    <p className="text-sm text-muted-foreground dark:text-slate-400 text-center py-4">
                      Nenhuma conversa encontrada.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
