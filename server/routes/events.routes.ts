import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
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
    if (
      !eventData.pricePerPerson ||
      isNaN(parseFloat(eventData.pricePerPerson))
    ) {
      return res
        .status(400)
        .json({ message: "Valor por pessoa deve ser um número válido" });
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

    const { attachments, ...eventDataOnly } = eventData;
    const validatedData = insertEventSchema.parse(eventDataOnly);
    const event = await storage.createEvent(validatedData);

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

    return res.status(201).json(event);
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
    const eventData = { ...req.body };
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
    const { attachments, ...eventDataOnly } = eventData;
    const validatedData = insertEventSchema.partial().parse(eventDataOnly);
    const event = await storage.updateEvent(id, validatedData);

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

    return res.json(event);
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
            DATE_TRUNC('month', e.event_date) as month_key,
            SUM(CASE WHEN ep.custom_price IS NOT NULL THEN ep.custom_price::numeric
                     ELSE ep.number_of_participants::numeric * e.price_per_person::numeric END) as event_revenue
          FROM events e
          JOIN event_participants ep ON ep.event_id = e.id
          WHERE e.status != 'cancelado' AND ep.status IN ('pago','pagar_na_hora')
          GROUP BY DATE_TRUNC('month', e.event_date)
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
        return res
          .status(400)
          .json({
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

      const htmlKey = `landing-pages/${id}-${nanoid()}.html`;

      await s3.send(
        new PutObjectCommand({
          Bucket: "crm-test",
          Body: req.file.buffer,
          Key: htmlKey,
          ContentType: "text/html; charset=utf-8",
        }),
      );

      const updatedEvent = await storage.updateEvent(id, {
        slug,
        landingPageHtmlKey: htmlKey,
      });

      // Remove arquivo antigo do R2 se existia outro
      if (currentEvent.landingPageHtmlKey) {
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

      return res.json({
        slug: updatedEvent.slug,
        landingPageHtmlKey: updatedEvent.landingPageHtmlKey,
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

    return res.json({ message: "Landing page removida com sucesso" });
  } catch (error) {
    console.error("Error deleting landing page:", error);
    return res.status(500).json({ message: "Erro ao remover landing page" });
  }
});

export default eventsRouter;
