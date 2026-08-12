import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { CanvasBlock, type CanvasBlockData } from "./canvas-block";

// ── Canvas JSON format ────────────────────────────────────────────────────────
export interface CanvasDoc {
  type: "canvas";
  blocks: CanvasBlockData[];
}

export function isCanvasDoc(raw: string): boolean {
  if (!raw || !raw.trimStart().startsWith("{")) return false;
  try {
    const p = JSON.parse(raw);
    return p?.type === "canvas";
  } catch {
    return false;
  }
}

export function emptyCanvasDoc(): string {
  return JSON.stringify({ type: "canvas", blocks: [] } satisfies CanvasDoc);
}

function parseCanvas(raw: string): CanvasDoc {
  try {
    return JSON.parse(raw) as CanvasDoc;
  } catch {
    return { type: "canvas", blocks: [] };
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NoteCanvasProps {
  value: string;
  onChange: (json: string) => void;
}

export function NoteCanvas({ value, onChange }: NoteCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<CanvasDoc>(() => parseCanvas(value));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync quando a nota muda externamente (troca de nota)
  useEffect(() => {
    setDoc(parseCanvas(value));
    setSelectedId(null);
  }, [value]);

  const commit = useCallback(
    (next: CanvasDoc) => {
      setDoc(next);
      onChange(JSON.stringify(next));
    },
    [onChange],
  );

  // Criar bloco no ponto do duplo-clique
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ignora se o clique foi em um bloco filho
      if (e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newBlock: CanvasBlockData = {
        id: uid(),
        x: Math.max(0, x - 160),
        y: Math.max(0, y - 60),
        width: 320,
        height: 200,
        content: "",
      };
      const next = { ...doc, blocks: [...doc.blocks, newBlock] };
      commit(next);
      setSelectedId(newBlock.id);
    },
    [doc, commit],
  );

  const handleAddBlock = useCallback(() => {
    // Coloca no centro da área visível
    const canvas = canvasRef.current;
    const scrollLeft = canvas?.scrollLeft ?? 0;
    const scrollTop = canvas?.scrollTop ?? 0;
    const viewW = canvas?.clientWidth ?? 800;
    const viewH = canvas?.clientHeight ?? 600;
    const newBlock: CanvasBlockData = {
      id: uid(),
      x: scrollLeft + viewW / 2 - 160,
      y: scrollTop + viewH / 2 - 100,
      width: 320,
      height: 200,
      content: "",
    };
    const next = { ...doc, blocks: [...doc.blocks, newBlock] };
    commit(next);
    setSelectedId(newBlock.id);
  }, [doc, commit]);

  const handleBlockChange = useCallback(
    (id: string, patch: Partial<CanvasBlockData>) => {
      setDoc((prev) => {
        const next = {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        };
        onChange(JSON.stringify(next));
        return next;
      });
    },
    [onChange],
  );

  const handleBlockDelete = useCallback(
    (id: string) => {
      const next = { ...doc, blocks: doc.blocks.filter((b) => b.id !== id) };
      commit(next);
      if (selectedId === id) setSelectedId(null);
    },
    [doc, commit, selectedId],
  );

  // Deselect ao clicar no fundo
  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) setSelectedId(null);
    },
    [],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar do canvas */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 select-none">
        <span className="hidden sm:inline">
          Duplo-clique na área para criar uma caixa
        </span>
        <span className="sm:hidden">Toque longo para adicionar</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleAddBlock}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium transition-colors"
        >
          <Plus className="h-3 w-3" />
          Adicionar caixa
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto relative"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          minHeight: 500,
        }}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={handleBackgroundMouseDown}
      >
        {/* Invisible large canvas floor so scrollbars appear */}
        <div style={{ width: 2000, height: 1400, position: "absolute" }} />

        {doc.blocks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <div className="text-4xl mb-3 opacity-20">📝</div>
            <p className="text-sm text-slate-400 dark:text-slate-600 font-medium">
              Área em branco
            </p>
            <p className="text-xs text-slate-300 dark:text-slate-700 mt-1">
              Duplo-clique em qualquer ponto ou use "+ Adicionar caixa"
            </p>
          </div>
        )}

        {doc.blocks.map((block) => (
          <CanvasBlock
            key={block.id}
            block={block}
            isSelected={selectedId === block.id}
            onSelect={() => setSelectedId(block.id)}
            onChange={(patch) => handleBlockChange(block.id, patch)}
            onDelete={() => handleBlockDelete(block.id)}
            canvasRef={canvasRef}
          />
        ))}
      </div>
    </div>
  );
}
