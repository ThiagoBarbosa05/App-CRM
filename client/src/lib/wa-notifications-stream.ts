// Stream SSE de notificações do WhatsApp COMPARTILHADO.
//
// O endpoint `/api/whatsapp/notifications/stream` era aberto em vários lugares
// ao mesmo tempo — o hook global de notificações, a página de conversas e CADA
// `EvolutionChannelConnect` (um por linha de canal). Navegadores limitam ~6
// conexões SSE por domínio em HTTP/1.1; com alguns canais QR abertos, esse
// teto estourava e o realtime (novas mensagens, QR/status de conexão) travava
// silenciosamente.
//
// Este módulo mantém UMA única EventSource, com contagem de assinantes: abre na
// primeira assinatura e fecha quando a última é cancelada. Cada consumidor
// assina por nome de evento, exatamente como fazia com `addEventListener`.

type Handler = (event: MessageEvent) => void;

const STREAM_URL = "/api/whatsapp/notifications/stream";

let source: EventSource | null = null;
const listeners = new Map<string, Set<Handler>>();

function openAndAttachAll(): void {
  const es = new EventSource(STREAM_URL);
  source = es;
  listeners.forEach((handlers, eventName) => {
    handlers.forEach((handler) => {
      es.addEventListener(eventName, handler as EventListener);
    });
  });
}

function closeIfIdle(): void {
  let total = 0;
  listeners.forEach((handlers) => {
    total += handlers.size;
  });
  if (total === 0 && source) {
    source.close();
    source = null;
  }
}

/**
 * Assina um evento nomeado do stream compartilhado. Retorna uma função de
 * cancelamento (para usar direto no cleanup de um `useEffect`). A conexão é
 * aberta sob demanda e fechada quando não há mais assinantes.
 */
export function subscribeWaNotifications(eventName: string, handler: Handler): () => void {
  let handlers = listeners.get(eventName);
  if (!handlers) {
    handlers = new Set();
    listeners.set(eventName, handlers);
  }
  handlers.add(handler);

  if (!source) {
    openAndAttachAll();
  } else {
    source.addEventListener(eventName, handler as EventListener);
  }

  return () => {
    const set = listeners.get(eventName);
    if (set) {
      set.delete(handler);
      if (set.size === 0) listeners.delete(eventName);
    }
    source?.removeEventListener(eventName, handler as EventListener);
    closeIfIdle();
  };
}
