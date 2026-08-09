import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { umblerContactImportRouter } from "../umbler-contact-import.routes";

const {
  getOrganizationMembersMock,
  listContactsForMemberMock,
  startImportMock,
  getStatusMock,
} = vi.hoisted(() => ({
  getOrganizationMembersMock: vi.fn(),
  listContactsForMemberMock: vi.fn(),
  startImportMock: vi.fn(),
  getStatusMock: vi.fn(),
}));

vi.mock("../../integrations/umbler", () => ({
  getOrganizationMembers: getOrganizationMembersMock,
}));

vi.mock("../../services/umbler-contact-import.service", () => ({
  listContactsForMember: listContactsForMemberMock,
  startImport: startImportMock,
  getStatus: getStatusMock,
}));

describe("umblerContactImportRouter", () => {
  beforeEach(() => {
    getOrganizationMembersMock.mockReset();
    listContactsForMemberMock.mockReset();
    startImportMock.mockReset();
    getStatusMock.mockReset();
  });

  it("returns members from GET /umbler-contact-import/members", async () => {
    getOrganizationMembersMock.mockResolvedValue([
      { id: "member-1", displayName: "Ana", emailAddress: "ana@umbler.com", active: true },
    ]);
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const response = await request(app).get("/umbler-contact-import/members");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: "member-1", displayName: "Ana", emailAddress: "ana@umbler.com", active: true },
    ]);
  });

  it("returns 400 for GET /umbler-contact-import/contacts without memberId", async () => {
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const response = await request(app).get("/umbler-contact-import/contacts");

    expect(response.status).toBe(400);
    expect(listContactsForMemberMock).not.toHaveBeenCalled();
  });

  it("lists contacts for a member in GET /umbler-contact-import/contacts", async () => {
    listContactsForMemberMock.mockResolvedValue([
      { id: "contact-1", name: "João", phoneNumber: "+5511999999999", tags: [], alreadyImported: false },
    ]);
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const response = await request(app).get(
      "/umbler-contact-import/contacts?memberId=member-1",
    );

    expect(listContactsForMemberMock).toHaveBeenCalledWith("member-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: "contact-1", name: "João", phoneNumber: "+5511999999999", tags: [], alreadyImported: false },
    ]);
  });

  it("returns 400 for POST /umbler-contact-import/start with invalid body", async () => {
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const response = await request(app)
      .post("/umbler-contact-import/start")
      .send({ memberId: "member-1" });

    expect(response.status).toBe(400);
    expect(startImportMock).not.toHaveBeenCalled();
  });

  it("starts the import in POST /umbler-contact-import/start", async () => {
    startImportMock.mockResolvedValue(undefined);
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const contacts = [
      {
        id: "contact-1",
        name: "João",
        phoneNumber: "+5511999999999",
        tags: [],
        alreadyImported: false,
      },
    ];

    const response = await request(app).post("/umbler-contact-import/start").send({
      memberId: "member-1",
      memberName: "Ana",
      vendorUserId: "user-1",
      contacts,
    });

    expect(startImportMock).toHaveBeenCalledWith("member-1", "Ana", "user-1", contacts);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Importação iniciada" });
  });

  it("returns 409 for POST /umbler-contact-import/start when already running", async () => {
    startImportMock.mockRejectedValue(new Error("Importação já está em andamento"));
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const response = await request(app).post("/umbler-contact-import/start").send({
      memberId: "member-1",
      memberName: "Ana",
      vendorUserId: "user-1",
      contacts: [
        { id: "contact-1", name: null, phoneNumber: null, tags: [], alreadyImported: false },
      ],
    });

    expect(response.status).toBe(409);
  });

  it("returns the current status in GET /umbler-contact-import/status", async () => {
    getStatusMock.mockReturnValue({
      status: "idle",
      total: 0,
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      logs: [],
    });
    const app = createRouteTestApp({ router: umblerContactImportRouter, basePath: "/" });

    const response = await request(app).get("/umbler-contact-import/status");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("idle");
  });
});
