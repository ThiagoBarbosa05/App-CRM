import { useCallback, useEffect, useRef, useState } from "react";
import { X, GripHorizontal } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor/rich-text-editor";
import { cn } from "@/lib/utils";

export interface CanvasBlockData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
}

interface CanvasBlockProps {
  block: CanvasBlockData;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasBlockData>) => void;
  onDelete: () => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

const MIN_W = 220;
const MIN_H = 120;

export function CanvasBlock({
  block,
  isSelected,
  onSelect,
  onChange,
  onDelete,
  canvasRef,
}: CanvasBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: block.x,
        origY: block.y,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        onChange({
          x: Math.max(0, dragState.current.origX + dx),
          y: Math.max(0, dragState.current.origY + dy),
        });
      };

      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [block.x, block.y, onChange, onSelect],
  );

  // ── Resize ────────────────────────────────────────────────────────────────
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: block.width,
        origH: block.height,
      };

      const onMove = (ev: MouseEvent) => {
        if (!resizeState.current) return;
        const dx = ev.clientX - resizeState.current.startX;
        const dy = ev.clientY - resizeState.current.startY;
        onChange({
          width: Math.max(MIN_W, resizeState.current.origW + dx),
          height: Math.max(MIN_H, resizeState.current.origH + dy),
        });
      };

      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [block.width, block.height, onChange],
  );

  return (
    <div
      ref={blockRef}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        position: "absolute",
        left: block.x,
        top: block.y,
        width: block.width,
        height: block.height,
        minWidth: MIN_W,
        minHeight: MIN_H,
      }}
      className={cn(
        "flex flex-col rounded-xl shadow-md border bg-white dark:bg-slate-900 overflow-hidden",
        isSelected
          ? "border-blue-400 dark:border-blue-500 shadow-blue-100 dark:shadow-blue-900/30"
          : "border-slate-200 dark:border-slate-700",
      )}
    >
      {/* Drag handle bar */}
      <div
        onMouseDown={onDragMouseDown}
        className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 cursor-grab active:cursor-grabbing select-none"
      >
        <GripHorizontal className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          className="h-5 w-5 flex items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          title="Remover caixa"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Editor — flex-1 so it fills the block */}
      <div className="flex-1 overflow-auto">
        <RichTextEditor
          value={block.content}
          onChange={(json) => onChange({ content: json })}
          placeholder="Escreva aqui..."
          className="h-full rounded-none border-0 shadow-none"
        />
      </div>

      {/* Resize grip */}
      <div
        onMouseDown={onResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        title="Redimensionar"
      >
        <svg
          viewBox="0 0 8 8"
          className="absolute bottom-1 right-1 text-slate-300 dark:text-slate-600"
          width={8}
          height={8}
        >
          <line x1="0" y1="8" x2="8" y2="0" stroke="currentColor" strokeWidth="1.5" />
          <line x1="4" y1="8" x2="8" y2="4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
