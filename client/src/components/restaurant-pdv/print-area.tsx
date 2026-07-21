import { type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PrintAreaProps {
  id: string;
  children: ReactNode;
}

/**
 * Dispara a impressão de UMA área específica abrindo uma janela popup.
 * Isso suprime cabeçalho e rodapé padrão do navegador (data, título, URL).
 */
export function printArea(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const popup = window.open("", "_blank", "width=800,height=600");
  if (!popup) {
    // Fallback se popup bloqueado: impressão inline
    const className = `printing-${id}`;
    document.body.classList.add(className);
    try { window.print(); } finally { document.body.classList.remove(className); }
    return;
  }

  popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title></title>
  <style>
    @page { margin: 0; size: auto; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { padding: 12mm 10mm; font-family: monospace; color: #000; }
  </style>
</head>
<body>${el.innerHTML}</body>
</html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    popup.print();
    popup.close();
  }, 250);
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
