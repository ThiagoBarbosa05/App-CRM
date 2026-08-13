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

import { subscribePageActive } from "./page-active";

type Handler = (event: MessageEvent) => void;

const STREAM_URL = "/api/whatsapp/notifications/stream";

let source: EventSource | null = null;
const listeners = new Map<string, Set<Handler>>();

function hasSubscribers(): boolean {
  let total = 0;
  listeners.forEach((handlers) => {
    total += handlers.size;
  });
  return total > 0;
}

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
  if (!hasSubscribers() && source) {
    source.close();
    source = null;
  }
}

// Uma EventSource aberta é uma requisição em voo permanente: enquanto ela
// existe, o Autoscale não consegue desligar a instância. Numa aba em segundo
// plano isso é custo puro, então o stream é fechado e reaberto na volta.
subscribePageActive((active) => {
  if (!active) {
    source?.close();
    source = null;
    return;
  }
  if (!source && hasSubscribers()) {
    // Os eventos ocorridos com o stream fechado se perderam — o servidor não
    // guarda backlog. A revalidação do cache é feita uma vez só, de forma
    // centralizada, em MainLayout (ver useRevalidateOnPageActive).
    openAndAttachAll();
  }
});

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
    // `isPageActive()` não é checado aqui de propósito: assinar já significa
    // que um componente montou, e componente montando com a aba oculta é caso
    // de borda que a própria transição de volta resolve.
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
