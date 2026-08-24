import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  insertEventSchema,
  insertEventParticipantSchema,
} from "@shared/schema";
import { storage } from "../storage";
import { generateSlug } from "../lib/slug";
import { decodeCursor, clampLimit } from "../lib/cursor-pagination";
import { invalidateCachedPage } from "../lib/landing-page-cache";
import { optimizeHtml } from "../lib/html-optimizer";
import { nanoid } from "nanoid";
import { startOfTodayInSaoPaulo } from "@shared/sao-paulo-date";

const LP_PUBLIC_DOMAIN = "https://eventos.grandcrub2b.com";

async function purgeCloudflareCache(slugs: string[]): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !apiToken) return;
  try {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: slugs.map((s) => `${LP_PUBLIC_DOMAIN}/${s}`),
        }),
      },
    );
  } catch (err) {
    console.error("Cloudflare cache purge failed:", err);
  }
}

const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const eventsRouter = Router();

const EVENT_PRICING_TYPES = ["per_person", "total"] as const;
const responsibleContactIdsSchema = z
  .array(z.string().trim().min(1))
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Um responsável não pode ser vinculado mais de uma vez",
  });

function isExternalEvent(category: string | null | undefined): boolean {
  return category?.trim().toUpperCase() === "EXTERNO";
}

function canManageEvent(
  event: { createdBy: string },
  user: { userId: string; role?: string } | undefined,
): boolean {
  if (!user) return false;
  return (
    user.role === "admin" ||
    user.role === "administrador" ||
    event.createdBy === user.userId
  );
}

async function validateResponsibleContacts(
  clientIds: string[],
  category: string | null | undefined,
  userId: string,
  userRole?: string,
): Promise<string | null> {
  if (clientIds.length > 0 && !isExternalEvent(category)) {
    return "Responsáveis podem ser vinculados apenas a eventos externos";
  }
  if (
    clientIds.length > 0 &&
    !(await storage.validateEventResponsibleContactIds(
      clientIds,
      userId,
      userRole,
    ))
  ) {
    return "Um ou mais responsáveis não foram encontrados";
  }
  return null;
}

function normalizePricingData(
  eventData: Record<string, unknown>,
  currentEvent?: {
    pricingType?: string | null;
    eventValue?: string | null;
    pricePerPerson?: string | null;
  } | null,
  options: { requireExplicitValue?: boolean } = {},
): string | null {
  const pricingType =
    eventData.pricingType ??
    currentEvent?.pricingType ??
    "per_person";

  if (
    typeof pricingType !== "string" ||
    !EVENT_PRICING_TYPES.includes(
      pricingType as (typeof EVENT_PRICING_TYPES)[number],
    )
  ) {
    return "Tipo de valor do evento inválido";
  }

  const hasSubmittedValue =
    eventData.eventValue !== undefined || eventData.pricePerPerson !== undefined;
  if (options.requireExplicitValue && !hasSubmittedValue) {
    return "O valor do evento é obrigatório";
  }

  const rawValue =
    eventData.eventValue ??
    eventData.pricePerPerson ??
    currentEvent?.eventValue ??
    currentEvent?.pricePerPerson ??
    "0";
  const valueText =
    typeof rawValue === "string" || typeof rawValue === "number"
      ? String(rawValue).trim()
      : "";

  if (options.requireExplicitValue && valueText === "") {
    return "O valor do evento é obrigatório";
  }

  if (
    valueText === "" ||
    !/^\d+(?:\.\d{1,2})?$/.test(valueText) ||
    Number(valueText) > 99_999_999.99
  ) {
    return "O valor do evento deve ser um número maior ou igual a zero";
  }
  const value = Number(valueText);

  // Durante a transição, o campo legado continua sincronizado para não quebrar
  // integrações e relatórios que ainda dependem de price_per_person.
  eventData.pricingType = pricingType;
  eventData.eventValue = value.toFixed(2);
  eventData.pricePerPerson = value.toFixed(2);
  return null;
}

function validateEventDates(
  eventData: {
    category?: string | null;
    eventDate?: Date;
    registrationDeadline?: Date | null;
  },
  currentEvent?: {
    category?: string | null;
    eventDate: Date;
    registrationDeadline?: Date | null;
  } | null,
  options: { enforcePastDate?: boolean } = {},
): string | null {
  const category = eventData.category ?? currentEvent?.category ?? "Geral";
  const eventDate = eventData.eventDate ?? currentEvent?.eventDate;
  const registrationDeadline =
    eventData.registrationDeadline === undefined
      ? currentEvent?.registrationDeadline
      : eventData.registrationDeadline;

  if (!eventDate || Number.isNaN(eventDate.getTime())) {
    return "Data do evento é obrigatória";
  }

  const isExternal = category.trim().toUpperCase() === "EXTERNO";
  if (
    options.enforcePastDate !== false &&
    !isExternal &&
    eventDate < startOfTodayInSaoPaulo()
  ) {
    return "A data do evento não pode ser no passado para esta categoria";
  }

  if (
    registrationDeadline &&
    registrationDeadline.getTime() > eventDate.getTime()
  ) {
    return "O prazo de inscrição não pode ser após a data do evento";
  }

  return null;
}

eventsRouter.get("/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const clientEvents = await storage.getClientEvents(clientId);
    return res.json(clientEvents);
  } catch (error) {
    console.error("Error fetching client events:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar eventos do cliente" });
  }
});

eventsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const mode = req.query.mode;

    if (mode === "upcoming" || mode === "past") {
      const cursor = decodeCursor(req.query.cursor);
      const limit = clampLimit(req.query.limit, { fallback: 9, max: 50 });
      const result = await storage.getEventsPaginated({
        userId,
        userRole,
        mode,
        cursor,
        limit,
      });
      return res.json(result);
    }

    const events = await storage.getEvents(userId, userRole);
    return res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({ message: "Erro ao buscar eventos" });
  }
});

eventsRouter.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhuma imagem foi enviada" });
    }

    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: "Formato de arquivo inválido. Use JPEG, JPG ou PNG",
      });
    }

    if (req.file.size > 15 * 1024 * 1024) {
      return res.status(400).json({
        message: "Arquivo muito grande. O tamanho máximo é 15MB",
      });
    }

    const fileExtension = req.file.originalname.split(".").pop();
    const fileName = `event-${nanoid()}.${fileExtension}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: "crm-test",
        Body: req.file.buffer,
        Key: fileName,
        ContentType: req.file.mimetype,
      }),
    );

    return res.json({ imageUrl: fileName });
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    return res.status(500).json({ message: "Erro ao fazer upload da imagem" });
  }
});

eventsRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;

    const eventData = {
      ...req.body,
      createdBy: userId,
    };

    if (!eventData.name || !eventData.name.trim()) {
      return res.status(400).json({ message: "Nome do evento é obrigatório" });
    }
    if (!eventData.eventDate) {
      return res.status(400).json({ message: "Data do evento é obrigatória" });
    }
    if (!eventData.location || !eventData.location.trim()) {
      return res.status(400).json({ message: "Local do evento é obrigatório" });
    }
    const pricingError = normalizePricingData(eventData, undefined, {
      requireExplicitValue: true,
    });
    if (pricingError) {
      return res.status(400).json({ message: pricingError });
    }

    if (typeof eventData.eventDate === "string") {
      eventData.eventDate = new Date(eventData.eventDate + ":00-03:00");
    }
    if (
      eventData.registrationDeadline &&
      typeof eventData.registrationDeadline === "string"
    ) {
      eventData.registrationDeadline = new Date(
        eventData.registrationDeadline + ":00-03:00",
      );
    }
    if (eventData.wineRevenue === "" || eventData.wineRevenue === undefined) {
      eventData.wineRevenue = null;
    }
    if (eventData.maxCapacity === "" || eventData.maxCapacity === undefined) {
      eventData.maxCapacity = null;
    }

    const { attachments, responsibleContactIds, ...eventDataOnly } = eventData;
    const parsedResponsibleContactIds = responsibleContactIdsSchema.parse(
      responsibleContactIds ?? [],
    );
    const validatedData = insertEventSchema.parse(eventDataOnly);
    const dateError = validateEventDates(validatedData);
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }
    const responsibleContactsError = await validateResponsibleContacts(
      parsedResponsibleContactIds,
      validatedData.category,
      userId,
      req.user?.role,
    );
    if (responsibleContactsError) {
      return res.status(400).json({ message: responsibleContactsError });
    }
    const { event, responsibleContacts } =
      await storage.createEventWithResponsibleContacts(
        validatedData,
        parsedResponsibleContactIds,
        { userId, userRole: req.user?.role },
      );

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.fileUrl && attachment.fileName) {
          await storage.addEventAttachment({
            eventId: event.id,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
          });
        }
      }
    }

    return res.status(201).json({ ...event, responsibleContacts });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar evento:", error);
    return res.status(500).json({
      message: "Erro ao criar evento",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

eventsRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const currentEvent = await storage.getEventById(id);
    if (!currentEvent) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
    if (!canManageEvent(currentEvent, req.user)) {
      return res.status(403).json({ message: "Sem permissão para editar este evento" });
    }

    const eventData: Record<string, unknown> = { ...req.body };
    const pricingError = normalizePricingData(eventData, currentEvent);
    if (pricingError) {
      return res.status(400).json({ message: pricingError });
    }
    if (eventData.eventDate && typeof eventData.eventDate === "string") {
      eventData.eventDate = new Date(eventData.eventDate + ":00-03:00");
    }
    if (
      eventData.registrationDeadline &&
      typeof eventData.registrationDeadline === "string"
    ) {
      eventData.registrationDeadline = new Date(
        eventData.registrationDeadline + ":00-03:00",
      );
    }
    if (eventData.wineRevenue === "" || eventData.wineRevenue === undefined) {
      eventData.wineRevenue = null;
    }
    if (eventData.maxCapacity === "" || eventData.maxCapacity === undefined) {
      eventData.maxCapacity = null;
    }
    const { attachments, responsibleContactIds, ...eventDataOnly } = eventData;
    const parsedResponsibleContactIds =
      responsibleContactIds === undefined
        ? undefined
        : responsibleContactIdsSchema.parse(responsibleContactIds);
    const validatedData = insertEventSchema.partial().parse(eventDataOnly);
    const dateError = validateEventDates(validatedData, currentEvent, {
      enforcePastDate:
        validatedData.eventDate !== undefined ||
        validatedData.category !== undefined,
    });
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }
    const nextCategory = validatedData.category ?? currentEvent.category;
    const shouldClearResponsibleContacts = !isExternalEvent(nextCategory);
    const nextResponsibleContactIds = shouldClearResponsibleContacts
      ? []
      : parsedResponsibleContactIds;
    if (nextResponsibleContactIds !== undefined) {
      const responsibleContactsError = await validateResponsibleContacts(
        nextResponsibleContactIds,
        nextCategory,
        req.user!.userId,
        req.user?.role,
      );
      if (responsibleContactsError) {
        return res.status(400).json({ message: responsibleContactsError });
      }
    }

    const nextEventDate = validatedData.eventDate;
    const isChangingFinalizedEventDate =
      currentEvent.status === "finalizado" &&
      nextEventDate !== undefined &&
      nextEventDate.getTime() !== currentEvent.eventDate.getTime();
    const nextStatus = validatedData.status ?? currentEvent.status;
    if (
      isChangingFinalizedEventDate &&
      nextEventDate !== undefined &&
      nextEventDate >= startOfTodayInSaoPaulo() &&
      nextStatus === "finalizado"
    ) {
      return res.status(400).json({
        message:
          "Ao reagendar um evento finalizado para uma data futura, altere o status para Planejado ou Ativo.",
      });
    }

    const result = await storage.updateEventWithResponsibleContacts(
      id,
      validatedData,
      nextResponsibleContactIds,
      { userId: req.user!.userId, userRole: req.user?.role },
    );

    if (attachments !== undefined) {
      await storage.deleteEventAttachmentsByEventId(id);
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.fileUrl && attachment.fileName) {
            await storage.addEventAttachment({
              eventId: id,
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
            });
          }
        }
      }
    }

    return res.json({
      ...result.event,
      responsibleContacts: result.responsibleContacts,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Error updating event:", error);
    return res.status(500).json({ message: "Erro ao atualizar evento" });
  }
});

eventsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteEvent(id);
    if (!success) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
    return res.json({ message: "Evento excluído com sucesso" });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ message: "Erro ao excluir evento" });
  }
});

eventsRouter.get("/:id/responsibles", async (req, res) => {
  try {
    const event = await storage.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
    if (!canManageEvent(event, req.user)) {
      return res.status(403).json({ message: "Sem permissão para ver este evento" });
    }
    return res.json(await storage.getEventResponsibleContacts(event.id));
  } catch (error) {
    console.error("Error fetching event responsible contacts:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar responsáveis do evento" });
  }
});

eventsRouter.put("/:id/responsibles", async (req, res) => {
  try {
    const event = await storage.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
    if (!canManageEvent(event, req.user)) {
      return res.status(403).json({ message: "Sem permissão para editar este evento" });
    }
    const clientIds = responsibleContactIdsSchema.parse(
      req.body.responsibleContactIds,
    );
    const validationError = await validateResponsibleContacts(
      clientIds,
      event.category,
      req.user!.userId,
      req.user?.role,
    );
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const result = await storage.updateEventWithResponsibleContacts(
      event.id,
      {},
      clientIds,
      { userId: req.user!.userId, userRole: req.user?.role },
    );
    return res.json(result.responsibleContacts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: fromZodError(error).toString(),
      });
    }
    console.error("Error updating event responsible contacts:", error);
    return res
      .status(500)
      .json({ message: "Erro ao atualizar responsáveis do evento" });
  }
});

eventsRouter.get("/:id/participants", async (req, res) => {
  try {
    const { id } = req.params;
    const participants = await storage.getEventParticipants(id);
    return res.json(participants);
  } catch (error) {
    console.error("Error fetching event participants:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar participantes do evento" });
  }
});

eventsRouter.post("/:id/participants", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const participantData = {
      ...req.body,
      eventId: id,
      registeredBy: userId,
    };

    const validatedData = insertEventParticipantSchema.parse(participantData);
    const participant = await storage.addEventParticipant(validatedData);
    return res.status(201).json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Error adding event participant:", error);
    return res.status(500).json({ message: "Erro ao adicionar participante" });
  }
});

eventsRouter.put("/:eventId/participants/:participantId", async (req, res) => {
  try {
    const { participantId } = req.params;
    const validatedData = insertEventParticipantSchema
      .partial()
      .parse(req.body);
    const participant = await storage.updateEventParticipant(
      participantId,
      validatedData,
    );
    return res.json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Error updating event participant:", error);
    return res.status(500).json({ message: "Erro ao atualizar participante" });
  }
});

eventsRouter.patch(
  "/:eventId/participants/:participantId/attendance",
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const schema = z.object({ attended: z.boolean().nullable() });
      const { attended } = schema.parse(req.body);
      const participant = await storage.updateEventParticipant(participantId, {
        attended,
      });
      return res.json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Error updating attendance:", error);
      return res.status(500).json({ message: "Erro ao atualizar presença" });
    }
  },
);

eventsRouter.delete(
  "/:eventId/participants/:participantId",
  async (req, res) => {
    try {
      const { participantId } = req.params;
      const success = await storage.removeEventParticipant(participantId);
      if (!success) {
        return res.status(404).json({ message: "Participante não encontrado" });
      }
      return res.json({ message: "Participante removido com sucesso" });
    } catch (error) {
      console.error("Error removing event participant:", error);
      return res.status(500).json({ message: "Erro ao remover participante" });
    }
  },
);

eventsRouter.get("/:id/attachments", async (req, res) => {
  try {
    const { id } = req.params;
    const attachments = await storage.getEventAttachments(id);
    return res.json(attachments);
  } catch (error) {
    console.error("Error fetching event attachments:", error);
    return res.status(500).json({ message: "Erro ao buscar anexos do evento" });
  }
});

eventsRouter.post("/:id/attachments", async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileUrl } = req.body;

    if (!fileName || !fileUrl) {
      return res
        .status(400)
        .json({ message: "Nome do arquivo e URL são obrigatórios" });
    }

    const attachment = await storage.addEventAttachment({
      eventId: id,
      fileName,
      fileUrl,
    });
    return res.status(201).json(attachment);
  } catch (error) {
    console.error("Error adding event attachment:", error);
    return res
      .status(500)
      .json({ message: "Erro ao adicionar anexo do evento" });
  }
});

eventsRouter.delete("/:eventId/attachments/:attachmentId", async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const success = await storage.deleteEventAttachment(attachmentId);

    if (!success) {
      return res.status(404).json({ message: "Anexo não encontrado" });
    }

    return res.json({ message: "Anexo removido com sucesso" });
  } catch (error) {
    console.error("Error deleting event attachment:", error);
    return res.status(500).json({ message: "Erro ao remover anexo do evento" });
  }
});

// Analytics de eventos
eventsRouter.get("/analytics", async (req, res) => {
  try {
    const { db } = storage as any;

    const [revenueRows, topClientsRows, statusRows, occupancyRows] =
      await Promise.all([
        // 1. Receita mês a mês
        db.execute(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', ev.event_date), 'YYYY-MM') as month,
          TO_CHAR(DATE_TRUNC('month', ev.event_date), 'MM/YYYY') as label,
          COALESCE(SUM(COALESCE(ev.wine_revenue::numeric, 0)), 0) as wine_revenue,
          COALESCE(ep_rev.event_revenue, 0) as event_revenue
        FROM events ev
        LEFT JOIN (
          SELECT
            month_key,
            SUM(event_revenue) as event_revenue
          FROM (
            SELECT
              DATE_TRUNC('month', e.event_date) as month_key,
              CASE
                WHEN e.pricing_type = 'total' THEN
                  e.event_value::numeric
                ELSE COALESCE(SUM(
                  CASE WHEN ep.status IN ('pago','pagar_na_hora') THEN
                    CASE WHEN ep.custom_price IS NOT NULL THEN ep.custom_price::numeric
                    ELSE ep.number_of_participants::numeric * e.event_value::numeric END
                  ELSE 0 END
                ), 0)
              END as event_revenue
            FROM events e
            LEFT JOIN event_participants ep ON ep.event_id = e.id
            WHERE e.status != 'cancelado'
            GROUP BY e.id, e.event_date, e.pricing_type, e.event_value
          ) event_totals
          GROUP BY month_key
        ) ep_rev ON DATE_TRUNC('month', ev.event_date) = ep_rev.month_key
        WHERE ev.status != 'cancelado'
        GROUP BY DATE_TRUNC('month', ev.event_date), ep_rev.event_revenue
        ORDER BY DATE_TRUNC('month', ev.event_date)
      `),

        // 2. Clientes mais assíduos
        db.execute(`
        SELECT c.id as client_id, c.name, COUNT(DISTINCT ep.event_id)::int as event_count, SUM(ep.number_of_participants)::int as total_people
        FROM event_participants ep
        JOIN clients c ON c.id = ep.client_id
        WHERE ep.status != 'cancelado'
        GROUP BY c.id, c.name
        ORDER BY event_count DESC, total_people DESC
        LIMIT 10
      `),

        // 3. Distribuição de status
        db.execute(`
        SELECT status, SUM(number_of_participants)::int as total
        FROM event_participants
        WHERE status != 'cancelado'
        GROUP BY status
        ORDER BY total DESC
      `),

        // 4. Ocupação dos eventos (só eventos com capacidade máxima definida)
        db.execute(`
        SELECT
          e.name,
          TO_CHAR(e.event_date, 'DD/MM/YY') as date,
          COALESCE(SUM(ep.number_of_participants) FILTER (WHERE ep.status != 'cancelado'), 0)::int as participant_count,
          e.max_capacity,
          ROUND(
            COALESCE(SUM(ep.number_of_participants) FILTER (WHERE ep.status != 'cancelado'), 0)::numeric
            / e.max_capacity::numeric * 100, 1
          ) as occupancy_pct
        FROM events e
        LEFT JOIN event_participants ep ON ep.event_id = e.id
        WHERE e.max_capacity IS NOT NULL AND e.max_capacity > 0 AND e.status != 'cancelado'
        GROUP BY e.id, e.name, e.event_date, e.max_capacity
        ORDER BY e.event_date DESC
        LIMIT 15
      `),
      ]);

    const statusLabels: Record<string, string> = {
      pago: "Pago",
      convidado: "Convidado",
      pendente: "Pendente",
      pagar_na_hora: "Pagar na Hora",
    };

    return res.json({
      revenueByMonth: revenueRows.rows.map((r: any) => ({
        month: r.month,
        label: r.label,
        eventRevenue: parseFloat(r.event_revenue) || 0,
        wineRevenue: parseFloat(r.wine_revenue) || 0,
        total:
          (parseFloat(r.event_revenue) || 0) +
          (parseFloat(r.wine_revenue) || 0),
      })),
      topClients: topClientsRows.rows.map((r: any) => ({
        clientId: r.client_id,
        name: r.name?.split(" ").slice(0, 2).join(" "),
        fullName: r.name,
        eventCount: r.event_count,
        totalPeople: r.total_people,
      })),
      statusDistribution: statusRows.rows.map((r: any) => ({
        status: r.status,
        label: statusLabels[r.status] || r.status,
        total: r.total,
      })),
      eventOccupancy: occupancyRows.rows.map((r: any) => ({
        name: r.name?.length > 22 ? r.name.substring(0, 22) + "…" : r.name,
        fullName: r.name,
        date: r.date,
        participantCount: r.participant_count,
        maxCapacity: r.max_capacity,
        occupancyPct: parseFloat(r.occupancy_pct) || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching event analytics:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar análises de eventos" });
  }
});

// POST /api/events/:id/landing-page — Upload do HTML da landing page
eventsRouter.post(
  "/:id/landing-page",
  upload.single("html"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const slugInput = req.body.slug as string | undefined;

      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Nenhum arquivo HTML foi enviado" });
      }
      if (
        req.file.mimetype !== "text/html" &&
        !req.file.originalname.endsWith(".html")
      ) {
        return res
          .status(400)
          .json({ message: "Apenas arquivos .html são aceitos" });
      }

      if (!slugInput || !slugInput.trim()) {
        return res.status(400).json({ message: "Slug é obrigatório" });
      }

      const slug = generateSlug(slugInput.trim());
      if (!slug) {
        return res.status(400).json({
          message: "Slug inválido. Use apenas letras, números e hífens",
        });
      }

      // Verifica unicidade do slug (excluindo o próprio evento)
      const existing = await storage.getEventBySlug(slug);
      if (existing && existing.id !== id) {
        return res
          .status(409)
          .json({ message: "Este slug já está em uso por outro evento" });
      }

      // Recupera o arquivo antigo para deletar do R2 após salvar o novo
      const currentEvent = await storage.getEventById(id);
      if (!currentEvent) {
        return res.status(404).json({ message: "Evento não encontrado" });
      }

      // Otimiza HTML antes do upload: resolve bundler do Claude Design,
      // substitui assets embutidos por data URLs e garante viewport mobile.
      const optimizedBody = optimizeHtml(req.file.buffer);

      await s3.send(
        new PutObjectCommand({
          Bucket: "crm-test",
          Body: optimizedBody,
          Key: slug,
          ContentType: "text/html; charset=utf-8",
        }),
      );

      const updatedEvent = await storage.updateEvent(id, {
        slug,
        landingPageHtmlKey: slug,
      });

      // Remove arquivo antigo do R2 se existia e slug mudou
      if (
        currentEvent.landingPageHtmlKey &&
        currentEvent.landingPageHtmlKey !== slug
      ) {
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: "crm-test",
              Key: currentEvent.landingPageHtmlKey,
            }),
          );
        } catch {
          // ignora erro ao deletar arquivo antigo
        }
      }

      // Invalida cache em memória (fallback Express) e purga CDN Cloudflare
      const slugsToPurge = [slug];
      if (currentEvent.slug && currentEvent.slug !== slug) {
        invalidateCachedPage(currentEvent.slug);
        slugsToPurge.push(currentEvent.slug);
      }
      invalidateCachedPage(slug);
      await purgeCloudflareCache(slugsToPurge);

      return res.json({
        slug: updatedEvent.slug,
        landingPageHtmlKey: updatedEvent.landingPageHtmlKey,
        landingPageUrl: `${LP_PUBLIC_DOMAIN}/${slug}`,
      });
    } catch (error) {
      console.error("Error uploading landing page:", error);
      return res
        .status(500)
        .json({ message: "Erro ao fazer upload da landing page" });
    }
  },
);

// DELETE /api/events/:id/landing-page — Remove a landing page do evento
eventsRouter.delete("/:id/landing-page", async (req, res) => {
  try {
    const { id } = req.params;
    const event = await storage.getEventById(id);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
    if (!event.landingPageHtmlKey) {
      return res
        .status(404)
        .json({ message: "Nenhuma landing page associada a este evento" });
    }

    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: "crm-test",
          Key: event.landingPageHtmlKey,
        }),
      );
    } catch {
      // ignora erro de deleção no R2 para não bloquear a limpeza no banco
    }

    await storage.updateEvent(id, { slug: null, landingPageHtmlKey: null });

    if (event.slug) {
      invalidateCachedPage(event.slug);
      await purgeCloudflareCache([event.slug]);
    }

    return res.json({ message: "Landing page removida com sucesso" });
  } catch (error) {
    console.error("Error deleting landing page:", error);
    return res.status(500).json({ message: "Erro ao remover landing page" });
  }
});

export default eventsRouter;
