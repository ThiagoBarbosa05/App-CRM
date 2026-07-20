import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { eventsRouter } from "../events.routes";
import { createRouteTestApp } from "../../test/create-route-test-app";

const {
  getEventsMock,
  getEventsPaginatedMock,
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
  getEventsPaginatedMock: vi.fn(),
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
    getEventsPaginated: getEventsPaginatedMock,
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
    getEventsPaginatedMock.mockReset();
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

  it("keeps GET /events with user filtering from jwt", async () => {
    getEventsMock.mockResolvedValue([{ id: "event-1" }]);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events");

    expect(getEventsMock).toHaveBeenCalledWith("test-user-id", "admin");
    expect(response.status).toBe(200);
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
    createEventMock.mockResolvedValue({ id: "event-1" });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app)
      .post("/events")
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
});
