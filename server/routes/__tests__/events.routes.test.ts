import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { eventsRouter } from "../events.routes";
import {
  createMockAuthMiddleware,
  createRouteTestApp,
} from "../../test/create-route-test-app";

const {
  getEventsMock,
  getEventsPaginatedMock,
  getEventByIdMock,
  createEventMock,
  createEventWithResponsibleContactsMock,
  addEventAttachmentMock,
  updateEventMock,
  updateEventWithResponsibleContactsMock,
  deleteEventMock,
  getEventParticipantsMock,
  addEventParticipantMock,
  updateEventParticipantMock,
  removeEventParticipantMock,
  getEventAttachmentsMock,
  deleteEventAttachmentMock,
  deleteEventAttachmentsByEventIdMock,
  getEventResponsibleContactsMock,
  validateEventResponsibleContactIdsMock,
  replaceEventResponsibleContactsMock,
  s3SendMock,
} = vi.hoisted(() => ({
  getEventsMock: vi.fn(),
  getEventsPaginatedMock: vi.fn(),
  getEventByIdMock: vi.fn(),
  createEventMock: vi.fn(),
  createEventWithResponsibleContactsMock: vi.fn(),
  addEventAttachmentMock: vi.fn(),
  updateEventMock: vi.fn(),
  updateEventWithResponsibleContactsMock: vi.fn(),
  deleteEventMock: vi.fn(),
  getEventParticipantsMock: vi.fn(),
  addEventParticipantMock: vi.fn(),
  updateEventParticipantMock: vi.fn(),
  removeEventParticipantMock: vi.fn(),
  getEventAttachmentsMock: vi.fn(),
  deleteEventAttachmentMock: vi.fn(),
  deleteEventAttachmentsByEventIdMock: vi.fn(),
  getEventResponsibleContactsMock: vi.fn(),
  validateEventResponsibleContactIdsMock: vi.fn(),
  replaceEventResponsibleContactsMock: vi.fn(),
  s3SendMock: vi.fn(),
}));

const { getEventsReportMock } = vi.hoisted(() => ({
  getEventsReportMock: vi.fn(),
}));

// Sem isto o `importOriginal` abaixo carrega o serviço de verdade, que abre o
// pool do Neon só para o teste de rota.
vi.mock("../../db", () => ({
  db: { execute: vi.fn() },
  pool: { connect: vi.fn() },
}));

// Só a consulta é dublada: `isIsoDate` continua o de verdade porque as rotas o
// usam para validar o período, e é isso que estes testes exercitam.
vi.mock("../../services/events-report.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/events-report.service")>();
  return { ...actual, getEventsReport: getEventsReportMock };
});

vi.mock("../../storage", () => ({
  storage: {
    getEvents: getEventsMock,
    getEventsPaginated: getEventsPaginatedMock,
    getEventById: getEventByIdMock,
    createEvent: createEventMock,
    createEventWithResponsibleContacts: createEventWithResponsibleContactsMock,
    addEventAttachment: addEventAttachmentMock,
    updateEvent: updateEventMock,
    updateEventWithResponsibleContacts: updateEventWithResponsibleContactsMock,
    deleteEvent: deleteEventMock,
    getEventParticipants: getEventParticipantsMock,
    addEventParticipant: addEventParticipantMock,
    updateEventParticipant: updateEventParticipantMock,
    removeEventParticipant: removeEventParticipantMock,
    getEventAttachments: getEventAttachmentsMock,
    deleteEventAttachment: deleteEventAttachmentMock,
    deleteEventAttachmentsByEventId: deleteEventAttachmentsByEventIdMock,
    getEventResponsibleContacts: getEventResponsibleContactsMock,
    validateEventResponsibleContactIds: validateEventResponsibleContactIdsMock,
    replaceEventResponsibleContacts: replaceEventResponsibleContactsMock,
  },
}));

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  class MockS3Client {
    send = s3SendMock;
  }
  return { ...actual, S3Client: MockS3Client };
});

describe("eventsRouter", () => {
  beforeEach(() => {
    getEventsMock.mockReset();
    getEventsPaginatedMock.mockReset();
    getEventByIdMock.mockReset();
    createEventMock.mockReset();
    createEventWithResponsibleContactsMock.mockReset();
    addEventAttachmentMock.mockReset();
    updateEventMock.mockReset();
    updateEventWithResponsibleContactsMock.mockReset();
    deleteEventMock.mockReset();
    getEventParticipantsMock.mockReset();
    addEventParticipantMock.mockReset();
    updateEventParticipantMock.mockReset();
    removeEventParticipantMock.mockReset();
    getEventAttachmentsMock.mockReset();
    deleteEventAttachmentMock.mockReset();
    deleteEventAttachmentsByEventIdMock.mockReset();
    getEventResponsibleContactsMock.mockReset();
    validateEventResponsibleContactIdsMock.mockReset();
    replaceEventResponsibleContactsMock.mockReset();
    s3SendMock.mockReset();
    getEventsReportMock.mockReset();
  });

  it("keeps GET /events with user filtering from jwt", async () => {
    getEventsMock.mockResolvedValue([{ id: "event-1" }]);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events");

    expect(getEventsMock).toHaveBeenCalledWith("test-user-id", "admin");
    expect(response.status).toBe(200);
  });

  it("blocks a vendedor without Eventos access", async () => {
    const app = createRouteTestApp({
      router: eventsRouter,
      basePath: "/events",
      middlewares: [createMockAuthMiddleware({ role: "vendedor" })],
    });

    const response = await request(app).get("/events");

    expect(response.status).toBe(403);
    expect(getEventsMock).not.toHaveBeenCalled();
  });

  it("allows the Eventos profile to list every event", async () => {
    getEventsMock.mockResolvedValue([{ id: "event-1" }]);
    const app = createRouteTestApp({
      router: eventsRouter,
      basePath: "/events",
      middlewares: [
        createMockAuthMiddleware({ role: "vendedor", eventAccess: true }),
      ],
    });

    const response = await request(app).get("/events");

    expect(response.status).toBe(200);
    expect(getEventsMock).toHaveBeenCalledWith("test-user-id", "admin");
  });

  it("keeps event deletion restricted to administrators", async () => {
    const app = createRouteTestApp({
      router: eventsRouter,
      basePath: "/events",
      middlewares: [
        createMockAuthMiddleware({ role: "vendedor", eventAccess: true }),
      ],
    });

    const response = await request(app).delete("/events/event-1");

    expect(response.status).toBe(403);
    expect(deleteEventMock).not.toHaveBeenCalled();
  });

  it("returns plain array when mode is not provided (backward compat)", async () => {
    getEventsMock.mockResolvedValue([{ id: "event-1" }]);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events");

    expect(getEventsPaginatedMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "event-1" }]);
  });

  it("uses getEventsPaginated with decoded cursor/limit when mode=upcoming", async () => {
    getEventsPaginatedMock.mockResolvedValue({
      events: [{ id: "event-1" }],
      nextCursor: "next-cursor-token",
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get(
      "/events?mode=upcoming&limit=9",
    );

    expect(getEventsPaginatedMock).toHaveBeenCalledWith({
      userId: "test-user-id",
      userRole: "admin",
      mode: "upcoming",
      cursor: null,
      limit: 9,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      events: [{ id: "event-1" }],
      nextCursor: "next-cursor-token",
    });
  });

  it("uses getEventsPaginated with mode=past and defaults limit to 9", async () => {
    getEventsPaginatedMock.mockResolvedValue({ events: [], nextCursor: null });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events?mode=past");

    expect(getEventsPaginatedMock).toHaveBeenCalledWith({
      userId: "test-user-id",
      userRole: "admin",
      mode: "past",
      cursor: null,
      limit: 9,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ events: [], nextCursor: null });
  });

  it("treats an invalid cursor as no cursor instead of failing", async () => {
    getEventsPaginatedMock.mockResolvedValue({ events: [], nextCursor: null });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get(
      "/events?mode=upcoming&cursor=not-a-valid-cursor",
    );

    expect(getEventsPaginatedMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );
    expect(response.status).toBe(200);
  });

  it("returns 400 for /events/upload-image without file", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).post("/events/upload-image");
    expect(response.status).toBe(400);
  });

  it("creates event with attachments and createdBy from jwt", async () => {
    createEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1" },
      responsibleContacts: [],
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
      .send({
        name: "Evento",
        eventDate: "2099-04-11T18:00",
        location: "Local",
        pricePerPerson: "10.00",
        attachments: [{ fileName: "a.jpg", fileUrl: "a.jpg" }],
      });

    expect(createEventWithResponsibleContactsMock).toHaveBeenCalledTimes(1);
    expect(addEventAttachmentMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("allows creating a past external event with total value", async () => {
    createEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1" },
      responsibleContacts: [],
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
      .send({
        name: "Feira parceira",
        eventDate: "2020-04-11T18:00",
        location: "Centro de eventos",
        category: "EXTERNO",
        pricingType: "total",
        eventValue: "2500.00",
      });

    expect(response.status).toBe(201);
    expect(createEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "EXTERNO",
        pricingType: "total",
        eventValue: "2500.00",
        pricePerPerson: "2500.00",
      }),
      [],
      expect.any(Object),
    );
  });

  it("creates an external event with multiple responsible contacts", async () => {
    createEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1" },
      responsibleContacts: [
        { id: "client-1", name: "Ana" },
        { id: "client-2", name: "Bruno" },
      ],
    });
    validateEventResponsibleContactIdsMock.mockResolvedValue(true);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
      .send({
        name: "Feira parceira",
        eventDate: "2020-04-11T18:00",
        location: "Centro de eventos",
        category: "EXTERNO",
        pricingType: "total",
        eventValue: "2500.00",
        responsibleContactIds: ["client-1", "client-2"],
      });

    expect(response.status).toBe(201);
    expect(validateEventResponsibleContactIdsMock).toHaveBeenCalledWith(
      ["client-1", "client-2"],
      "test-user-id",
      "admin",
    );
    expect(createEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      expect.any(Object),
      ["client-1", "client-2"],
      expect.objectContaining({ userId: "test-user-id" }),
    );
    expect(response.body.responsibleContacts).toHaveLength(2);
  });

  it("rejects responsible contacts on non-external events", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app)
      .post("/events")
      .send({
        name: "Degustação",
        eventDate: "2099-04-11T18:00",
        location: "Loja",
        pricingType: "per_person",
        eventValue: "150.00",
        responsibleContactIds: ["client-1"],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("apenas a eventos externos");
    expect(createEventWithResponsibleContactsMock).not.toHaveBeenCalled();
  });

  it("replaces and removes responsible contacts when editing an external event", async () => {
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      category: "EXTERNO",
      status: "planejado",
      eventDate: new Date("2099-04-11T18:00:00.000Z"),
    });
    updateEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1" },
      responsibleContacts: [],
    });
    validateEventResponsibleContactIdsMock.mockResolvedValue(true);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .put("/events/event-1")
      .send({ responsibleContactIds: [] });

    expect(response.status).toBe(200);
    expect(updateEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      "event-1",
      expect.any(Object),
      [],
      expect.objectContaining({ userId: "test-user-id" }),
    );
  });

  it("clears contacts when an external event changes category", async () => {
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      category: "EXTERNO",
      status: "planejado",
      eventDate: new Date("2099-04-11T18:00:00.000Z"),
    });
    updateEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1", category: "Geral" },
      responsibleContacts: [],
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .put("/events/event-1")
      .send({ category: "Geral" });

    expect(response.status).toBe(200);
    expect(updateEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      "event-1",
      expect.any(Object),
      [],
      expect.objectContaining({ userId: "test-user-id" }),
    );
  });

  it("returns current responsible contacts through the dedicated endpoint", async () => {
    getEventByIdMock.mockResolvedValue({ id: "event-1", category: "EXTERNO" });
    getEventResponsibleContactsMock.mockResolvedValue([
      { id: "client-1", name: "Ana", phone: "11999999999", email: null },
    ]);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events/event-1/responsibles");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: "client-1", name: "Ana", phone: "11999999999", email: null },
    ]);
  });

  it("allows creating a past event for any category", async () => {
    createEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1" },
      responsibleContacts: [],
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
      .send({
        name: "Degustação antiga",
        eventDate: "2020-04-11T18:00",
        location: "Loja",
        category: "Degustação",
        pricingType: "per_person",
        eventValue: "150.00",
      });

    expect(response.status).toBe(201);
    expect(createEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Degustação",
        eventDate: expect.any(Date),
      }),
      [],
      expect.any(Object),
    );
  });

  it("allows updating an event to a past date", async () => {
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      category: "Degustação",
      status: "planejado",
      eventDate: new Date("2099-04-11T18:00:00.000Z"),
    });
    updateEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1", eventDate: new Date("2020-04-11T21:00:00.000Z") },
      responsibleContacts: [],
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .put("/events/event-1")
      .send({ eventDate: "2020-04-11T18:00" });

    expect(response.status).toBe(200);
    expect(updateEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ eventDate: expect.any(Date) }),
      [],
      expect.objectContaining({ userId: "test-user-id" }),
    );
  });

  it("rejects a deadline after the event date", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
      .send({
        name: "Workshop",
        eventDate: "2099-04-11T18:00",
        registrationDeadline: "2099-04-12T18:00",
        location: "Loja",
        pricingType: "per_person",
        eventValue: "150.00",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("prazo de inscrição");
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it("rejects omitted, blank, or invalid event pricing", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const eventData = {
      name: "Workshop",
      eventDate: "2099-04-11T18:00",
      location: "Loja",
    };

    for (const pricing of [
      {},
      { eventValue: " " },
      { pricingType: "unknown", eventValue: "10.00" },
    ]) {
      const response = await request(app)
        .post("/events")
        .send({ ...eventData, ...pricing });

      expect(response.status).toBe(400);
    }
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it("rejects rescheduling a finalized event without reopening it", async () => {
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      status: "finalizado",
      eventDate: new Date("2026-08-10T21:00:00.000Z"),
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).put("/events/event-1").send({
      eventDate: "2099-08-20T18:00",
      status: "finalizado",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Planejado ou Ativo");
    expect(updateEventWithResponsibleContactsMock).not.toHaveBeenCalled();
  });

  it("allows explicitly reopening a rescheduled finalized event", async () => {
    getEventByIdMock.mockResolvedValue({
      id: "event-1",
      status: "finalizado",
      eventDate: new Date("2026-08-10T21:00:00.000Z"),
    });
    updateEventWithResponsibleContactsMock.mockResolvedValue({
      event: { id: "event-1", status: "planejado" },
      responsibleContacts: [],
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).put("/events/event-1").send({
      eventDate: "2099-08-20T18:00",
      status: "planejado",
    });

    expect(response.status).toBe(200);
    expect(updateEventWithResponsibleContactsMock).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ status: "planejado" }),
      [],
      expect.objectContaining({ userId: "test-user-id" }),
    );
  });

  it("returns 404 when updating an event that does not exist", async () => {
    getEventByIdMock.mockResolvedValue(null);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).put("/events/missing").send({
      status: "ativo",
    });

    expect(response.status).toBe(404);
    expect(updateEventWithResponsibleContactsMock).not.toHaveBeenCalled();
  });

  it("returns 404 for DELETE /events/:id when missing", async () => {
    deleteEventMock.mockResolvedValue(false);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).delete("/events/event-1");
    expect(response.status).toBe(404);
  });

  it("creates participant with registeredBy from jwt", async () => {
    addEventParticipantMock.mockResolvedValue({ id: "participant-1" });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app)
      .post("/events/event-1/participants")
      .send({ clientId: "client-1", status: "pendente" });
    expect(addEventParticipantMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("returns 400 for POST /events/:id/attachments without file data", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).post("/events/event-1/attachments").send({});
    expect(response.status).toBe(400);
  });

  describe("relatório por período", () => {
    const emptyReport = {
      from: "2026-08-01",
      to: "2026-08-31",
      events: [],
      totals: {
        eventCount: 0,
        cancelledCount: 0,
        participantCount: 0,
        attendedCount: 0,
        eventRevenue: 0,
        wineRevenue: 0,
        totalRevenue: 0,
        avgOccupancyPct: null,
      },
    };

    it("GET /events/report devolve os dados do período", async () => {
      getEventsReportMock.mockResolvedValue(emptyReport);
      const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

      const response = await request(app).get(
        "/events/report?from=2026-08-01&to=2026-08-31",
      );

      expect(getEventsReportMock).toHaveBeenCalledWith(
        "2026-08-01",
        "2026-08-31",
        { userId: "test-user-id", userRole: "admin" },
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(emptyReport);
    });

    it("GET /events/report exige from e to", async () => {
      const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

      const response = await request(app).get("/events/report");

      expect(response.status).toBe(400);
      expect(getEventsReportMock).not.toHaveBeenCalled();
    });

    it("GET /events/report recusa data inicial depois da final", async () => {
      const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

      const response = await request(app).get(
        "/events/report?from=2026-08-31&to=2026-08-01",
      );

      expect(response.status).toBe(400);
      expect(getEventsReportMock).not.toHaveBeenCalled();
    });

    it("GET /events/report recusa período maior que 2 anos", async () => {
      const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

      const response = await request(app).get(
        "/events/report?from=2020-01-01&to=2026-01-01",
      );

      expect(response.status).toBe(400);
      expect(getEventsReportMock).not.toHaveBeenCalled();
    });

    it("GET /events/report/pdf devolve um PDF anexado", async () => {
      getEventsReportMock.mockResolvedValue({
        ...emptyReport,
        events: [
          {
            id: "event-1",
            name: "Degustação de Bordeaux",
            date: "2026-08-14",
            time: "19:30",
            location: "Loja Jardins",
            category: "Geral",
            status: "finalizado",
            statusLabel: "Finalizado",
            pricingType: "per_person",
            eventValue: 150,
            maxCapacity: 20,
            participantCount: 15,
            attendedCount: 13,
            occupancyPct: 75,
            eventRevenue: 2250,
            wineRevenue: 800,
            totalRevenue: 3050,
          },
        ],
        totals: { ...emptyReport.totals, eventCount: 1, totalRevenue: 3050 },
      });
      const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

      const response = await request(app)
        .get("/events/report/pdf?from=2026-08-01&to=2026-08-31")
        .buffer()
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toContain(
        "relatorio-eventos-2026-08-01_2026-08-31.pdf",
      );
      expect(response.body.subarray(0, 4).toString()).toBe("%PDF");
    });

    it("GET /events/report/pdf valida o período antes de consultar", async () => {
      const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

      const response = await request(app).get("/events/report/pdf?from=ontem");

      expect(response.status).toBe(400);
      expect(getEventsReportMock).not.toHaveBeenCalled();
    });
  });
});
