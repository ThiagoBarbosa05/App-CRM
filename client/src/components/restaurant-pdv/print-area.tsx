import { type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PrintAreaProps {
  id: string;
  children: ReactNode;
}

/**
 * Dispara a impressão de UMA área específica.
 *
 * A marcação vai no `body` em vez de a regra ser global porque duas áreas na
 * mesma página se anulavam: a regra de cada uma escondia a outra por
 * especificidade maior, e a impressão saía em branco. A classe é aplicada e
 * removida de forma síncrona, sem depender de re-render do React.
 */
export function printArea(id: string): void {
  const className = `printing-${id}`;
  document.body.classList.add(className);
  try {
    window.print();
  } finally {
    document.body.classList.remove(className);
  }
}

export function PrintArea({ id, children }: PrintAreaProps) {
  return createPortal(
    <>
      <style>{`
        @media screen {
          #${id} { display: none; }
        }
        @media print {
          body.printing-${id} > *:not(#${id}) { display: none !important; }
          body.printing-${id} #${id} {
            display: block !important;
            padding: 24px;
            font-family: monospace;
            color: #000;
            background: #fff;
          }
          /* Sem a marcação no body, a área nunca é impressa. */
          body:not(.printing-${id}) #${id} { display: none !important; }
        }
      `}</style>
      <div id={id}>{children}</div>
    </>,
    document.body,
  );
}
