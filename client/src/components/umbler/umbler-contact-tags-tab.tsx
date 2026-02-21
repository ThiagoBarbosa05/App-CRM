import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface UmblerContactTagsTabProps {
  contactId: string;
}

export function UmblerContactTagsTab({ contactId }: UmblerContactTagsTabProps) {
  const { data: tags, isLoading } = useQuery({
    queryKey: ["umbler-contact-tags", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const res = await fetch(`/api/umbler/contacts/${contactId}/tags`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!contactId,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flexItems-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Tag className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Categorias e Tags
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gerencie a segmentação deste contato.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        ) : tags && tags.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {tags.map((tag: any) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="px-3.5 py-1.5 text-sm font-medium shadow-sm hover:shadow-md transition-shadow dark:border-slate-700"
                style={{
                  backgroundColor: tag.color || undefined,
                  color: tag.color ? "#fff" : undefined,
                }}
              >
                {tag.emoji && <span className="mr-2">{tag.emoji}</span>}
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex flex-col flex-1 text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Tag className="h-6 w-6 text-slate-400 dark:text-slate-500 opacity-50" />
            </div>
            <p className="text-base font-medium text-slate-900 dark:text-slate-200 mb-1">
              Nenhuma etiqueta atribuída
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Edite o contato para adicionar tags e facilitar a segmentação.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
