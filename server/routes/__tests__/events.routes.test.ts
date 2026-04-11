import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { eventsRouter } from "../events.routes";
import { createRouteTestApp, createRouteTestHeaders } from "../../test/create-route-test-app";

const {
  getEventsMock,
  createEventMock,
  addEventAttachmentMock,
  updateEventMock,
  deleteEventMock,
  getEventParticipantsMock,
  addEventParticipantMock,
  updateEventParticipantMock,
  removeEventParticipantMock,
  getEventAttachmentsMock,
  deleteEventAttachmentMock,
  deleteEventAttachmentsByEventIdMock,
  s3SendMock,
} = vi.hoisted(() => ({
  getEventsMock: vi.fn(),
  createEventMock: vi.fn(),
  addEventAttachmentMock: vi.fn(),
  updateEventMock: vi.fn(),
  deleteEventMock: vi.fn(),
  getEventParticipantsMock: vi.fn(),
  addEventParticipantMock: vi.fn(),
  updateEventParticipantMock: vi.fn(),
  removeEventParticipantMock: vi.fn(),
  getEventAttachmentsMock: vi.fn(),
  deleteEventAttachmentMock: vi.fn(),
  deleteEventAttachmentsByEventIdMock: vi.fn(),
  s3SendMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getEvents: getEventsMock,
    createEvent: createEventMock,
    addEventAttachment: addEventAttachmentMock,
    updateEvent: updateEventMock,
    deleteEvent: deleteEventMock,
    getEventParticipants: getEventParticipantsMock,
    addEventParticipant: addEventParticipantMock,
    updateEventParticipant: updateEventParticipantMock,
    removeEventParticipant: removeEventParticipantMock,
    getEventAttachments: getEventAttachmentsMock,
    deleteEventAttachment: deleteEventAttachmentMock,
    deleteEventAttachmentsByEventId: deleteEventAttachmentsByEventIdMock,
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
    createEventMock.mockReset();
    addEventAttachmentMock.mockReset();
    updateEventMock.mockReset();
    deleteEventMock.mockReset();
    getEventParticipantsMock.mockReset();
    addEventParticipantMock.mockReset();
    updateEventParticipantMock.mockReset();
    removeEventParticipantMock.mockReset();
    getEventAttachmentsMock.mockReset();
    deleteEventAttachmentMock.mockReset();
    deleteEventAttachmentsByEventIdMock.mockReset();
    s3SendMock.mockReset();
  });

  it("keeps GET /events with header filtering", async () => {
    getEventsMock.mockResolvedValue([{ id: "event-1" }]);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events").set(createRouteTestHeaders());

    expect(getEventsMock).toHaveBeenCalledWith("test-user-id", "admin");
    expect(response.status).toBe(200);
  });

  it("returns 400 for /events/upload-image without file", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).post("/events/upload-image");
    expect(response.status).toBe(400);
  });

  it("creates event with attachments and createdBy header", async () => {
    createEventMock.mockResolvedValue({ id: "event-1" });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
      .set(createRouteTestHeaders())
      .send({
        name: "Evento",
        eventDate: "2026-04-11T18:00",
        location: "Local",
        pricePerPerson: "10.00",
        attachments: [{ fileName: "a.jpg", fileUrl: "a.jpg" }],
      });

    expect(createEventMock).toHaveBeenCalledTimes(1);
    expect(addEventAttachmentMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("returns 401 for POST /events without x-user-id", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).post("/events").send({});
    expect(response.status).toBe(401);
  });

  it("returns 404 for DELETE /events/:id when missing", async () => {
    deleteEventMock.mockResolvedValue(false);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).delete("/events/event-1");
    expect(response.status).toBe(404);
  });

  it("returns 401 for POST /events/:id/participants without x-user-id", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).post("/events/event-1/participants").send({});
    expect(response.status).toBe(401);
  });

  it("creates participant with registeredBy header", async () => {
    addEventParticipantMock.mockResolvedValue({ id: "participant-1" });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app)
      .post("/events/event-1/participants")
      .set(createRouteTestHeaders())
      .send({ clientId: "client-1", status: "inscrito" });
    expect(addEventParticipantMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("returns 400 for POST /events/:id/attachments without file data", async () => {
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });
    const response = await request(app).post("/events/event-1/attachments").send({});
    expect(response.status).toBe(400);
  });
});
