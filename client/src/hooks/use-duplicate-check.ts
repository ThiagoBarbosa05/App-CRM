import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

/**
 * Aviso de cliente duplicado no formulário de cadastro.
 *
 * Existe porque o mesmo cliente entrava duas vezes — uma vinda do Bling e outra
 * cadastrada pelo vendedor — e nada avisava antes do envio. O endpoint
 * `POST /api/clients/check-duplicate` já fazia a comparação certa (telefone e
 * CPF normalizados, nome por similaridade) mas não era chamado por ninguém.
 */

export interface DuplicateMatch {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  categoria: string;
  responsavelName: string | null;
  createdAt: string;
  matchReasons: string[];
  score: number;
}

interface UseDuplicateCheckParams {
  /** Só consulta com o modal aberto. */
  enabled: boolean;
  name?: string;
  phone?: string;
  cpf?: string;
  email?: string;
  /** Cliente em edição — não deve aparecer como duplicata de si mesmo. */
  excludeId?: string;
}

/** Espera o usuário parar de digitar antes de consultar. */
const DEBOUNCE_MS = 500;

/** Abaixo disso o telefone ainda está sendo digitado e o match seria ruído. */
const MIN_PHONE_DIGITS = 10;
const MIN_CPF_DIGITS = 11;
const MIN_NAME_LENGTH = 4;

export function useDuplicateCheck({
  enabled,
  name,
  phone,
  cpf,
  email,
  excludeId,
}: UseDuplicateCheckParams) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const phoneDigits = (phone ?? "").replace(/\D/g, "");
  const cpfDigits = (cpf ?? "").replace(/\D/g, "");
  const trimmedName = (name ?? "").trim();
  const trimmedEmail = (email ?? "").trim();

  // Só vale consultar quando há pelo menos um campo com conteúdo suficiente
  // para gerar um match confiável.
  const hasPhone = phoneDigits.length >= MIN_PHONE_DIGITS;
  const hasCpf = cpfDigits.length >= MIN_CPF_DIGITS;
  const hasEmail = trimmedEmail.includes("@");
  const hasName = trimmedName.length >= MIN_NAME_LENGTH;
  const shouldCheck = enabled && (hasPhone || hasCpf || hasEmail || hasName);

  useEffect(() => {
    abortRef.current?.abort();

    if (!shouldCheck) {
      setMatches([]);
      setIsChecking(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsChecking(true);

    const timer = setTimeout(async () => {
      try {
        const response = await apiRequest(
          "POST",
          "/api/clients/check-duplicate",
          {
            name: hasName ? trimmedName : undefined,
            phone: hasPhone ? phoneDigits : undefined,
            cpf: hasCpf ? cpfDigits : undefined,
            email: hasEmail ? trimmedEmail : undefined,
            excludeId,
          },
          { signal: controller.signal },
        );
        const data = (await response.json()) as DuplicateMatch[];
        if (!controller.signal.aborted) {
          setMatches(Array.isArray(data) ? data : []);
        }
      } catch {
        // Falha na checagem não pode atrapalhar o cadastro: o aviso é um
        // auxílio, e o servidor ainda barra o telefone duplicado no envio.
        if (!controller.signal.aborted) setMatches([]);
      } finally {
        if (!controller.signal.aborted) setIsChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    shouldCheck,
    phoneDigits,
    cpfDigits,
    trimmedName,
    trimmedEmail,
    excludeId,
    hasPhone,
    hasCpf,
    hasEmail,
    hasName,
  ]);

  /**
   * Match por telefone é bloqueante de fato: o servidor recusa o cadastro.
   * Os demais (CPF, e-mail, nome parecido) são só aviso.
   */
  const blockingMatch =
    matches.find((m) => m.matchReasons.includes("Telefone idêntico")) ?? null;

  return { matches, isChecking, blockingMatch };
}
