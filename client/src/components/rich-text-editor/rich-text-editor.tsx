import {
  useEditor,
  EditorContent,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Table as TableIcon,
  Link as LinkIcon,
  Minus,
  MoreHorizontal,
  Columns2,
  Rows2,
  Trash2,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Detecta se o conteúdo é JSON do Tiptap ou texto puro */
function parseContent(raw: string): object | string {
  if (!raw || raw.trim() === "") return "";
  try {
    const parsed = JSON.parse(raw);
    // JSON do Tiptap sempre tem type: "doc"
    if (parsed && parsed.type === "doc") return parsed;
  } catch {
    // não é JSON
  }
  // Texto puro → converte para parágrafo Tiptap
  return {
    type: "doc",
    content: raw
      .split("\n")
      .map((line) => ({
        type: "paragraph",
        content: line
          ? [{ type: "text", text: line }]
          : [],
      })),
  };
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // evita perda de foco do editor
              if (!disabled) onClick();
            }}
            disabled={disabled}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-md transition-colors text-slate-500 dark:text-slate-400",
              active
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                : "hover:bg-slate-100 dark:hover:bg-slate-800",
              disabled && "opacity-30 cursor-not-allowed",
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />;
}

// ─── Table menu ───────────────────────────────────────────────────────────────

function TableMenu({ editor }: { editor: Editor }) {
  const isInTable = editor.isActive("table");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-md transition-colors text-slate-500 dark:text-slate-400",
            isInTable
              ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              : "hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          <TableIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-2 rounded-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
          Tabela
        </p>
        <div className="flex flex-col gap-0.5">
          {!isInTable && (
            <button
              type="button"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
            >
              <Plus className="h-3.5 w-3.5 text-slate-400" />
              Inserir tabela (3×3)
            </button>
          )}
          {isInTable && (
            <>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().addColumnAfter().run()
                }
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                <Columns2 className="h-3.5 w-3.5 text-slate-400" />
                Adicionar coluna
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().addRowAfter().run()
                }
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                <Rows2 className="h-3.5 w-3.5 text-slate-400" />
                Adicionar linha
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().deleteColumn().run()
                }
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover coluna
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover linha
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().deleteTable().run()
                }
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-rose-600 font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir tabela
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Link menu ────────────────────────────────────────────────────────────────

function LinkMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const isActive = editor.isActive("link");

  const applyLink = () => {
    if (!url.trim()) return;
    const href = url.startsWith("http") ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setUrl("");
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-md transition-colors text-slate-500 dark:text-slate-400",
            isActive
              ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              : "hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 rounded-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Link
        </p>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
            }}
          />
          <Button size="sm" className="h-8 px-3" onClick={applyLink}>
            OK
          </Button>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={removeLink}
            className="mt-2 text-xs text-rose-500 hover:text-rose-700"
          >
            Remover link
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-t-xl">
      {/* Formatação de texto */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Tachado"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive("highlight")}
        title="Destacar texto"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Divider />

      {/* Títulos */}
      <ToolbarBtn
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        active={editor.isActive("heading", { level: 1 })}
        title="Título H1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
        title="Título H2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
        title="Título H3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Divider />

      {/* Listas */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Lista com marcadores"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Lista numerada"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        title="Checklist"
      >
        <ListChecks className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Divider />

      {/* Tabela */}
      <TableMenu editor={editor} />

      {/* Link */}
      <LinkMenu editor={editor} />

      {/* Divisor horizontal */}
      <ToolbarBtn
        onClick={() =>
          editor.chain().focus().setHorizontalRule().run()
        }
        title="Divisor horizontal"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarBtn>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface RichTextEditorHandle {
  /** Retorna o conteúdo atual como HTML renderizado */
  getHtml: () => string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (jsonString: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva sua anotação aqui...",
  className,
}, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Desabilita o código inline para não conflitar com o highlight
        code: { HTMLAttributes: { class: "bg-slate-100 dark:bg-slate-800 rounded px-1 font-mono text-xs" } },
        codeBlock: { HTMLAttributes: { class: "bg-slate-100 dark:bg-slate-800 rounded p-3 font-mono text-xs my-2" } },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: {
          class: "text-blue-600 dark:text-blue-400 underline cursor-pointer",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: parseContent(value) || "",
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Expõe getHtml() para o componente pai via ref
  useImperativeHandle(ref, () => ({
    getHtml: () => editor?.getHTML() ?? "",
  }), [editor]);

  // Atualiza o conteúdo do editor quando a nota muda (troca de nota)
  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(value);
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson = JSON.stringify(parsed || { type: "doc", content: [] });
    if (currentJson !== newJson) {
      editor.commands.setContent(parsed || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="rich-editor flex-1 overflow-auto"
      />
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";
