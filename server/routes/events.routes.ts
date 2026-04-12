import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { insertEventSchema, insertEventParticipantSchema } from "@shared/schema";
import { storage } from "../storage";

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
    if (!eventData.pricePerPerson || isNaN(parseFloat(eventData.pricePerPerson))) {
      return res.status(400).json({ message: "Valor por pessoa deve ser um número válido" });
    }

    if (typeof eventData.eventDate === "string") {
      eventData.eventDate = new Date(eventData.eventDate + ":00-03:00");
    }
    if (eventData.registrationDeadline && typeof eventData.registrationDeadline === "string") {
      eventData.registrationDeadline = new Date(eventData.registrationDeadline + ":00-03:00");
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
    if (eventData.registrationDeadline && typeof eventData.registrationDeadline === "string") {
      eventData.registrationDeadline = new Date(eventData.registrationDeadline + ":00-03:00");
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
    return res.status(500).json({ message: "Erro ao buscar participantes do evento" });
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
    const validatedData = insertEventParticipantSchema.partial().parse(req.body);
    const participant = await storage.updateEventParticipant(participantId, validatedData);
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

eventsRouter.delete("/:eventId/participants/:participantId", async (req, res) => {
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
});

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
      return res.status(400).json({ message: "Nome do arquivo e URL são obrigatórios" });
    }

    const attachment = await storage.addEventAttachment({ eventId: id, fileName, fileUrl });
    return res.status(201).json(attachment);
  } catch (error) {
    console.error("Error adding event attachment:", error);
    return res.status(500).json({ message: "Erro ao adicionar anexo do evento" });
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

export default eventsRouter;
