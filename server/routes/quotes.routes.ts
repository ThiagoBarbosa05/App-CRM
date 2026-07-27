import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { db } from "../db";
import { quotes, quoteItems } from "@shared/schema";
import { storage } from "../storage";
import { sendTextMessage } from "../integrations/whatsapp";

export const quotesRouter = Router();

// ─── State machine ─────────────────────────────────────────────────────────────

/**
 * Allowed transitions from each status.
 * Anything not listed is forbidden server-side.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:     ["sent", "cancelled"],
  sent:      ["accepted", "rejected", "cancelled"],
  accepted:  ["converted", "cancelled"],
  rejected:  ["cancelled"],
  converted: [],     // terminal — immutable
  cancelled: [],     // terminal — immutable
};

function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

// ─── Authorization ─────────────────────────────────────────────────────────────

function canAccessQuote(
  req: import("express").Request,
  quote: { assignedToId: string | null; createdById: string | null },
): boolean {
  const role = req.user?.role;
  if (role === "admin" || role === "gerente") return true;
  const userId = req.user?.userId;
  return quote.assignedToId === userId || quote.createdById === userId;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeLineTotal(qty: number, price: number, disc: number, discType: string): number {
  const base = qty * price;
  const discAmt = discType === "percent" ? base * (disc / 100) : disc;
  return Math.max(0, base - discAmt);
}

function computeTotals(lineTotals: number[], globalDiscount: number, globalDiscountType: string) {
  const subtotal = lineTotals.reduce((s, v) => s + v, 0);
  const discAmt =
    globalDiscountType === "percent"
      ? subtotal * (globalDiscount / 100)
      : globalDiscount;
  const total = Math.max(0, subtotal - discAmt);
  return { subtotal: subtotal.toFixed(2), total: total.toFixed(2) };
}

function buildItemRows(rawItems: any[], quoteId: string) {
  return (rawItems || []).map((item: any, idx: number) => {
    const qty = parseFloat(item.quantity ?? "1") || 1;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    const disc = parseFloat(item.discount ?? "0") || 0;
    const discType = item.discountType === "fixed" ? "fixed" : "percent";
    return {
      quoteId,
      productId: item.productId ?? null,
      productName: item.productName ?? "",
      quantity: String(qty),
      unitPrice: String(price),
      discount: String(disc),
      discountType: discType as "percent" | "fixed",
      lineTotal: String(computeLineTotal(qty, price, disc, discType)),
      sortOrder: idx,
    };
  });
}

// ─── GET / ─────────────────────────────────────────────────────────────────────

quotesRouter.get("/", async (req, res) => {
  try {
    const { status, clientId } = req.query;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const conditions: ReturnType<typeof eq>[] = [];

    if (role === "vendedor") {
      conditions.push(eq(quotes.assignedToId, userId));
    }

    if (status && status !== "all" && status !== "expired") {
      conditions.push(eq(quotes.status, status as string));
    }

    if (clientId && typeof clientId === "string") {
      conditions.push(eq(quotes.clientId, clientId));
    }

    const rows = await db
      .select()
      .from(quotes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quotes.createdAt));

    return res.json(rows);
  } catch (err) {
    console.error("Error fetching quotes:", err);
    return res.status(500).json({ message: "Erro ao buscar orçamentos" });
  }
});

// ─── POST / ────────────────────────────────────────────────────────────────────

quotesRouter.post("/", async (req, res) => {
  try {
    const {
      clientId, clientName, clientPhone, validUntil,
      paymentConditions, notes, globalDiscount, globalDiscountType, items,
    } = req.body;

    const userId = req.user!.userId;
    const gDisc = parseFloat(globalDiscount ?? "0") || 0;
    const gDiscType = globalDiscountType === "fixed" ? "fixed" : "percent";

    const [quote] = await db.insert(quotes).values({
      clientId: clientId ?? null,
      clientName: clientName ?? null,
      clientPhone: clientPhone ?? null,
      assignedToId: userId,
      validUntil: validUntil ?? null,
      paymentConditions: paymentConditions ?? "avista",
      notes: notes ?? null,
      globalDiscount: String(gDisc),
      globalDiscountType: gDiscType,
      subtotal: "0",
      total: "0",
      createdById: userId,
    }).returning();

    let subtotal = "0", total = "0";

    if (items?.length > 0) {
      const itemRows = buildItemRows(items, quote.id);
      await db.insert(quoteItems).values(itemRows);
      const lineTotals = itemRows.map((r) => parseFloat(r.lineTotal));
      ({ subtotal, total } = computeTotals(lineTotals, gDisc, gDiscType));
      await db.update(quotes).set({ subtotal, total, updatedAt: new Date() }).where(eq(quotes.id, quote.id));
    }

    return res.status(201).json({ ...quote, subtotal, total, items: [] });
  } catch (err) {
    console.error("Error creating quote:", err);
    return res.status(500).json({ message: "Erro ao criar orçamento" });
  }
});

// ─── GET /:id ──────────────────────────────────────────────────────────────────

quotesRouter.get("/:id", async (req, res) => {
  try {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
    if (!quote) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, quote)) return res.status(403).json({ message: "Sem permissão para acessar este orçamento" });

    const items = await db
      .select().from(quoteItems)
      .where(eq(quoteItems.quoteId, quote.id))
      .orderBy(quoteItems.sortOrder);

    return res.json({ ...quote, items });
  } catch (err) {
    console.error("Error fetching quote:", err);
    return res.status(500).json({ message: "Erro ao buscar orçamento" });
  }
});

// ─── PUT /:id ──────────────────────────────────────────────────────────────────

quotesRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(quotes).where(eq(quotes.id, id));
    if (!existing) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, existing)) return res.status(403).json({ message: "Sem permissão para editar este orçamento" });
    if (existing.status === "converted" || existing.status === "cancelled") {
      return res.status(400).json({ message: "Orçamento finalizado não pode ser editado" });
    }

    const {
      clientId, clientName, clientPhone, validUntil,
      paymentConditions, notes, globalDiscount, globalDiscountType, items,
    } = req.body;

    const gDisc = parseFloat(globalDiscount ?? "0") || 0;
    const gDiscType = globalDiscountType === "fixed" ? "fixed" : "percent";

    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));

    let subtotal = "0", total = "0";
    let savedItems: typeof quoteItems.$inferSelect[] = [];

    if (items?.length > 0) {
      const itemRows = buildItemRows(items, id);
      await db.insert(quoteItems).values(itemRows);
      const lineTotals = itemRows.map((r) => parseFloat(r.lineTotal));
      ({ subtotal, total } = computeTotals(lineTotals, gDisc, gDiscType));
    }

    const [updated] = await db.update(quotes).set({
      clientId: clientId ?? null,
      clientName: clientName ?? null,
      clientPhone: clientPhone ?? null,
      validUntil: validUntil ?? null,
      paymentConditions: paymentConditions ?? "avista",
      notes: notes ?? null,
      globalDiscount: String(gDisc),
      globalDiscountType: gDiscType,
      subtotal,
      total,
      updatedAt: new Date(),
    }).where(eq(quotes.id, id)).returning();

    savedItems = await db
      .select().from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(quoteItems.sortOrder);

    return res.json({ ...updated, items: savedItems });
  } catch (err) {
    console.error("Error updating quote:", err);
    return res.status(500).json({ message: "Erro ao atualizar orçamento" });
  }
});

// ─── DELETE /:id ───────────────────────────────────────────────────────────────

quotesRouter.delete("/:id", async (req, res) => {
  try {
    const [existing] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, existing)) return res.status(403).json({ message: "Sem permissão para cancelar este orçamento" });
    if (!canTransition(existing.status, "cancelled")) {
      return res.status(400).json({ message: `Orçamento ${existing.status} não pode ser cancelado` });
    }

    await db.update(quotes).set({ status: "cancelled", updatedAt: new Date() }).where(eq(quotes.id, req.params.id));
    return res.json({ message: "Orçamento cancelado" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao cancelar orçamento" });
  }
});

// ─── POST /:id/send ────────────────────────────────────────────────────────────

quotesRouter.post("/:id/send", async (req, res) => {
  try {
    const [existing] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, existing)) return res.status(403).json({ message: "Sem permissão" });
    if (!canTransition(existing.status, "sent")) {
      return res.status(400).json({ message: `Não é possível marcar como enviado um orçamento com status "${existing.status}"` });
    }

    const [updated] = await db.update(quotes)
      .set({ status: "sent", updatedAt: new Date() })
      .where(eq(quotes.id, req.params.id))
      .returning();
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao marcar como enviado" });
  }
});

// ─── POST /:id/accept ──────────────────────────────────────────────────────────

quotesRouter.post("/:id/accept", async (req, res) => {
  try {
    const [existing] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, existing)) return res.status(403).json({ message: "Sem permissão" });
    if (!canTransition(existing.status, "accepted")) {
      return res.status(400).json({ message: `Não é possível aceitar um orçamento com status "${existing.status}"` });
    }

    const [updated] = await db.update(quotes)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(quotes.id, req.params.id))
      .returning();
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao aceitar orçamento" });
  }
});

// ─── POST /:id/reject ──────────────────────────────────────────────────────────

quotesRouter.post("/:id/reject", async (req, res) => {
  try {
    const [existing] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, existing)) return res.status(403).json({ message: "Sem permissão" });
    if (!canTransition(existing.status, "rejected")) {
      return res.status(400).json({ message: `Não é possível recusar um orçamento com status "${existing.status}"` });
    }

    const [updated] = await db.update(quotes)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(quotes.id, req.params.id))
      .returning();
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao recusar orçamento" });
  }
});

// ─── POST /:id/convert ─────────────────────────────────────────────────────────

quotesRouter.post("/:id/convert", async (req, res) => {
  try {
    const { id } = req.params;
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    if (!quote) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, quote)) return res.status(403).json({ message: "Sem permissão" });
    if (!canTransition(quote.status, "converted")) {
      return res.status(400).json({ message: `Apenas orçamentos aceitos podem ser convertidos em venda (status atual: "${quote.status}")` });
    }
    if (!quote.clientId) {
      return res.status(400).json({ message: "Orçamento sem cliente vinculado — vincule um cliente antes de converter" });
    }

    const grossValue = parseFloat(quote.total);

    // Fetch cashback settings and client balance (same logic as createSaleController)
    const [clientBalance, settings] = await Promise.all([
      storage.getClientCashbackBalance(quote.clientId),
      storage.getCashbackSettings(),
    ]);

    const currentBalance = clientBalance ? parseFloat((clientBalance as any).currentBalance) : 0;
    const activeSetting = settings.find((s: any) => s.isActive === "true");

    // Convert with useCashback = false to preserve explicit pricing from quote
    const cashbackUsed = 0;
    const netValue = grossValue;
    let cashbackGenerated = 0;
    if (activeSetting) {
      const minimumPurchase = parseFloat((activeSetting as any).minimumPurchase || "0");
      if (netValue >= minimumPurchase) {
        const rate = parseFloat((activeSetting as any).percentageRate) / 100;
        cashbackGenerated = netValue * rate;
        if ((activeSetting as any).maximumCashback) {
          cashbackGenerated = Math.min(cashbackGenerated, parseFloat((activeSetting as any).maximumCashback));
        }
      }
    }

    const sale = await storage.createSale({
      clientId: quote.clientId,
      date: new Date().toISOString().slice(0, 10),
      grossValue,
      cashbackUsed,
      netValue,
      cashbackGenerated,
      notes: `Convertido do orçamento ${quote.quoteNumber}`,
      invoiceNumber: undefined,
      userId: req.user!.userId,
      useCashback: false,
    });

    const [updated] = await db.update(quotes)
      .set({ status: "converted", convertedSaleId: (sale as any).id, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();

    return res.json({ quote: updated, sale });
  } catch (err) {
    console.error("Error converting quote:", err);
    return res.status(500).json({ message: "Erro ao converter em venda" });
  }
});

// ─── POST /:id/whatsapp ────────────────────────────────────────────────────────

quotesRouter.post("/:id/whatsapp", async (req, res) => {
  try {
    const { id } = req.params;
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    if (!quote) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, quote)) return res.status(403).json({ message: "Sem permissão" });

    const phone = quote.clientPhone;
    if (!phone) return res.status(400).json({ message: "Cliente sem telefone cadastrado" });

    const items = await db
      .select().from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(quoteItems.sortOrder);

    const validStr = quote.validUntil
      ? new Date(quote.validUntil + "T12:00:00").toLocaleDateString("pt-BR")
      : "—";

    const paymentMap: Record<string, string> = {
      avista: "À Vista", "30d": "30 dias", "60d": "60 dias",
      "30-60d": "30/60 dias", "30-60-90d": "30/60/90 dias",
    };

    const fmtBRL = (v: number) =>
      v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemsList = items
      .map((item) => `• ${item.productName} × ${parseFloat(item.quantity)} — R$ ${fmtBRL(parseFloat(item.lineTotal))}`)
      .join("\n");

    const gDiscLine = parseFloat(quote.globalDiscount) > 0
      ? `*Desconto global:* ${quote.globalDiscountType === "percent" ? quote.globalDiscount + "%" : "R$ " + fmtBRL(parseFloat(quote.globalDiscount))}\n`
      : "";

    const message = [
      `*${quote.quoteNumber}*`,
      ``,
      `Olá${quote.clientName ? ", " + quote.clientName : ""}! Segue seu orçamento:`,
      ``,
      itemsList || "—",
      ``,
      `*Subtotal:* R$ ${fmtBRL(parseFloat(quote.subtotal))}`,
      gDiscLine.trim() || null,
      `*Total: R$ ${fmtBRL(parseFloat(quote.total))}*`,
      ``,
      `*Condições:* ${paymentMap[quote.paymentConditions] ?? quote.paymentConditions}`,
      `*Válido até:* ${validStr}`,
      quote.notes ? `\n*Obs:* ${quote.notes}` : null,
    ].filter((l) => l !== null).join("\n");

    // Send directly via integration (no HTTP — avoids host-header injection)
    await sendTextMessage(phone, message);

    // Auto-advance to "sent" only if currently draft (state machine check)
    let updatedQuote = quote;
    if (canTransition(quote.status, "sent")) {
      const [u] = await db.update(quotes)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();
      updatedQuote = u;
    }

    return res.json({ message: "Mensagem enviada com sucesso", quote: updatedQuote });
  } catch (err) {
    console.error("Error sending WhatsApp:", err);
    return res.status(500).json({ message: "Erro ao enviar WhatsApp" });
  }
});

// ─── GET /:id/pdf ──────────────────────────────────────────────────────────────

quotesRouter.get("/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    if (!quote) return res.status(404).json({ message: "Orçamento não encontrado" });
    if (!canAccessQuote(req, quote)) return res.status(403).json({ message: "Sem permissão para acessar este orçamento" });

    const items = await db
      .select().from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(quoteItems.sortOrder);

    const paymentMap: Record<string, string> = {
      avista: "À Vista", "30d": "30 dias", "60d": "60 dias",
      "30-60d": "30/60 dias", "30-60-90d": "30/60/90 dias",
    };

    const fmtBRL = (v: number) =>
      "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const validStr = quote.validUntil
      ? new Date(quote.validUntil + "T12:00:00").toLocaleDateString("pt-BR")
      : "—";

    // ── Color palette ──────────────────────────────────────────────────────────
    const WINE   = "#7B1D1D";   // deep wine red — brand primary
    const GOLD   = "#B8860B";   // dark gold accent
    const LIGHT  = "#FDF8F5";   // warm off-white background band
    const DARK   = "#1C1C1E";   // near-black text
    const MID    = "#6B6B6B";   // secondary text
    const BORDER = "#E8DDD5";   // warm border

    // ── Document setup ─────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${quote.quoteNumber}.pdf"`,
    );
    doc.pipe(res);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MARGIN = 48;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ── Header band ────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 110).fill(WINE);

    // Logo — try to embed from public folder
    const logoPath = path.join(process.cwd(), "client", "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      // Logo is wide (1424×288), render at ~160×32 keeping aspect
      doc.image(logoPath, MARGIN, 35, { width: 160, height: 32 });
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#FFFFFF")
        .text("Grand Cru", MARGIN, 40);
    }

    // Right side of header: ORÇAMENTO label + number
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("rgba(255,255,255,0.7)")
      .text("ORÇAMENTO", 0, 32, { align: "right", width: PAGE_W - MARGIN });
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#FFFFFF")
      .text(quote.quoteNumber, 0, 44, { align: "right", width: PAGE_W - MARGIN });

    // Status badge
    const statusLabels: Record<string, string> = {
      draft: "RASCUNHO", sent: "ENVIADO", accepted: "ACEITO",
      rejected: "RECUSADO", converted: "CONVERTIDO", cancelled: "CANCELADO",
    };
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("rgba(255,255,255,0.75)")
      .text(statusLabels[quote.status] ?? quote.status.toUpperCase(), 0, 74, {
        align: "right", width: PAGE_W - MARGIN,
      });

    // ── Gold accent line under header ──────────────────────────────────────────
    doc.rect(0, 110, PAGE_W, 3).fill(GOLD);

    let y = 130;

    // ── Info cards row (Client | Validity | Payment) ───────────────────────────
    const CARD_H = 72;
    const CARD_W = (CONTENT_W - 16) / 3;

    const drawCard = (x: number, label: string, value: string, sub?: string) => {
      doc.rect(x, y, CARD_W, CARD_H).fill(LIGHT).stroke(BORDER);
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(WINE)
        .text(label.toUpperCase(), x + 12, y + 10, { width: CARD_W - 24 });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(DARK)
        .text(value || "—", x + 12, y + 24, { width: CARD_W - 24 });
      if (sub) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(MID)
          .text(sub, x + 12, y + 42, { width: CARD_W - 24 });
      }
    };

    drawCard(MARGIN,                 "Cliente",    quote.clientName ?? "—", quote.clientPhone ?? undefined);
    drawCard(MARGIN + CARD_W + 8,    "Válido até", validStr);
    drawCard(MARGIN + (CARD_W + 8) * 2, "Pagamento", paymentMap[quote.paymentConditions] ?? quote.paymentConditions);

    y += CARD_H + 24;

    // ── Section title: Items ───────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(WINE)
      .text("ITENS DO ORÇAMENTO", MARGIN, y);
    y += 16;

    // ── Table header ───────────────────────────────────────────────────────────
    const COL = {
      produto:  { x: MARGIN,       w: 200 },
      qtd:      { x: MARGIN + 200, w:  55 },
      unitario: { x: MARGIN + 255, w:  85 },
      desconto: { x: MARGIN + 340, w:  85 },
      total:    { x: MARGIN + 425, w:  CONTENT_W - 425 },
    };

    doc.rect(MARGIN, y, CONTENT_W, 20).fill(WINE);
    const headers: [keyof typeof COL, string][] = [
      ["produto",  "Produto"],
      ["qtd",      "Qtd"],
      ["unitario", "Preço Unit."],
      ["desconto", "Desconto"],
      ["total",    "Total"],
    ];
    for (const [key, label] of headers) {
      const col = COL[key];
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#FFFFFF")
        .text(label, col.x + 6, y + 6, { width: col.w - 8, align: key === "total" ? "right" : "left" });
    }
    y += 20;

    // ── Table rows ─────────────────────────────────────────────────────────────
    items.forEach((item, idx) => {
      const rowH = 22;
      // Alternate row fill
      if (idx % 2 === 0) {
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill("#FFFFFF");
      } else {
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(LIGHT);
      }
      // Bottom border
      doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + CONTENT_W, y + rowH).strokeColor(BORDER).lineWidth(0.5).stroke();

      const qty  = parseFloat(item.quantity);
      const price = parseFloat(item.unitPrice);
      const disc  = parseFloat(item.discount);
      const lt    = parseFloat(item.lineTotal);
      const discLabel = item.discountType === "percent"
        ? (disc > 0 ? disc + "%" : "—")
        : (disc > 0 ? fmtBRL(disc) : "—");

      const textY = y + 7;
      doc.font("Helvetica").fontSize(8.5).fillColor(DARK);
      doc.text(item.productName || "—",    COL.produto.x  + 6, textY, { width: COL.produto.w  - 8 });
      doc.text(String(qty),                COL.qtd.x      + 6, textY, { width: COL.qtd.w      - 8 });
      doc.text(fmtBRL(price),              COL.unitario.x + 6, textY, { width: COL.unitario.w - 8 });
      doc.text(discLabel,                  COL.desconto.x + 6, textY, { width: COL.desconto.w - 8 });
      doc
        .font("Helvetica-Bold")
        .text(fmtBRL(lt), COL.total.x + 6, textY, { width: COL.total.w - 12, align: "right" });

      y += rowH;
    });

    if (items.length === 0) {
      doc.rect(MARGIN, y, CONTENT_W, 24).fill(LIGHT);
      doc.font("Helvetica").fontSize(9).fillColor(MID)
        .text("Nenhum item adicionado.", MARGIN + 12, y + 8, { width: CONTENT_W - 24 });
      y += 24;
    }

    y += 16;

    // ── Totals box ─────────────────────────────────────────────────────────────
    const TOTALS_W = 220;
    const TOTALS_X = PAGE_W - MARGIN - TOTALS_W;

    const subtotal     = parseFloat(quote.subtotal);
    const globalDisc   = parseFloat(quote.globalDiscount);
    const total        = parseFloat(quote.total);
    const discAmt      = subtotal - total;

    const drawTotalRow = (label: string, value: string, bold = false, color = DARK) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 10 : 9)
        .fillColor(MID)
        .text(label, TOTALS_X, y, { width: 110 });
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 10 : 9)
        .fillColor(color)
        .text(value, TOTALS_X + 110, y, { width: TOTALS_W - 110, align: "right" });
      y += bold ? 18 : 16;
    };

    drawTotalRow("Subtotal", fmtBRL(subtotal));

    if (globalDisc > 0) {
      const discLabel = quote.globalDiscountType === "percent"
        ? `Desconto (${globalDisc}%)`
        : "Desconto";
      drawTotalRow(discLabel, "- " + fmtBRL(discAmt), false, "#DC2626");
    }

    // Total row with wine background
    const TOTAL_ROW_H = 28;
    doc.rect(TOTALS_X - 12, y - 4, TOTALS_W + 12, TOTAL_ROW_H).fill(WINE);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#FFFFFF")
      .text("TOTAL", TOTALS_X, y + 6, { width: 100 });
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#FFFFFF")
      .text(fmtBRL(total), TOTALS_X, y + 4, { width: TOTALS_W - 12, align: "right" });

    y += TOTAL_ROW_H + 24;

    // ── Notes ──────────────────────────────────────────────────────────────────
    if (quote.notes) {
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(WINE)
        .text("OBSERVAÇÕES", MARGIN, y);
      y += 14;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(DARK)
        .text(quote.notes, MARGIN, y, { width: CONTENT_W });
      y += doc.heightOfString(quote.notes, { width: CONTENT_W }) + 16;
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    const FOOTER_Y = PAGE_H - 48;
    doc.rect(0, FOOTER_Y - 4, PAGE_W, 52).fill(LIGHT);
    doc.moveTo(0, FOOTER_Y - 4).lineTo(PAGE_W, FOOTER_Y - 4).strokeColor(BORDER).lineWidth(1).stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MID)
      .text(
        `Grand Cru  •  Orçamento emitido em ${new Date().toLocaleDateString("pt-BR")}  •  Válido até ${validStr}`,
        0, FOOTER_Y + 8,
        { align: "center", width: PAGE_W },
      );
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(BORDER)
      .text(quote.quoteNumber, 0, FOOTER_Y + 24, { align: "center", width: PAGE_W });

    doc.end();
  } catch (err) {
    console.error("Error generating PDF:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Erro ao gerar PDF do orçamento" });
    }
  }
});
