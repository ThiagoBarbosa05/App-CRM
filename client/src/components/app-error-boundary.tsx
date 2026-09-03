import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { captureReactError } from "@/lib/sentry";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

interface AppErrorFallbackProps {
  onReload: () => void;
}

export function AppErrorFallback({ onReload }: AppErrorFallbackProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-heading text-xl font-semibold text-slate-900 dark:text-slate-100">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          O aplicativo pode ter sido atualizado. Atualize a página para carregar
          a versão mais recente.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-[#A52A5E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8f2451] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A52A5E] focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Atualizar página
        </button>
      </section>
    </main>
  );
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary] Erro não tratado na interface:", error, info);
    captureReactError(error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <AppErrorFallback onReload={() => window.location.reload()} />;
    }

    return this.props.children;
  }
}
