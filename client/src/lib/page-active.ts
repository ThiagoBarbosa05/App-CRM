// Estado "a página está sendo usada", com carência.
//
// Motivação é custo: o deploy roda em Autoscale, que cobra enquanto há
// requisição em voo e só desliga a instância quando não há nenhuma. Uma conexão
// SSE é uma requisição que nunca termina — uma aba esquecida em segundo plano
// mantém o servidor aceso indefinidamente, de graça para o usuário e caro para
// o app.
//
// O `refetchInterval` do TanStack Query NÃO precisa disso: ele já pausa sozinho
// quando a aba perde o foco (nenhuma query do projeto usa
// `refetchIntervalInBackground`). Quem precisa é o que o Query não gerencia:
// as conexões SSE e os poucos `setInterval` de fetch escritos à mão.

/** Quanto tempo a aba fica oculta antes de considerarmos a página inativa. */
const IDLE_GRACE_MS = 60_000;

type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let active = true;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function setActive(next: boolean): void {
  if (active === next) return;
  active = next;
  listeners.forEach((listener) => listener(active));
}

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function handleVisibilityChange(): void {
  clearIdleTimer();
  if (document.visibilityState === "visible") {
    // Volta na hora: quem trocou de aba e voltou não pode esperar carência.
    setActive(true);
    return;
  }
  // A carência evita derrubar tudo em troca rápida de aba (Alt+Tab para copiar
  // um dado e voltar), que reconectaria o SSE sem ganho nenhum.
  idleTimer = setTimeout(() => setActive(false), IDLE_GRACE_MS);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  active = document.visibilityState === "visible";
}

export function isPageActive(): boolean {
  return active;
}

/**
 * Assina mudanças de atividade da página. Retorna a função de cancelamento,
 * para usar direto no cleanup de um `useEffect`.
 */
export function subscribePageActive(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
