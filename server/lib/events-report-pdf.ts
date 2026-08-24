/**
 * Relatório de eventos em PDF (A4 paisagem).
 *
 * A paisagem não é preferência estética: são 11 colunas, e em retrato o nome do
 * evento e o local viram duas letras cada. A paleta acompanha o PDF de
 * orçamento (`server/routes/quotes.routes.ts`) para os dois documentos saírem
 * com a mesma cara.
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Writable } from "stream";
import type { EventsReportData, EventsReportRow } from "../services/events-report.service";

const WINE = "#7B1D1D";
const GOLD = "#B8860B";
const LIGHT = "#FDF8F5";
const DARK = "#1C1C1E";
const MID = "#6B6B6B";
const BORDER = "#E8DDD5";
const ZEBRA = "#F7F2EE";

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 32;
const CONTENT_W = PAGE_W - MARGIN * 2;

const HEADER_H = 74;
const TABLE_HEADER_H = 22;
const ROW_H = 20;
/** Onde a tabela pode ir até: acima disso mora o rodapé. */
const TABLE_BOTTOM = PAGE_H - 46;

interface Column {
  key: string;
  label: string;
  width: number;
  align: "left" | "right" | "center";
  value: (row: EventsReportRow) => string;
}

const fmtBRL = (v: number) =>
  "R$ " +
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function buildColumns(): Column[] {
  const spec: Array<[string, string, number, Column["align"], Column["value"]]> = [
    ["date", "Data", 62, "left", (r) => fmtDate(r.date)],
    ["time", "Hora", 34, "left", (r) => r.time],
    ["name", "Evento", 146, "left", (r) => r.name],
    ["location", "Local", 116, "left", (r) => r.location],
    ["category", "Categoria", 70, "left", (r) => r.category],
    ["status", "Status", 62, "left", (r) => r.statusLabel],
    ["participants", "Pessoas", 46, "right", (r) => String(r.participantCount)],
    ["attended", "Presentes", 52, "right", (r) => String(r.attendedCount)],
    [
      "occupancy",
      "Ocup.",
      40,
      "right",
      (r) => (r.occupancyPct === null ? "—" : `${r.occupancyPct}%`),
    ],
    ["eventRevenue", "Receita Evento", 78, "right", (r) => fmtBRL(r.eventRevenue)],
    ["wineRevenue", "Vinhos", 68, "right", (r) => fmtBRL(r.wineRevenue)],
    ["total", "Total", 78, "right", (r) => fmtBRL(r.totalRevenue)],
  ];
  return spec.map(([key, label, width, align, value]) => ({
    key,
    label,
    width,
    align,
    value,
  }));
}

/**
 * Escreve o relatório no `stream` (normalmente o `res` do Express).
 *
 * `generatedAt` entra por parâmetro para o documento ser determinístico em teste.
 */
export function buildEventsReportPdf(
  data: EventsReportData,
  stream: Writable,
  generatedAt: Date = new Date(),
): void {
  const columns = buildColumns();
  const tableW = columns.reduce((s, c) => s + c.width, 0);
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    bufferPages: true,
  });
  doc.pipe(stream);

  const periodLabel = `${fmtDate(data.from)} a ${fmtDate(data.to)}`;
  const generatedLabel = generatedAt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const drawPageHeader = () => {
    doc.rect(0, 0, PAGE_W, HEADER_H).fill(WINE);

    const logoPath = path.join(process.cwd(), "client", "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      doc.roundedRect(MARGIN - 6, 18, 152, 40, 6).fill("#FFFFFF");
      doc.image(logoPath, MARGIN + 2, 26, { width: 134, height: 26 });
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#FFFFFF")
        .text("Grand Cru", MARGIN, 28);
    }

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#E6CFCF")
      .text("RELATÓRIO DE EVENTOS", 0, 22, {
        align: "right",
        width: PAGE_W - MARGIN,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#FFFFFF")
      .text(periodLabel, 0, 34, { align: "right", width: PAGE_W - MARGIN });

    doc.rect(0, HEADER_H, PAGE_W, 3).fill(GOLD);
  };

  const drawSummary = (startY: number): number => {
    const cards: Array<[string, string]> = [
      ["EVENTOS", String(data.totals.eventCount)],
      ["PARTICIPANTES", `${data.totals.participantCount} pessoas`],
      ["PRESENTES", `${data.totals.attendedCount} pessoas`],
      [
        "OCUPAÇÃO MÉDIA",
        data.totals.avgOccupancyPct === null
          ? "—"
          : `${data.totals.avgOccupancyPct}%`,
      ],
      ["RECEITA EVENTOS", fmtBRL(data.totals.eventRevenue)],
      ["VENDA DE VINHOS", fmtBRL(data.totals.wineRevenue)],
      ["RECEITA TOTAL", fmtBRL(data.totals.totalRevenue)],
    ];

    const gap = 8;
    const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
    const cardH = 46;

    cards.forEach(([label, value], i) => {
      const x = MARGIN + i * (cardW + gap);
      const isTotal = label === "RECEITA TOTAL";
      doc
        .rect(x, startY, cardW, cardH)
        .fillAndStroke(isTotal ? "#F3E4E4" : LIGHT, BORDER);
      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor(WINE)
        .text(label, x + 7, startY + 9, { width: cardW - 14 });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(isTotal ? WINE : DARK)
        .text(value, x + 7, startY + 24, {
          width: cardW - 14,
          lineBreak: false,
        });
    });

    return startY + cardH;
  };

  const drawTableHeader = (y: number): number => {
    doc.rect(MARGIN, y, tableW, TABLE_HEADER_H).fill(WINE);
    let x = MARGIN;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF");
    for (const col of columns) {
      doc.text(col.label, x + 5, y + 7, {
        width: col.width - 10,
        align: col.align,
        lineBreak: false,
      });
      x += col.width;
    }
    return y + TABLE_HEADER_H;
  };

  drawPageHeader();
  let y = drawSummary(HEADER_H + 16) + 16;
  y = drawTableHeader(y);

  if (data.events.length === 0) {
    doc
      .rect(MARGIN, y, tableW, 40)
      .fillAndStroke("#FFFFFF", BORDER);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MID)
      .text("Nenhum evento encontrado no período selecionado.", MARGIN, y + 15, {
        width: tableW,
        align: "center",
      });
    y += 40;
  }

  data.events.forEach((row, index) => {
    if (y + ROW_H > TABLE_BOTTOM) {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      drawPageHeader();
      y = drawTableHeader(HEADER_H + 16);
    }

    const cancelled = row.status === "cancelado";
    if (index % 2 === 1) doc.rect(MARGIN, y, tableW, ROW_H).fill(ZEBRA);

    let x = MARGIN;
    doc.font("Helvetica").fontSize(7.5);
    for (const col of columns) {
      const isMoney = col.key.toLowerCase().includes("revenue") || col.key === "total";
      doc
        .font(col.key === "total" ? "Helvetica-Bold" : "Helvetica")
        .fillColor(cancelled ? "#A0A0A0" : isMoney ? DARK : MID)
        .text(col.value(row), x + 5, y + 6.5, {
          width: col.width - 10,
          align: col.align,
          ellipsis: true,
          lineBreak: false,
        });
      x += col.width;
    }

    doc
      .moveTo(MARGIN, y + ROW_H)
      .lineTo(MARGIN + tableW, y + ROW_H)
      .lineWidth(0.5)
      .stroke(BORDER);
    y += ROW_H;
  });

  // ── Linha de totais ────────────────────────────────────────────────────────
  if (data.events.length > 0) {
    if (y + ROW_H + 4 > TABLE_BOTTOM) {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      drawPageHeader();
      y = HEADER_H + 16;
    }
    const totalsRowH = 22;
    doc.rect(MARGIN, y, tableW, totalsRowH).fill("#F3E4E4");

    const totalValues: Record<string, string> = {
      participants: String(data.totals.participantCount),
      attended: String(data.totals.attendedCount),
      occupancy:
        data.totals.avgOccupancyPct === null
          ? "—"
          : `${data.totals.avgOccupancyPct}%`,
      eventRevenue: fmtBRL(data.totals.eventRevenue),
      wineRevenue: fmtBRL(data.totals.wineRevenue),
      total: fmtBRL(data.totals.totalRevenue),
    };

    let x = MARGIN;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WINE);
    for (const col of columns) {
      const label =
        col.key === "date"
          ? `TOTAL (${data.totals.eventCount} evento${data.totals.eventCount === 1 ? "" : "s"})`
          : (totalValues[col.key] ?? "");
      if (label) {
        doc.text(label, x + 5, y + 7, {
          width: col.key === "date" ? col.width * 3 : col.width - 10,
          align: col.key === "date" ? "left" : col.align,
          lineBreak: false,
        });
      }
      x += col.width;
    }
    y += totalsRowH;

    if (data.totals.cancelledCount > 0) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor(MID)
        .text(
          `${data.totals.cancelledCount} evento${data.totals.cancelledCount === 1 ? "" : "s"} cancelado${data.totals.cancelledCount === 1 ? "" : "s"} no período — listado${data.totals.cancelledCount === 1 ? "" : "s"} em cinza e fora dos totais.`,
          MARGIN,
          y + 6,
          { width: tableW },
        );
    }
  }

  // ── Rodapé em todas as páginas ─────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .moveTo(MARGIN, PAGE_H - 30)
      .lineTo(PAGE_W - MARGIN, PAGE_H - 30)
      .lineWidth(0.5)
      .stroke(BORDER);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(MID)
      .text(`Gerado em ${generatedLabel}`, MARGIN, PAGE_H - 22, {
        width: CONTENT_W / 2,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(MID)
      .text(`Página ${i - range.start + 1} de ${range.count}`, MARGIN, PAGE_H - 22, {
        width: CONTENT_W,
        align: "right",
        lineBreak: false,
      });
  }

  doc.end();
}
