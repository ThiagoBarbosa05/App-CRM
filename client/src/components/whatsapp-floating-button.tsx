import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppNotifications } from "@/hooks/useWhatsAppNotifications.tsx";
import { useWhatsappConversationsBadge, type WhatsappConversationSummary } from "@/hooks/use-whatsapp";
import { cn } from "@/lib/utils";
import { Bell, BellOff } from "lucide-react";

const POSITION_STORAGE_KEY = "whatsapp-floating-button-position";
const BUTTON_SIZE = 56; // h-14 w-14
const EDGE_MARGIN = 24; // equivalente ao right-6/bottom-6 usado como posição default
const DRAG_THRESHOLD_PX = 6;

function clampPosition(x: number, y: number) {
  const maxX = Math.max(window.innerWidth - BUTTON_SIZE, 0);
  const maxY = Math.max(window.innerHeight - BUTTON_SIZE, 0);
  return { x: Math.min(Math.max(x, 0), maxX), y: Math.min(Math.max(y, 0), maxY) };
}

function getDefaultPosition() {
  return clampPosition(
    window.innerWidth - BUTTON_SIZE - EDGE_MARGIN,
    window.innerHeight - BUTTON_SIZE - EDGE_MARGIN,
  );
}

function loadStoredPosition() {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!saved) return getDefaultPosition();
    const parsed = JSON.parse(saved);
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
      return clampPosition(parsed.x, parsed.y);
    }
  } catch {
    // localStorage indisponível ou dado corrompido — usa o canto inferior direito
  }
  return getDefaultPosition();
}

export function WhatsAppFloatingButton() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [pulse, setPulse] = useState(false);
  const clientsRef = useRef<WhatsappConversationSummary[]>([]);

  const [position, setPosition] = useState(loadStoredPosition);
  const draggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 });

  // Mantém o botão visível caso a janela seja redimensionada após um arraste.
  useEffect(() => {
    function handleResize() {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      draggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        originX: position.x,
        originY: position.y,
      };
      // Não captura o ponteiro aqui: um simples tap/clique não deve virar
      // arraste. A captura só acontece em handlePointerMove, quando o
      // movimento de fato ultrapassa o threshold — caso contrário o navegador
      // redireciona o "click" subsequente para o elemento que capturou o
      // ponteiro (este div) em vez do <button> interno, e o clique para de
      // funcionar.
    },
    [position],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const { pointerX, pointerY, originX, originY } = dragStartRef.current;
    const dx = e.clientX - pointerX;
    const dy = e.clientY - pointerY;
    if (!hasDraggedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      hasDraggedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (hasDraggedRef.current) {
      setPosition(clampPosition(originX + dx, originY + dy));
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (hasDraggedRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // pointer já liberado — ignora
      }
      setPosition((prev) => {
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
    }
  }, []);

  const { data: clientList = [] } = useWhatsappConversationsBadge(user?.id);

  clientsRef.current = clientList;

  const totalUnread = clientList.reduce(
    (sum, c) => sum + (c.unreadCount ?? 0),
    0,
  );

  const { soundEnabled, toggleSound: toggleSoundBase } =
    useWhatsAppNotifications(clientsRef, {
      onNewMessage: () => {
        setPulse(true);
        setTimeout(() => setPulse(false), 2000);
      },
    });

  if (!user) return null;

  function toggleSound(e: React.MouseEvent) {
    e.stopPropagation();
    toggleSoundBase();
  }

  function handleButtonClick() {
    // Um arraste real não deve disparar a navegação — apenas um clique/tap parado.
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    navigate("/whatsapp/conversas");
  }

  return (
    <div
      className="fixed z-50 touch-none select-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <button
        onClick={handleButtonClick}
        className={cn(
          "relative h-14 w-14 rounded-full shadow-lg cursor-grab active:cursor-grabbing",
          "bg-[#25D366] hover:bg-[#20ba5a] active:bg-[#1da851]",
          "flex items-center justify-center",
          "transition-transform duration-150 hover:scale-105 active:scale-95",
          pulse && "animate-bounce",
        )}
        aria-label="WhatsApp - ver conversas (arraste para reposicionar)"
      >
        {/* WhatsApp SVG icon */}
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 fill-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>


        {/* Unread badge */}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-red-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[11px] font-bold text-white px-1 shadow-sm">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        title={
          soundEnabled
            ? "Desativar som de notificação"
            : "Ativar som de notificação"
        }
        className={cn(
          "absolute -top-2 -left-2 h-6 w-6 rounded-full shadow",
          "flex items-center justify-center",
          "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
          "transition-opacity hover:opacity-90",
        )}
        aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
      >
        {soundEnabled ? (
          <Bell className="h-3 w-3 text-slate-600 dark:text-slate-300" />
        ) : (
          <BellOff className="h-3 w-3 text-slate-400" />
        )}
      </button>
    </div>
  );
}
