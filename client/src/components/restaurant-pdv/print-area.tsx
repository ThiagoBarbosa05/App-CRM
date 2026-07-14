import { type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PrintAreaProps {
  id: string;
  children: ReactNode;
}

export function PrintArea({ id, children }: PrintAreaProps) {
  return createPortal(
    <>
      <style>{`
        @media screen {
          #${id} { display: none; }
        }
        @media print {
          body > *:not(#${id}) { display: none !important; }
          #${id} {
            display: block !important;
            padding: 24px;
            font-family: monospace;
            color: #000;
            background: #fff;
          }
        }
      `}</style>
      <div id={id}>{children}</div>
    </>,
    document.body,
  );
}
