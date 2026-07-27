import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
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
    const { status } = req.query;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const conditions: ReturnType<typeof eq>[] = [];

    if (role === "vendedor") {
      conditions.push(eq(quotes.assignedToId, userId));
    }

    if (status && status !== "all" && status !== "expired") {
      conditions.push(eq(quotes.status, status as string));
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
